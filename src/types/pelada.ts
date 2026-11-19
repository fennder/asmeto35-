export type PlayerPosition = 'Goleiro' | 'Defesa' | 'Meio' | 'Atacante' | 'Versátil';

export type CardType = 'yellow' | 'blue' | 'red';

export type RankingCategory = 'gol' | 'assistencia' | 'disciplinado' | 'aproveitamento';

export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  photoDataUrl: string;
  goals: number;
  assists: number;
  yellowCards: number;
  blueCards: number;
  redCards: number;
  wins: number;
  matchesPlayed: number;
  visibility: 'public';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'card' | 'sub' | 'return' | 'leave';
  team: 'A' | 'B' | 'queue';
  playerId: string;
  assistPlayerId?: string;
  cardType?: CardType;
  minuteLabel: string;
  description: string;
  timestampMs: number;
}

export interface PunishmentEntry {
  playerId: string;
  team: 'A' | 'B';
  reason: 'red' | 'second_yellow';
  startedAtMs: number;
  durationSeconds: number;
  remainingSeconds: number;
  returned: boolean;
}

export interface LiveMatchState {
  matchNumber: number;
  scoreA: number;
  scoreB: number;
  remainingSeconds: number;
  isRunning: boolean;
  lastTickAtMs: number | null;
  clockAnchorRemainingSeconds?: number;
  yellowCountsInMatch: Record<string, number>;
  punishments: PunishmentEntry[];
  events: MatchEvent[];
}

export interface CompletedMatchSummary {
  matchNumber: number;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B';
  tieBreaker: 'regulation' | 'penalties' | 'declared';
  penaltyScoreA?: number;
  penaltyScoreB?: number;
  eventsCount: number;
  endedAtIso: string;
}

export interface PeladaSession {
  id: string;
  name: string;
  dateLabel: string;
  status: 'open' | 'live' | 'finished';
  playersPerTeam: number;
  matchDurationSeconds: number;
  punishmentDurationSeconds: number;
  maxWinStreak: number;
  drawDone: boolean;
  confirmedPlayerIds: string[];
  registeredOrderIds: string[];
  teamA: string[];
  teamB: string[];
  teamAStreak: number;
  teamBStreak: number;
  waitingQueue: string[];
  latePriorityIds: string[];
  matchesCompleted: number;
  currentMatch: LiveMatchState;
  matchHistory: CompletedMatchSummary[];
  visibility: 'public';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const BLUEPRINT_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  PLAYER_NAME_MAX: 80,
  PHOTO_DATA_URL_MAX: 180000,
  SESSION_NAME_MAX: 100,
  DATE_LABEL_MAX: 40,
  MAX_CONFIRMED: 100,
  MAX_TEAM_SIZE: 20,
} as const;
