import type {
  CardType,
  LiveMatchState,
  PeladaSession,
  Player,
  PunishmentEntry,
  RankingCategory,
} from '../types/pelada';

export function createInitialMatchState(
  matchNumber: number,
  matchDurationSeconds: number
): LiveMatchState {
  return {
    matchNumber,
    scoreA: 0,
    scoreB: 0,
    remainingSeconds: matchDurationSeconds,
    isRunning: false,
    lastTickAtMs: null,
    clockAnchorRemainingSeconds: matchDurationSeconds,
    yellowCountsInMatch: {},
    punishments: [],
    events: [],
  };
}

export function computeLiveRemainingSeconds(
  match: LiveMatchState,
  nowMs = Date.now()
): number {
  if (!match.isRunning || match.lastTickAtMs == null) {
    return Math.max(0, match.remainingSeconds);
  }
  const anchor =
    match.clockAnchorRemainingSeconds ?? match.remainingSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - match.lastTickAtMs) / 1000));
  return Math.max(0, anchor - elapsedSeconds);
}

export function computeLivePunishmentRemaining(
  entry: PunishmentEntry,
  nowMs = Date.now()
): number {
  if (entry.returned) return 0;
  if (!entry.startedAtMs || entry.startedAtMs <= 0) {
    return Math.max(0, entry.remainingSeconds);
  }
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - entry.startedAtMs) / 1000));
  return Math.max(0, entry.durationSeconds - elapsedSeconds);
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatElapsedMinute(
  matchDurationSeconds: number,
  remainingSeconds: number
): string {
  const elapsed = Math.max(0, matchDurationSeconds - remainingSeconds);
  const mins = Math.floor(elapsed / 60) + 1;
  return `${mins}'`;
}

export function isPlayerSuspended(
  match: LiveMatchState,
  playerId: string
): boolean {
  return match.punishments.some(
    (p) => p.playerId === playerId && !p.returned
  );
}

function drawTwoTeamsRespectingGoalkeepers(
  orderedPool: string[],
  perTeam: number,
  goalkeeperIds?: ReadonlySet<string>
): { teamA: string[]; teamB: string[]; waitingQueue: string[] } {
  if (!goalkeeperIds || goalkeeperIds.size === 0) {
    return {
      teamA: orderedPool.slice(0, perTeam),
      teamB: orderedPool.slice(perTeam, perTeam * 2),
      waitingQueue: orderedPool.slice(perTeam * 2),
    };
  }

  const gks = orderedPool.filter((id) => goalkeeperIds.has(id));
  const field = orderedPool.filter((id) => !goalkeeperIds.has(id));

  const gkA = gks[0];
  const gkB = gks[1];
  const needFieldA = perTeam - (gkA ? 1 : 0);
  const needFieldB = perTeam - (gkB ? 1 : 0);

  const fieldA = field.slice(0, needFieldA);
  const fieldB = field.slice(needFieldA, needFieldA + needFieldB);

  const teamA = [...(gkA ? [gkA] : []), ...fieldA];
  const teamB = [...(gkB ? [gkB] : []), ...fieldB];

  // Fallback only if there are not enough field players to complete teams
  const usedIds = new Set([...teamA, ...teamB]);
  const remainingInOrder = orderedPool.filter((id) => !usedIds.has(id));
  while (teamA.length < perTeam && remainingInOrder.length > 0) {
    const next = remainingInOrder.shift();
    if (next) teamA.push(next);
  }
  while (teamB.length < perTeam && remainingInOrder.length > 0) {
    const next = remainingInOrder.shift();
    if (next) teamB.push(next);
  }

  return {
    teamA,
    teamB,
    waitingQueue: remainingInOrder,
  };
}

function pickTeamFromQueueRespectingGoalkeeper(
  queue: string[],
  perTeam: number,
  goalkeeperIds?: ReadonlySet<string>
): { team: string[]; remainingQueue: string[] } {
  if (!goalkeeperIds || goalkeeperIds.size === 0) {
    const copy = [...queue];
    return { team: copy.splice(0, perTeam), remainingQueue: copy };
  }

  const gkIdx = queue.findIndex((id) => goalkeeperIds.has(id));
  const team: string[] = [];
  const used = new Set<string>();

  if (gkIdx >= 0 && perTeam > 0) {
    team.push(queue[gkIdx]);
    used.add(queue[gkIdx]);
  }

  for (const id of queue) {
    if (team.length >= perTeam) break;
    if (!used.has(id) && !goalkeeperIds.has(id)) {
      team.push(id);
      used.add(id);
    }
  }

  // Only fill with additional goalkeepers if field players in queue ran out
  for (const id of queue) {
    if (team.length >= perTeam) break;
    if (!used.has(id)) {
      team.push(id);
      used.add(id);
    }
  }

  return {
    team,
    remainingQueue: queue.filter((id) => !used.has(id)),
  };
}

