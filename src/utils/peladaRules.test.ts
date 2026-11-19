import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlayersCsv,
  computeApprovalRate,
  computeLivePunishmentRemaining,
  computeLiveRemainingSeconds,
  createInitialMatchState,
  drawTeamsByRegistrationOrder,
  finishMatchAndRotate,
  issueMatchCard,
  recordGoalWithAssist,
  registerPlayerInSession,
  removePlayerFromSession,
  returnPunishedPlayer,
  sortPlayersForRanking,
  substitutePlayerWithQueue,
} from './peladaRules';
import type { PeladaSession, Player } from '../types/pelada';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Jogador ${id}`,
    position: 'Meio',
    photoDataUrl: '',
    goals: 0,
    assists: 0,
    yellowCards: 0,
    blueCards: 0,
    redCards: 0,
    wins: 0,
    matchesPlayed: 0,
    visibility: 'public',
    createdBy: 'uid_test',
    ...overrides,
  };
}

function makeSession(playerCount = 17, perTeam = 7): PeladaSession {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
  return {
    id: 'sess_1',
    name: 'Pelada de Quarta',
    dateLabel: '2026-11-19',
    status: 'open',
    playersPerTeam: perTeam,
    matchDurationSeconds: 600,
    punishmentDurationSeconds: 90,
    maxWinStreak: 3,
    drawDone: false,
    confirmedPlayerIds: ids,
    registeredOrderIds: ids,
    teamA: [],
    teamB: [],
    teamAStreak: 0,
    teamBStreak: 0,
    waitingQueue: [],
    latePriorityIds: [],
    matchesCompleted: 0,
    currentMatch: createInitialMatchState(1, 600),
    matchHistory: [],
    visibility: 'public',
    createdBy: 'uid_test',
  };
}

test('drawTeamsByRegistrationOrder splits 7 vs 7 and puts extras in waiting queue', () => {
  const s = drawTeamsByRegistrationOrder(makeSession(17, 7));
  assert.equal(s.drawDone, true);
  assert.equal(s.status, 'live');
  assert.deepEqual(s.teamA, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  assert.deepEqual(s.teamB, ['p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14']);
  assert.deepEqual(s.waitingQueue, ['p15', 'p16', 'p17']);
});

test('late registration after draw gets priority at the FRONT of waiting queue', () => {
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7));
  s = registerPlayerInSession(s, 'p_late_1', true);
  s = registerPlayerInSession(s, 'p_late_2', true);
  assert.deepEqual(s.waitingQueue, ['p_late_1', 'p_late_2', 'p15', 'p16', 'p17']);
  assert.deepEqual(s.latePriorityIds, ['p_late_1', 'p_late_2']);
});

test('removing a pitch player calls the next player from waiting queue', () => {
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7));
  s = removePlayerFromSession(s, 'p3', 'Jogador p3', 1000);
  assert.equal(s.teamA.includes('p3'), false);
  assert.equal(s.teamA.includes('p15'), true);
  assert.equal(s.teamA.length, 7);
  assert.deepEqual(s.waitingQueue, ['p16', 'p17']);
});

test('goal requires mandatory assist when team has more than 1 player', () => {
  const s = drawTeamsByRegistrationOrder(makeSession(17, 7));
  const invalid = recordGoalWithAssist(s, 'A', 'p1', 'P1', undefined, undefined);
  assert.ok(invalid.error);
  const selfAssist = recordGoalWithAssist(s, 'A', 'p1', 'P1', 'p1', 'P1');
  assert.ok(selfAssist.error);

  const valid = recordGoalWithAssist(s, 'A', 'p1', 'P1', 'p2', 'P2');
  assert.equal(valid.error, undefined);
  assert.equal(valid.session.currentMatch.scoreA, 1);
  assert.equal(valid.session.currentMatch.events.length, 1);
});

test('second yellow or red card suspends player, blocks substitution, and allows return after timer', () => {
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7));
  // 1st yellow -> not suspended
  const c1 = issueMatchCard(s, 'A', 'p1', 'P1', 'yellow', 1000);
  assert.equal(c1.triggeredSuspension, false);
  assert.equal(c1.session.currentMatch.punishments.length, 0);

  // 2nd yellow -> suspended for 90s
  const c2 = issueMatchCard(c1.session, 'A', 'p1', 'P1', 'yellow', 2000);
  assert.equal(c2.triggeredSuspension, true);
  assert.equal(c2.cardStatsDelta.red, 1);
  assert.equal(c2.session.currentMatch.punishments.length, 1);

  // Substitution blocked while suspended
  const subTry = substitutePlayerWithQueue(c2.session, 'p1', 'P1', 'P15');
  assert.ok(subTry.error);

  // Early return blocked
  const earlyRet = returnPunishedPlayer(c2.session, 'p1', 'P1');
  assert.ok(earlyRet.error);

  // Simulate timer expired -> return succeeds -> substitution now works
  const expiredSession: PeladaSession = {
    ...c2.session,
    currentMatch: {
      ...c2.session.currentMatch,
      punishments: c2.session.currentMatch.punishments.map((p) => ({
        ...p,
        remainingSeconds: 0,
      })),
    },
  };
  const retOk = returnPunishedPlayer(expiredSession, 'p1', 'P1', 95000);
  assert.equal(retOk.error, undefined);
  const subOk = substitutePlayerWithQueue(retOk.session, 'p1', 'P1', 'P15', 96000);
  assert.equal(subOk.error, undefined);
  assert.equal(subOk.session.teamA.includes('p15'), true);
});

test('winner stays up to 2 wins, 3rd win forces mandatory exit of champion team', () => {
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7));

  // Match 1: A wins (streak 1)
  const r1 = finishMatchAndRotate(s, 'A', 'regulation');
  assert.equal(r1.forcedChampionExit, false);
  assert.equal(r1.session.teamAStreak, 1);
  assert.deepEqual(r1.session.teamA, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  // B (p8..p14) went to end of queue; p15,p16,p17 + p8,p9,p10,p11 form challenger B
  assert.deepEqual(r1.session.teamB, ['p15', 'p16', 'p17', 'p8', 'p9', 'p10', 'p11']);
  assert.deepEqual(r1.session.waitingQueue, ['p12', 'p13', 'p14']);

  // Match 2: A wins again (streak 2)
  const r2 = finishMatchAndRotate(r1.session, 'A', 'regulation');
  assert.equal(r2.forcedChampionExit, false);
  assert.equal(r2.session.teamAStreak, 2);

  // Match 3: A wins 3rd time -> MANDATORY EXIT
  const r3 = finishMatchAndRotate(r2.session, 'A', 'penalties', 4, 3);
  assert.equal(r3.forcedChampionExit, true);
  assert.equal(r3.session.teamAStreak, 0);
  assert.equal(r3.session.teamBStreak, 0);
  assert.equal(r3.session.teamA.includes('p1'), false);
  assert.equal(r3.session.matchHistory[0].tieBreaker, 'penalties');
});

test('ranking sorts correctly by gol, assistencia, disciplinado, and aproveitamento', () => {
  const players: Player[] = [
    makePlayer('1', { name: 'Ana', goals: 5, assists: 2, yellowCards: 3, redCards: 1, wins: 4, matchesPlayed: 10 }),
    makePlayer('2', { name: 'Beto', goals: 2, assists: 7, yellowCards: 0, redCards: 0, wins: 6, matchesPlayed: 8 }),
    makePlayer('3', { name: 'Caio', goals: 8, assists: 1, yellowCards: 1, redCards: 0, wins: 3, matchesPlayed: 6 }),
  ];

  assert.deepEqual(
    sortPlayersForRanking(players, 'gol').map((p) => p.id),
    ['3', '1', '2']
  );
  assert.deepEqual(
    sortPlayersForRanking(players, 'assistencia').map((p) => p.id),
    ['2', '1', '3']
  );
  assert.deepEqual(
    sortPlayersForRanking(players, 'disciplinado').map((p) => p.id),
    ['2', '3', '1']
  );
  assert.deepEqual(
    sortPlayersForRanking(players, 'aproveitamento').map((p) => p.id),
    ['2', '3', '1']
  );
  assert.equal(computeApprovalRate(players[1]), 75);
});

test('buildPlayersCsv includes UTF-8 BOM, headers, photo column, and stats', () => {
  const csv = buildPlayersCsv([
    makePlayer('p1', {
      name: 'Lucas "Camisa 10"',
      goals: 4,
      assists: 3,
      wins: 2,
      matchesPlayed: 4,
      photoDataUrl: 'data:image/jpeg;base64,ABC',
    }),
  ]);
  assert.ok(csv.startsWith('\uFEFFID,Nome,Posicao,GOL,AST,CA,C_AZUL,CV,VIT,PARTIDAS,APR_%,Foto'));
  assert.ok(csv.includes('"Lucas ""Camisa 10"""'));
  assert.ok(csv.includes('50,"data:image/jpeg;base64,ABC"'));
});

test('computeLiveRemainingSeconds synchronizes match clock from anchor timestamp', () => {
  const paused = createInitialMatchState(1, 600);
  assert.equal(computeLiveRemainingSeconds(paused, 50_000), 600);

  const running = {
    ...paused,
    isRunning: true,
    lastTickAtMs: 10_000,
    clockAnchorRemainingSeconds: 600,
  };
  assert.equal(computeLiveRemainingSeconds(running, 10_000), 600);
  assert.equal(computeLiveRemainingSeconds(running, 75_500), 535);
  assert.equal(computeLiveRemainingSeconds(running, 900_000), 0);
});

test('computeLivePunishmentRemaining computes remaining suspension seconds', () => {
  const pun = {
    playerId: 'p1',
    team: 'A' as const,
    reason: 'red' as const,
    startedAtMs: 100_000,
    durationSeconds: 90,
    remainingSeconds: 90,
    returned: false,
  };
  assert.equal(computeLivePunishmentRemaining(pun, 130_000), 60);
  assert.equal(computeLivePunishmentRemaining(pun, 200_000), 0);
  assert.equal(computeLivePunishmentRemaining({ ...pun, returned: true }, 110_000), 0);
});

test('drawTeamsByRegistrationOrder enforces one goalkeeper per team even when goalkeepers register back-to-back or late', () => {
  // 3 goalkeepers: p1, p2 (back-to-back), and p16 (near end)
  const gkIds = new Set(['p1', 'p2', 'p16']);
  const s = drawTeamsByRegistrationOrder(makeSession(17, 7), gkIds);

  const gkInA = s.teamA.filter((id) => gkIds.has(id));
  const gkInB = s.teamB.filter((id) => gkIds.has(id));
  assert.equal(s.teamA.length, 7);
  assert.equal(s.teamB.length, 7);
  assert.equal(gkInA.length, 1);
  assert.equal(gkInB.length, 1);
  assert.deepEqual(gkInA, ['p1']);
  assert.deepEqual(gkInB, ['p2']);
  assert.equal(s.waitingQueue.includes('p16'), true);
});

test('drawTeamsByRegistrationOrder places single registered goalkeeper on Team A and fills Team B with field players', () => {
  const gkIds = new Set(['p12']);
  const s = drawTeamsByRegistrationOrder(makeSession(15, 7), gkIds);

  assert.equal(s.teamA.filter((id) => gkIds.has(id)).length, 1);
  assert.equal(s.teamB.filter((id) => gkIds.has(id)).length, 0);
  assert.equal(s.teamA.includes('p12'), true);
});

test('finishMatchAndRotate and substitutePlayerWithQueue preserve 1 goalkeeper per team', () => {
  const gkIds = new Set(['p1', 'p2', 'p15']);
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7), gkIds);

  // Substituting a field player on Team A (p3) should skip gk p15 in queue and bring field player p16
  const subField = substitutePlayerWithQueue(
    s,
    'p3',
    'Jogador p3',
    (id) => `Jogador ${id}`,
    1000,
    gkIds
  );
  assert.equal(subField.session.teamA.filter((id) => gkIds.has(id)).length, 1);
  assert.equal(subField.session.teamA.includes('p16'), true);

  // Substituting goalkeeper p1 on Team A should bring waiting goalkeeper p15
  const subGk = substitutePlayerWithQueue(
    subField.session,
    'p1',
    'Jogador p1',
    (id) => `Jogador ${id}`,
    2000,
    gkIds
  );
  assert.equal(subGk.session.teamA.filter((id) => gkIds.has(id)).length, 1);
  assert.equal(subGk.session.teamA.includes('p15'), true);

  // Rotate after Team A wins: challenger Team B should receive 1 goalkeeper from queue (p1 or p2)
  const rot = finishMatchAndRotate(
    subGk.session,
    'A',
    'regulation',
    undefined,
    undefined,
    '2026-11-19T20:00:00.000Z',
    gkIds
  );
  assert.equal(rot.session.teamA.filter((id) => gkIds.has(id)).length, 1);
  assert.equal(rot.session.teamB.filter((id) => gkIds.has(id)).length, 1);
  // Since 3 GKs exist (>2), losing GK p2 moved to waitingQueue and waiting GK p1 entered Time B
  assert.equal(rot.session.waitingQueue.includes('p2'), true);
});

test('when exactly 2 goalkeepers exist, both remain fixed across match loss and 3rd-win exit', () => {
  const gkIds = new Set(['p1', 'p2']);
  let s = drawTeamsByRegistrationOrder(makeSession(17, 7), gkIds);
  assert.equal(s.teamA.includes('p1'), true);
  assert.equal(s.teamB.includes('p2'), true);

  // Substituting fixed GK p1 with a field player is blocked when <= 2 GKs exist
  const blockedSub = substitutePlayerWithQueue(
    s,
    'p1',
    'Jogador p1',
    (id) => `Jogador ${id}`,
    1000,
    gkIds
  );
  assert.ok(blockedSub.error);

  // Match 1: A wins -> B loses, ONLY field players of B go to queue; p2 stays FIXED on Time B!
  const r1 = finishMatchAndRotate(s, 'A', 'regulation', undefined, undefined, '2026-11-19T20:00:00.000Z', gkIds);
  assert.equal(r1.session.teamA.includes('p1'), true);
  assert.equal(r1.session.teamB.includes('p2'), true);
  assert.equal(r1.session.teamA.length, 7);
  assert.equal(r1.session.teamB.length, 7);
  assert.equal(r1.session.waitingQueue.includes('p1'), false);
  assert.equal(r1.session.waitingQueue.includes('p2'), false);
  assert.equal(r1.winningPlayerIds.includes('p1'), true);
  assert.equal(r1.participatingPlayerIds.includes('p2'), true);

  // Match 2 & Match 3: A wins 3rd consecutive -> forcedChampionExit, BOTH p1 and p2 STILL stay fixed!
  const r2 = finishMatchAndRotate(r1.session, 'A', 'regulation', undefined, undefined, '2026-11-19T20:10:00.000Z', gkIds);
  const r3 = finishMatchAndRotate(r2.session, 'A', 'regulation', undefined, undefined, '2026-11-19T20:20:00.000Z', gkIds);
  assert.equal(r3.forcedChampionExit, true);
  assert.equal(r3.session.teamA.includes('p1'), true);
  assert.equal(r3.session.teamB.includes('p2'), true);
  assert.equal(r3.session.waitingQueue.includes('p1'), false);
  assert.equal(r3.session.waitingQueue.includes('p2'), false);
  assert.equal(r3.session.teamA.length, 7);
  assert.equal(r3.session.teamB.length, 7);
});

test('late goalkeeper gets priority in open team slot or front of waiting queue and enters on next sub', () => {
  // Start 7v7 with 14 field players + 1 GK (p1) -> Time B has 0 GKs and 7 field players
  const gkIds = new Set(['p1', 'p_late_gk']);
  let s = drawTeamsByRegistrationOrder(makeSession(14, 7), gkIds);
  assert.equal(s.teamB.filter((id) => gkIds.has(id)).length, 0);

  // Late field player joins queue first, then late GK joins -> GK must jump to index 0 (priority)
  s = registerPlayerInSession(s, 'p_late_field', true, gkIds);
  s = registerPlayerInSession(s, 'p_late_gk', true, gkIds);
  assert.equal(s.waitingQueue[0], 'p_late_gk');

  // Substituting a field player on Time B (which has 0 GKs) pulls p_late_gk immediately!
  const sub = substitutePlayerWithQueue(
    s,
    'p8',
    'Jogador p8',
    (id) => `Jogador ${id}`,
    3000,
    gkIds
  );
  assert.equal(sub.session.teamB.includes('p_late_gk'), true);
  assert.equal(sub.session.teamB.filter((id) => gkIds.has(id)).length, 1);

  // If a team has < perTeam players and 0 GKs, late GK enters directly into that team
  let smallSess = drawTeamsByRegistrationOrder(makeSession(10, 7), new Set(['p1', 'p_gk2']));
  smallSess = registerPlayerInSession(smallSess, 'p_gk2', true, new Set(['p1', 'p_gk2']));
  assert.equal(smallSess.teamB.includes('p_gk2'), true);
});

