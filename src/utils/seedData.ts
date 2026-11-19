import type { PeladaSession, Player } from '../types/pelada';
import { createInitialMatchState, drawTeamsByRegistrationOrder } from './peladaRules';

const SEED_PLAYERS_RAW: Array<{
  id: string;
  name: string;
  position: Player['position'];
  goals: number;
  assists: number;
  yellowCards: number;
  blueCards: number;
  redCards: number;
  wins: number;
  matchesPlayed: number;
}> = [
  { id: 'atl_01', name: 'Rafael Mendes', position: 'Atacante', goals: 14, assists: 5, yellowCards: 2, blueCards: 0, redCards: 0, wins: 11, matchesPlayed: 16 },
  { id: 'atl_02', name: 'Thiago Costa', position: 'Meio', goals: 7, assists: 13, yellowCards: 1, blueCards: 0, redCards: 0, wins: 12, matchesPlayed: 16 },
  { id: 'atl_03', name: 'Bruno Almeida', position: 'Defesa', goals: 2, assists: 4, yellowCards: 3, blueCards: 1, redCards: 0, wins: 9, matchesPlayed: 15 },
  { id: 'atl_04', name: 'Gabriel Rocha', position: 'Goleiro', goals: 0, assists: 2, yellowCards: 0, blueCards: 0, redCards: 0, wins: 10, matchesPlayed: 14 },
  { id: 'atl_05', name: 'Lucas Ferreira', position: 'Atacante', goals: 11, assists: 6, yellowCards: 1, blueCards: 0, redCards: 0, wins: 8, matchesPlayed: 13 },
  { id: 'atl_06', name: 'Matheus Silva', position: 'Meio', goals: 5, assists: 9, yellowCards: 0, blueCards: 0, redCards: 0, wins: 11, matchesPlayed: 14 },
  { id: 'atl_07', name: 'Pedro Henrique', position: 'Defesa', goals: 1, assists: 3, yellowCards: 2, blueCards: 0, redCards: 1, wins: 6, matchesPlayed: 12 },
  { id: 'atl_08', name: 'Diego Santos', position: 'Atacante', goals: 9, assists: 4, yellowCards: 1, blueCards: 1, redCards: 0, wins: 7, matchesPlayed: 12 },
  { id: 'atl_09', name: 'Felipe Oliveira', position: 'Meio', goals: 6, assists: 8, yellowCards: 2, blueCards: 0, redCards: 0, wins: 9, matchesPlayed: 14 },
  { id: 'atl_10', name: 'Gustavo Lima', position: 'Defesa', goals: 3, assists: 2, yellowCards: 4, blueCards: 0, redCards: 1, wins: 5, matchesPlayed: 13 },
  { id: 'atl_11', name: 'Rodrigo Barbosa', position: 'Goleiro', goals: 0, assists: 1, yellowCards: 1, blueCards: 0, redCards: 0, wins: 8, matchesPlayed: 12 },
  { id: 'atl_12', name: 'André Cardoso', position: 'Versátil', goals: 4, assists: 7, yellowCards: 0, blueCards: 0, redCards: 0, wins: 10, matchesPlayed: 13 },
  { id: 'atl_13', name: 'Vinícius Souza', position: 'Atacante', goals: 8, assists: 3, yellowCards: 2, blueCards: 0, redCards: 0, wins: 7, matchesPlayed: 11 },
  { id: 'atl_14', name: 'Marcelo Duarte', position: 'Defesa', goals: 1, assists: 5, yellowCards: 1, blueCards: 0, redCards: 0, wins: 8, matchesPlayed: 13 },
  { id: 'atl_15', name: 'Cauã Teixeira', position: 'Meio', goals: 4, assists: 6, yellowCards: 0, blueCards: 0, redCards: 0, wins: 6, matchesPlayed: 9 },
  { id: 'atl_16', name: 'Henrique Moraes', position: 'Versátil', goals: 3, assists: 4, yellowCards: 1, blueCards: 0, redCards: 0, wins: 5, matchesPlayed: 10 },
  { id: 'atl_17', name: 'João Vitor', position: 'Atacante', goals: 6, assists: 2, yellowCards: 2, blueCards: 0, redCards: 0, wins: 4, matchesPlayed: 8 },
];

export const SEED_PLAYERS: Player[] = SEED_PLAYERS_RAW.map((p) => ({
  ...p,
  photoDataUrl: '',
  visibility: 'public',
  createdBy: 'seed',
}));

export function createSeedSessions(): PeladaSession[] {
  const allIds = SEED_PLAYERS.map((p) => p.id);
  const activeBase: PeladaSession = {
    id: 'pelada_quarta_atual',
    name: 'Pelada de Quarta ASMETO',
    dateLabel: '19/11/2026',
    status: 'live',
    playersPerTeam: 7,
    matchDurationSeconds: 600,
    punishmentDurationSeconds: 90,
    maxWinStreak: 3,
    drawDone: false,
    confirmedPlayerIds: allIds,
    registeredOrderIds: allIds,
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
    createdBy: 'seed',
  };

  const goalkeeperIds = new Set(
    SEED_PLAYERS.filter((p) => p.position === 'Goleiro').map((p) => p.id)
  );
  const activeDrawn = drawTeamsByRegistrationOrder(activeBase, goalkeeperIds);

  const pastSession: PeladaSession = {
    id: 'pelada_sabado_anterior',
    name: 'Pelada de Sábado ASMETO',
    dateLabel: '14/11/2026',
    status: 'finished',
    playersPerTeam: 7,
    matchDurationSeconds: 600,
    punishmentDurationSeconds: 90,
    maxWinStreak: 3,
    drawDone: true,
    confirmedPlayerIds: allIds.slice(0, 16),
    registeredOrderIds: allIds.slice(0, 16),
    teamA: allIds.slice(0, 7),
    teamB: allIds.slice(7, 14),
    teamAStreak: 2,
    teamBStreak: 0,
    waitingQueue: allIds.slice(14, 16),
    latePriorityIds: [],
    matchesCompleted: 4,
    currentMatch: createInitialMatchState(5, 600),
    matchHistory: [
      {
        matchNumber: 4,
        scoreA: 3,
        scoreB: 1,
        winner: 'A',
        tieBreaker: 'regulation',
        eventsCount: 6,
        endedAtIso: '2026-11-14T20:10:00.000Z',
      },
      {
        matchNumber: 3,
        scoreA: 2,
        scoreB: 2,
        winner: 'A',
        tieBreaker: 'penalties',
        penaltyScoreA: 4,
        penaltyScoreB: 3,
        eventsCount: 5,
        endedAtIso: '2026-11-14T19:55:00.000Z',
      },
      {
        matchNumber: 2,
        scoreA: 1,
        scoreB: 2,
        winner: 'B',
        tieBreaker: 'regulation',
        eventsCount: 4,
        endedAtIso: '2026-11-14T19:40:00.000Z',
      },
      {
        matchNumber: 1,
        scoreA: 2,
        scoreB: 0,
        winner: 'A',
        tieBreaker: 'regulation',
        eventsCount: 3,
        endedAtIso: '2026-11-14T19:25:00.000Z',
      },
    ],
    visibility: 'public',
    createdBy: 'seed',
  };

  return [activeDrawn, pastSession];
}