function pickReplacementIndexFromQueue(
  queue: string[],
  teamStillHasGoalkeeper: boolean,
  goalkeeperIds?: ReadonlySet<string>
): number {
  if (queue.length === 0) return -1;
  if (!goalkeeperIds || goalkeeperIds.size === 0) return 0;

  // Prioridade do goleiro é no time de jogo: se o time está sem goleiro, chama o próximo goleiro da fila
  if (!teamStillHasGoalkeeper) {
    const gkIdx = queue.findIndex((id) => goalkeeperIds.has(id));
    if (gkIdx >= 0) return gkIdx;
  }

  // Se o time já tem goleiro, chama jogador de linha para manter no máximo 1 goleiro por time
  if (teamStillHasGoalkeeper) {
    const fieldIdx = queue.findIndex((id) => !goalkeeperIds.has(id));
    if (fieldIdx >= 0) return fieldIdx;
  }

  return 0;
}

function getActiveGoalkeeperCount(
  session: PeladaSession,
  goalkeeperIds?: ReadonlySet<string>
): number {
  if (!goalkeeperIds || goalkeeperIds.size === 0) return 0;
  const activeUnique = new Set([
    ...session.teamA,
    ...session.teamB,
    ...session.waitingQueue,
  ]);
  let count = 0;
  for (const id of activeUnique) {
    if (goalkeeperIds.has(id)) count += 1;
  }
  return count;
}

/**
 * Draws Team A, Team B, and Waiting Queue by registration/confirmation order,
 * ensuring at most 1 goalkeeper per team when goalkeepers are registered.
 */
export function drawTeamsByRegistrationOrder(
  session: PeladaSession,
  goalkeeperIds?: ReadonlySet<string>
): PeladaSession {
  const confirmedSet = new Set(session.confirmedPlayerIds);
  const orderedConfirmed = session.registeredOrderIds.filter((id) =>
    confirmedSet.has(id)
  );
  // Include any confirmed players not yet in registeredOrderIds
  for (const id of session.confirmedPlayerIds) {
    if (!orderedConfirmed.includes(id)) {
      orderedConfirmed.push(id);
    }
  }

  const perTeam = Math.max(1, session.playersPerTeam);
  const { teamA, teamB, waitingQueue } = drawTwoTeamsRespectingGoalkeepers(
    orderedConfirmed,
    perTeam,
    goalkeeperIds
  );

  return {
    ...session,
    status: teamA.length > 0 && teamB.length > 0 ? 'live' : session.status,
    drawDone: true,
    teamA,
    teamB,
    teamAStreak: 0,
    teamBStreak: 0,
    waitingQueue,
    latePriorityIds: [],
    currentMatch: createInitialMatchState(
      session.matchesCompleted + 1,
      session.matchDurationSeconds
    ),
  };
}

/**
 * Registers or confirms a player in the session.
 * If the draw has already occurred, late arrivals enter at the FRONT of the waiting queue (priority).
 * Goalkeepers have priority in active match teams (filling an open goal slot if < playersPerTeam,
 * or entering at the very front of the waiting queue).
 */
export function registerPlayerInSession(
  session: PeladaSession,
  playerId: string,
  confirmImmediately = true,
  goalkeeperIds?: ReadonlySet<string>
): PeladaSession {
  const alreadyConfirmed = session.confirmedPlayerIds.includes(playerId);
  const alreadyRegistered = session.registeredOrderIds.includes(playerId);
  const onTeamA = session.teamA.includes(playerId);
  const onTeamB = session.teamB.includes(playerId);
  const onQueue = session.waitingQueue.includes(playerId);

  const registeredOrderIds = alreadyRegistered
    ? session.registeredOrderIds
    : [...session.registeredOrderIds, playerId];

  const confirmedPlayerIds =
    confirmImmediately && !alreadyConfirmed
      ? [...session.confirmedPlayerIds, playerId]
      : session.confirmedPlayerIds;

  if (!session.drawDone || !confirmImmediately) {
    return {
      ...session,
      registeredOrderIds,
      confirmedPlayerIds,
    };
  }

  if (onTeamA || onTeamB || onQueue) {
    return {
      ...session,
      registeredOrderIds,
      confirmedPlayerIds,
    };
  }

  const isGk = goalkeeperIds?.has(playerId) ?? false;
  const perTeam = Math.max(1, session.playersPerTeam);
  if (isGk && goalkeeperIds) {
    const aHasGk = session.teamA.some((id) => goalkeeperIds.has(id));
    const bHasGk = session.teamB.some((id) => goalkeeperIds.has(id));
    if (!aHasGk && session.teamA.length < perTeam) {
      return {
        ...session,
        registeredOrderIds,
        confirmedPlayerIds,
        teamA: [playerId, ...session.teamA],
      };
    }
    if (!bHasGk && session.teamB.length < perTeam) {
      return {
        ...session,
        registeredOrderIds,
        confirmedPlayerIds,
        teamB: [playerId, ...session.teamB],
      };
    }
    // Both teams full or already have GKs: GK goes to index 0 (highest priority)
    return {
      ...session,
      registeredOrderIds,
      confirmedPlayerIds,
      waitingQueue: [playerId, ...session.waitingQueue],
      latePriorityIds: session.latePriorityIds.includes(playerId)
        ? session.latePriorityIds
        : [playerId, ...session.latePriorityIds],
    };
  }

  const existingLateCount = session.waitingQueue.filter((id) =>
    session.latePriorityIds.includes(id)
  ).length;
  const nextQueue = [...session.waitingQueue];
  nextQueue.splice(existingLateCount, 0, playerId);

  return {
    ...session,
    registeredOrderIds,
    confirmedPlayerIds,
    waitingQueue: nextQueue,
    latePriorityIds: session.latePriorityIds.includes(playerId)
      ? session.latePriorityIds
      : [...session.latePriorityIds, playerId],
  };
}

/**
 * Adds a confirmed player directly into the waiting queue with priority if registered late.
 * Goalkeepers fill an open goal slot directly if available or take index 0 of the queue.
 */
export function addToWaitingQueuePriority(
  session: PeladaSession,
  playerId: string,
  priorityFront = true,
  goalkeeperIds?: ReadonlySet<string>
): PeladaSession {
  if (
    session.teamA.includes(playerId) ||
    session.teamB.includes(playerId) ||
    session.waitingQueue.includes(playerId)
  ) {
    return session;
  }

  const confirmedPlayerIds = session.confirmedPlayerIds.includes(playerId)
    ? session.confirmedPlayerIds
    : [...session.confirmedPlayerIds, playerId];
  const registeredOrderIds = session.registeredOrderIds.includes(playerId)
    ? session.registeredOrderIds
    : [...session.registeredOrderIds, playerId];

  const isGk = goalkeeperIds?.has(playerId) ?? false;
  const perTeam = Math.max(1, session.playersPerTeam);
  if (isGk && goalkeeperIds) {
    const aHasGk = session.teamA.some((id) => goalkeeperIds.has(id));
    const bHasGk = session.teamB.some((id) => goalkeeperIds.has(id));
    if (!aHasGk && session.teamA.length < perTeam) {
      return {
        ...session,
        confirmedPlayerIds,
        registeredOrderIds,
        teamA: [playerId, ...session.teamA],
      };
    }
    if (!bHasGk && session.teamB.length < perTeam) {
      return {
        ...session,
        confirmedPlayerIds,
        registeredOrderIds,
        teamB: [playerId, ...session.teamB],
      };
    }
    return {
      ...session,
      confirmedPlayerIds,
      registeredOrderIds,
      waitingQueue: [playerId, ...session.waitingQueue],
      latePriorityIds: [playerId, ...session.latePriorityIds],
    };
  }

  if (priorityFront) {
    const existingLateCount = session.waitingQueue.filter((id) =>
      session.latePriorityIds.includes(id)
    ).length;
    const nextQueue = [...session.waitingQueue];
    nextQueue.splice(existingLateCount, 0, playerId);
    return {
      ...session,
      confirmedPlayerIds,
      registeredOrderIds,
      waitingQueue: nextQueue,
      latePriorityIds: [...session.latePriorityIds, playerId],
    };
  }

  return {
    ...session,
    confirmedPlayerIds,
    registeredOrderIds,
    waitingQueue: [...session.waitingQueue, playerId],
  };
}

/**
 * Removes a player from the session (pitch or waiting queue).
 * If removed while on Team A or Team B, calls the next player from the waiting queue to replace them.
 */
export function removePlayerFromSession(
  session: PeladaSession,
  playerId: string,
  playerName = 'Atleta',
  nowMs = Date.now(),
  goalkeeperIds?: ReadonlySet<string>
): PeladaSession {
  const inA = session.teamA.includes(playerId);
  const inB = session.teamB.includes(playerId);
  const nextQueue = session.waitingQueue.filter((id) => id !== playerId);
  const nextLate = session.latePriorityIds.filter((id) => id !== playerId);
  let nextA = session.teamA.filter((id) => id !== playerId);
  let nextB = session.teamB.filter((id) => id !== playerId);
  const nextEvents = [...session.currentMatch.events];

  if (inA || inB) {
    const teamLabel = inA ? 'A' : 'B';
    const remainingTeam = inA ? nextA : nextB;
    const teamHasGk = goalkeeperIds
      ? remainingTeam.some((id) => goalkeeperIds.has(id))
      : false;
    const pickIdx = pickReplacementIndexFromQueue(
      nextQueue,
      teamHasGk,
      goalkeeperIds
    );
    let replacementId: string | undefined;
    if (pickIdx >= 0) {
      [replacementId] = nextQueue.splice(pickIdx, 1);
      if (replacementId) {
        if (inA) nextA = [...nextA, replacementId];
        else nextB = [...nextB, replacementId];
      }
    }
    nextEvents.unshift({
      id: `evt_${nowMs}_${playerId}`,
      type: 'leave',
      team: teamLabel,
      playerId,
      minuteLabel: formatElapsedMinute(
        session.matchDurationSeconds,
        session.currentMatch.remainingSeconds
      ),
      description: replacementId
        ? `${playerName} saiu; próximo da fila assumiu a vaga.`
        : `${playerName} deixou a partida.`,
      timestampMs: nowMs,
    });
  }

  return {
    ...session,
    confirmedPlayerIds: session.confirmedPlayerIds.filter((id) => id !== playerId),
    teamA: nextA,
    teamB: nextB,
    waitingQueue: nextQueue,
    latePriorityIds: nextLate,
    currentMatch: {
      ...session.currentMatch,
      events: nextEvents,
    },
  };
}

/**
 * Swaps a player on Team A or B with the next player in the waiting queue.
 * Punished/suspended players CANNOT be substituted while suspended.
 */
export function substitutePlayerWithQueue(
  session: PeladaSession,
  outPlayerId: string,
  outPlayerName: string,
  inPlayerNameOrLookup: string | ((id: string) => string),
  nowMs = Date.now(),
  goalkeeperIds?: ReadonlySet<string>
): { session: PeladaSession; error?: string; incomingPlayerId?: string } {
  if (isPlayerSuspended(session.currentMatch, outPlayerId)) {
    return {
      session,
      error: 'Atleta punido não pode ser substituído durante o tempo de suspensão.',
    };
  }
  if (session.waitingQueue.length === 0) {
    return {
      session,
      error: 'Não há atletas na fila de espera para substituição.',
    };
  }

  const inA = session.teamA.includes(outPlayerId);
  const inB = session.teamB.includes(outPlayerId);
  if (!inA && !inB) {
    return { session, error: 'Atleta não está em campo.' };
  }

  const teamRoster = inA ? session.teamA : session.teamB;
  const remainingTeam = teamRoster.filter((id) => id !== outPlayerId);
  const outgoingIsGk = goalkeeperIds?.has(outPlayerId) ?? false;
  const teamHasGk = goalkeeperIds
    ? remainingTeam.some((id) => goalkeeperIds.has(id))
    : false;
  const activeGkCount = getActiveGoalkeeperCount(session, goalkeeperIds);
  const hasWaitingGk = goalkeeperIds
    ? session.waitingQueue.some((id) => goalkeeperIds.has(id))
    : false;

  if (outgoingIsGk && activeGkCount <= 2 && !hasWaitingGk) {
    return {
      session,
      error:
        'Com até 2 goleiros na pelada, eles são fixos nos times. Use Remover se o goleiro sair do jogo.',
    };
  }

  const pickIdx = pickReplacementIndexFromQueue(
    session.waitingQueue,
    teamHasGk,
    goalkeeperIds
  );
  const incomingId = session.waitingQueue[pickIdx];
  const restQueue = session.waitingQueue.filter((_, i) => i !== pickIdx);
  const nextQueue = [...restQueue, outPlayerId];
  const nextLate = session.latePriorityIds.filter((id) => id !== incomingId);

  const inPlayerName =
    typeof inPlayerNameOrLookup === 'function'
      ? inPlayerNameOrLookup(incomingId)
      : inPlayerNameOrLookup;

  const nextA = inA
    ? session.teamA.map((id) => (id === outPlayerId ? incomingId : id))
    : session.teamA;
  const nextB = inB
    ? session.teamB.map((id) => (id === outPlayerId ? incomingId : id))
    : session.teamB;

  const event = {
    id: `evt_sub_${nowMs}_${outPlayerId}`,
    type: 'sub' as const,
    team: (inA ? 'A' : 'B') as 'A' | 'B',
    playerId: incomingId,
    minuteLabel: formatElapsedMinute(
      session.matchDurationSeconds,
      session.currentMatch.remainingSeconds
    ),
    description: `Substituição Time ${inA ? 'A' : 'B'}: entra ${inPlayerName}, sai ${outPlayerName}.`,
    timestampMs: nowMs,
  };

  return {
    incomingPlayerId: incomingId,
    session: {
      ...session,
      teamA: nextA,
      teamB: nextB,
      waitingQueue: nextQueue,
      latePriorityIds: nextLate,
      currentMatch: {
        ...session.currentMatch,
        events: [event, ...session.currentMatch.events],
      },
    },
  };
}

/**
 * Records a Goal with mandatory Assist teammate (if team has >1 player).
 */
export function recordGoalWithAssist(
  session: PeladaSession,
  team: 'A' | 'B',
  scorerId: string,
  scorerName: string,
  assistPlayerId: string | undefined,
  assistName: string | undefined,
  nowMs = Date.now()
): { session: PeladaSession; error?: string } {
  const roster = team === 'A' ? session.teamA : session.teamB;
  if (!roster.includes(scorerId)) {
    return { session, error: 'Autor do gol não pertence à equipe selecionada.' };
  }
  if (isPlayerSuspended(session.currentMatch, scorerId)) {
    return { session, error: 'Atleta suspenso não pode registrar gol.' };
  }
  if (roster.length > 1 && (!assistPlayerId || assistPlayerId === scorerId)) {
    return {
      session,
      error: 'A seleção do jogador da assistência é obrigatória.',
    };
  }

  const nextScoreA =
    team === 'A' ? session.currentMatch.scoreA + 1 : session.currentMatch.scoreA;
  const nextScoreB =
    team === 'B' ? session.currentMatch.scoreB + 1 : session.currentMatch.scoreB;

  const event = {
    id: `evt_goal_${nowMs}_${scorerId}`,
    type: 'goal' as const,
    team,
    playerId: scorerId,
    assistPlayerId: assistPlayerId || undefined,
    minuteLabel: formatElapsedMinute(
      session.matchDurationSeconds,
      session.currentMatch.remainingSeconds
    ),
    description: assistName
      ? `Gol Time ${team}: ${scorerName} (Assist.: ${assistName})`
      : `Gol Time ${team}: ${scorerName}`,
    timestampMs: nowMs,
  };

  return {
    session: {
      ...session,
      currentMatch: {
        ...session.currentMatch,
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        events: [event, ...session.currentMatch.events],
      },
    },
  };
}

/**
 * Issues a Yellow, Blue, or Red card.
 * Red card or 2nd Yellow card in the same match triggers suspension (VM) with configurable punishment timer.
 */
export function issueMatchCard(
  session: PeladaSession,
  team: 'A' | 'B',
  playerId: string,
  playerName: string,
  cardType: CardType,
  nowMs = Date.now()
): {
  session: PeladaSession;
  triggeredSuspension: boolean;
  cardStatsDelta: { yellow: number; blue: number; red: number };
} {
  const currentYellows = session.currentMatch.yellowCountsInMatch[playerId] ?? 0;
  const nextYellowCounts = { ...session.currentMatch.yellowCountsInMatch };
  const nextPunishments = [...session.currentMatch.punishments];
  let triggeredSuspension = false;
  let suspensionReason: 'red' | 'second_yellow' | null = null;
  const cardStatsDelta = { yellow: 0, blue: 0, red: 0 };

  if (cardType === 'yellow') {
    const updatedYellow = currentYellows + 1;
    nextYellowCounts[playerId] = updatedYellow;
    cardStatsDelta.yellow = 1;
    if (updatedYellow >= 2) {
      triggeredSuspension = true;
      suspensionReason = 'second_yellow';
      cardStatsDelta.red = 1;
    }
  } else if (cardType === 'blue') {
    cardStatsDelta.blue = 1;
  } else if (cardType === 'red') {
    triggeredSuspension = true;
    suspensionReason = 'red';
    cardStatsDelta.red = 1;
  }

  if (triggeredSuspension && suspensionReason) {
    const existingActiveIdx = nextPunishments.findIndex(
      (p) => p.playerId === playerId && !p.returned
    );
    const entry: PunishmentEntry = {
      playerId,
      team,
      reason: suspensionReason,
      startedAtMs: nowMs,
      durationSeconds: session.punishmentDurationSeconds,
      remainingSeconds: session.punishmentDurationSeconds,
      returned: false,
    };
    if (existingActiveIdx >= 0) {
      nextPunishments[existingActiveIdx] = entry;
    } else {
      nextPunishments.push(entry);
    }
  }

  const cardLabel =
    cardType === 'yellow'
      ? 'Cartão Amarelo'
      : cardType === 'blue'
        ? 'Cartão Azul'
        : 'Cartão Vermelho';

  const event = {
    id: `evt_card_${nowMs}_${playerId}`,
    type: 'card' as const,
    team,
    playerId,
    cardType,
    minuteLabel: formatElapsedMinute(
      session.matchDurationSeconds,
      session.currentMatch.remainingSeconds
    ),
    description:
      suspensionReason === 'second_yellow'
        ? `${cardLabel} (2º CA -> Suspensão VM ${session.punishmentDurationSeconds}s): ${playerName}`
        : suspensionReason === 'red'
          ? `${cardLabel} (Suspensão VM ${session.punishmentDurationSeconds}s): ${playerName}`
          : `${cardLabel}: ${playerName}`,
    timestampMs: nowMs,
  };

  return {
    session: {
      ...session,
      currentMatch: {
        ...session.currentMatch,
        yellowCountsInMatch: nextYellowCounts,
        punishments: nextPunishments,
        events: [event, ...session.currentMatch.events],
      },
    },
    triggeredSuspension,
    cardStatsDelta,
  };
}

/**
 * Returns a suspended player after their punishment timer expires.
 */
export function returnPunishedPlayer(
  session: PeladaSession,
  playerId: string,
  playerName: string,
  nowMs = Date.now()
): { session: PeladaSession; error?: string } {
  const idx = session.currentMatch.punishments.findIndex(
    (p) => p.playerId === playerId && !p.returned
  );
  if (idx < 0) {
    return { session, error: 'Atleta não possui punição ativa.' };
  }
  const entry = session.currentMatch.punishments[idx];
  if (entry.remainingSeconds > 0) {
    return {
      session,
      error: `Aguarde ${entry.remainingSeconds}s para o retorno do atleta.`,
    };
  }

  const nextPunishments = session.currentMatch.punishments.map((p, i) =>
    i === idx ? { ...p, returned: true, remainingSeconds: 0 } : p
  );

  const event = {
    id: `evt_ret_${nowMs}_${playerId}`,
    type: 'return' as const,
    team: entry.team,
    playerId,
    minuteLabel: formatElapsedMinute(
      session.matchDurationSeconds,
      session.currentMatch.remainingSeconds
    ),
    description: `Retorno após punição VM: ${playerName} (Time ${entry.team}).`,
    timestampMs: nowMs,
  };

  return {
    session: {
      ...session,
      currentMatch: {
        ...session.currentMatch,
        punishments: nextPunishments,
        events: [event, ...session.currentMatch.events],
      },
    },
  };
}

/**
 * Ends the match, rotates teams according to winner-stays and max 3 consecutive wins rule,
 * and returns the list of winning player IDs & all participants for career stats update.
 */
export function finishMatchAndRotate(
  session: PeladaSession,
  winner: 'A' | 'B',
  tieBreaker: 'regulation' | 'penalties' | 'declared' = 'regulation',
  penaltyScoreA?: number,
  penaltyScoreB?: number,
  nowIso = new Date().toISOString(),
  goalkeeperIds?: ReadonlySet<string>
): {
  session: PeladaSession;
  winningPlayerIds: string[];
  participatingPlayerIds: string[];
  forcedChampionExit: boolean;
} {
  const perTeam = Math.max(1, session.playersPerTeam);
  const maxStreak = Math.max(1, session.maxWinStreak);

  const winningRoster = winner === 'A' ? [...session.teamA] : [...session.teamB];
  const losingRoster = winner === 'A' ? [...session.teamB] : [...session.teamA];
  const participatingPlayerIds = Array.from(
    new Set([...session.teamA, ...session.teamB])
  );

  const prevWinnerStreak =
    winner === 'A' ? session.teamAStreak : session.teamBStreak;
  const newWinnerStreak = prevWinnerStreak + 1;
  const forcedChampionExit = newWinnerStreak >= maxStreak;

  const summary = {
    matchNumber: session.currentMatch.matchNumber,
    scoreA: session.currentMatch.scoreA,
    scoreB: session.currentMatch.scoreB,
    winner,
    tieBreaker,
    ...(penaltyScoreA !== undefined ? { penaltyScoreA } : {}),
    ...(penaltyScoreB !== undefined ? { penaltyScoreB } : {}),
    eventsCount: session.currentMatch.events.length,
    endedAtIso: nowIso,
  };

  let nextTeamA: string[] = [];
  let nextTeamB: string[] = [];
  let nextTeamAStreak = 0;
  let nextTeamBStreak = 0;
  let queue = [...session.waitingQueue];
  let nextLate = [...session.latePriorityIds];

  const activeGkCount = getActiveGoalkeeperCount(session, goalkeeperIds);
  const fixedGoalkeepersMode = activeGkCount > 0 && activeGkCount <= 2;

  if (forcedChampionExit) {
    if (fixedGoalkeepersMode && goalkeeperIds) {
      // Até 2 goleiros: goleiros permanecem fixos nos times; apenas jogadores de linha rodam na fila
      const gkA = session.teamA.filter((id) => goalkeeperIds.has(id)).slice(0, 1);
      const gkB = session.teamB.filter((id) => goalkeeperIds.has(id)).slice(0, 1);
      const losingField = losingRoster.filter((id) => !goalkeeperIds.has(id));
      const winningField = winningRoster.filter((id) => !goalkeeperIds.has(id));
      const queueGks = queue.filter((id) => goalkeeperIds.has(id));
      const queueField = queue.filter((id) => !goalkeeperIds.has(id));

      if (gkA.length === 0 && queueGks.length > 0) {
        gkA.push(queueGks.shift()!);
      }
      if (gkB.length === 0 && queueGks.length > 0) {
        gkB.push(queueGks.shift()!);
      }

      const fieldPool = [...queueField, ...losingField, ...winningField];
      const needA = Math.max(0, perTeam - gkA.length);
      const needB = Math.max(0, perTeam - gkB.length);
      nextTeamA = [...gkA, ...fieldPool.splice(0, needA)];
      nextTeamB = [...gkB, ...fieldPool.splice(0, needB)];
      queue = [...queueGks, ...fieldPool];
    } else {
      // > 2 goleiros ou sem goleiros: ambos os times vão ao fim da fila e os próximos entram (1 goleiro por time)
      const combinedQueue = [...queue, ...losingRoster, ...winningRoster];
      const drawn = drawTwoTeamsRespectingGoalkeepers(
        combinedQueue,
        perTeam,
        goalkeeperIds
      );
      nextTeamA = drawn.teamA;
      nextTeamB = drawn.teamB;
      queue = drawn.waitingQueue;
    }
    nextTeamAStreak = 0;
    nextTeamBStreak = 0;
  } else {
    let challenger: string[] = [];
    if (fixedGoalkeepersMode && goalkeeperIds) {
      // Até 2 goleiros: goleiro do time perdedor permanece fixo no gol; apenas atletas de linha vão para a fila
      const fixedLoserGk = losingRoster.filter((id) => goalkeeperIds.has(id)).slice(0, 1);
      const losingField = losingRoster.filter((id) => !goalkeeperIds.has(id));
      const combinedPool = [...queue, ...losingField];
      if (fixedLoserGk.length > 0) {
        const pickedField = pickTeamFromQueueRespectingGoalkeeper(
          combinedPool,
          Math.max(0, perTeam - fixedLoserGk.length),
          goalkeeperIds
        );
        challenger = [...fixedLoserGk, ...pickedField.team];
        queue = pickedField.remainingQueue;
      } else {
        const picked = pickTeamFromQueueRespectingGoalkeeper(
          combinedPool,
          perTeam,
          goalkeeperIds
        );
        challenger = picked.team;
        queue = picked.remainingQueue;
      }
    } else {
      // > 2 goleiros ou sem goleiros: time perdedor inteiro (inclusive goleiro) vai ao fim da fila; próximo goleiro assume a vaga
      const combinedQueue = [...queue, ...losingRoster];
      const picked = pickTeamFromQueueRespectingGoalkeeper(
        combinedQueue,
        perTeam,
        goalkeeperIds
      );
      challenger = picked.team;
      queue = picked.remainingQueue;
    }

    if (winner === 'A') {
      nextTeamA = winningRoster;
      nextTeamAStreak = newWinnerStreak;
      nextTeamB = challenger;
      nextTeamBStreak = 0;
    } else {
      nextTeamB = winningRoster;
      nextTeamBStreak = newWinnerStreak;
      nextTeamA = challenger;
      nextTeamAStreak = 0;
    }
  }

  const onPitchSet = new Set([...nextTeamA, ...nextTeamB]);
  nextLate = nextLate.filter((id) => !onPitchSet.has(id));

  const nextMatchNumber = session.matchesCompleted + 1;

  return {
    session: {
      ...session,
      matchesCompleted: nextMatchNumber,
      teamA: nextTeamA,
      teamB: nextTeamB,
      teamAStreak: nextTeamAStreak,
      teamBStreak: nextTeamBStreak,
      waitingQueue: queue,
      latePriorityIds: nextLate,
      matchHistory: [summary, ...session.matchHistory],
      currentMatch: createInitialMatchState(
        nextMatchNumber + 1,
        session.matchDurationSeconds
      ),
    },
    winningPlayerIds: winningRoster,
    participatingPlayerIds,
    forcedChampionExit,
  };
}

export function computeApprovalRate(player: Pick<Player, 'wins' | 'matchesPlayed'>): number {
  if (player.matchesPlayed <= 0) return 0;
  return Math.round((player.wins / player.matchesPlayed) * 100);
}

export function computeDisciplinePenaltyPoints(
  player: Pick<Player, 'yellowCards' | 'blueCards' | 'redCards'>
): number {
  return player.redCards * 3 + player.yellowCards * 1 + player.blueCards * 0.5;
}

export function sortPlayersForRanking(
  players: Player[],
  category: RankingCategory
): Player[] {
  const copy = [...players];
  return copy.sort((a, b) => {
    if (category === 'gol') {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.name.localeCompare(b.name, 'pt-BR');
    }
    if (category === 'assistencia') {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.name.localeCompare(b.name, 'pt-BR');
    }
    if (category === 'disciplinado') {
      const penA = computeDisciplinePenaltyPoints(a);
      const penB = computeDisciplinePenaltyPoints(b);
      if (penA !== penB) return penA - penB;
      if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
      return a.name.localeCompare(b.name, 'pt-BR');
    }
    // aproveitamento
    const aprA = computeApprovalRate(a);
    const aprB = computeApprovalRate(b);
    if (aprB !== aprA) return aprB - aprA;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds UTF-8 BOM CSV with all permanent player statistics and photo column.
 */
export function buildPlayersCsv(players: Player[]): string {
  const header = [
    'ID',
    'Nome',
    'Posicao',
    'GOL',
    'AST',
    'CA',
    'C_AZUL',
    'CV',
    'VIT',
    'PARTIDAS',
    'APR_%',
    'Foto',
  ];
  const rows = players.map((p) =>
    [
      p.id,
      p.name,
      p.position,
      p.goals,
      p.assists,
      p.yellowCards,
      p.blueCards,
      p.redCards,
      p.wins,
      p.matchesPlayed,
      computeApprovalRate(p),
      p.photoDataUrl || '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return `\uFEFF${[header.join(','), ...rows].join('\r\n')}`;
}
