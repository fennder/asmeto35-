import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BLUEPRINT_LIMITS,
  type PeladaSession,
  type Player,
  type PlayerPosition,
} from '../types/pelada';
import { createSeedSessions, SEED_PLAYERS } from '../utils/seedData';
import { auth, db, handleFirestoreError, OperationType } from './config';

const LOCAL_PLAYERS_KEY = 'pelada_asmeto_players_v1';
const LOCAL_SESSIONS_KEY = 'pelada_asmeto_sessions_v1';

const VALID_POSITIONS: PlayerPosition[] = [
  'Goleiro',
  'Defesa',
  'Meio',
  'Atacante',
  'Versátil',
];

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function sanitizePlayerPayload(player: Player): Player {
  const position = VALID_POSITIONS.includes(player.position)
    ? player.position
    : 'Versátil';
  return {
    ...player,
    id: sanitizeId(player.id),
    name: player.name.trim().slice(0, BLUEPRINT_LIMITS.PLAYER_NAME_MAX) || 'Atleta',
    position,
    photoDataUrl: (player.photoDataUrl || '').slice(
      0,
      BLUEPRINT_LIMITS.PHOTO_DATA_URL_MAX
    ),
    goals: Math.max(0, Math.min(10000, Math.floor(player.goals || 0))),
    assists: Math.max(0, Math.min(10000, Math.floor(player.assists || 0))),
    yellowCards: Math.max(0, Math.min(5000, Math.floor(player.yellowCards || 0))),
    blueCards: Math.max(0, Math.min(5000, Math.floor(player.blueCards || 0))),
    redCards: Math.max(0, Math.min(5000, Math.floor(player.redCards || 0))),
    wins: Math.max(0, Math.min(10000, Math.floor(player.wins || 0))),
    matchesPlayed: Math.max(
      0,
      Math.min(20000, Math.floor(player.matchesPlayed || 0))
    ),
    visibility: 'public',
    createdBy: sanitizeId(player.createdBy || auth.currentUser?.uid || 'local'),
  };
}

export function sanitizeSessionPayload(session: PeladaSession): PeladaSession {
  return {
    ...session,
    id: sanitizeId(session.id),
    name:
      session.name.trim().slice(0, BLUEPRINT_LIMITS.SESSION_NAME_MAX) ||
      'Pelada ASMETO',
    dateLabel:
      session.dateLabel.trim().slice(0, BLUEPRINT_LIMITS.DATE_LABEL_MAX) ||
      new Date().toLocaleDateString('pt-BR'),
    playersPerTeam: Math.max(1, Math.min(11, Math.floor(session.playersPerTeam || 7))),
    matchDurationSeconds: Math.max(
      60,
      Math.min(5400, Math.floor(session.matchDurationSeconds || 600))
    ),
    punishmentDurationSeconds: Math.max(
      15,
      Math.min(600, Math.floor(session.punishmentDurationSeconds || 90))
    ),
    maxWinStreak: Math.max(1, Math.min(10, Math.floor(session.maxWinStreak || 3))),
    confirmedPlayerIds: session.confirmedPlayerIds.slice(
      0,
      BLUEPRINT_LIMITS.MAX_CONFIRMED
    ),
    registeredOrderIds: session.registeredOrderIds.slice(
      0,
      BLUEPRINT_LIMITS.MAX_CONFIRMED
    ),
    teamA: session.teamA.slice(0, BLUEPRINT_LIMITS.MAX_TEAM_SIZE),
    teamB: session.teamB.slice(0, BLUEPRINT_LIMITS.MAX_TEAM_SIZE),
    teamAStreak: Math.max(0, Math.min(10, Math.floor(session.teamAStreak || 0))),
    teamBStreak: Math.max(0, Math.min(10, Math.floor(session.teamBStreak || 0))),
    waitingQueue: session.waitingQueue.slice(0, BLUEPRINT_LIMITS.MAX_CONFIRMED),
    latePriorityIds: session.latePriorityIds.slice(
      0,
      BLUEPRINT_LIMITS.MAX_CONFIRMED
    ),
    matchesCompleted: Math.max(
      0,
      Math.min(200, Math.floor(session.matchesCompleted || 0))
    ),
    matchHistory: session.matchHistory.slice(0, 100),
    visibility: 'public',
    createdBy: sanitizeId(session.createdBy || auth.currentUser?.uid || 'local'),
  };
}

export function loadLocalPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(SEED_PLAYERS));
      return SEED_PLAYERS;
    }
    const parsed = JSON.parse(raw) as Player[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_PLAYERS;
  } catch {
    return SEED_PLAYERS;
  }
}

export function saveLocalPlayers(players: Player[]): void {
  try {
    localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(players));
  } catch {
    // Ignore storage quota issues in local fallback
  }
}

export function loadLocalSessions(): PeladaSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) {
      const seeded = createSeedSessions();
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as PeladaSession[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : createSeedSessions();
  } catch {
    return createSeedSessions();
  }
}

export function saveLocalSessions(sessions: PeladaSession[]): void {
  try {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota issues in local fallback
  }
}

export function subscribePublicPlayers(
  onData: (players: Player[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'players';
  const q = query(
    collection(db, path),
    where('visibility', '==', 'public')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Player);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribePublicSessions(
  onData: (sessions: PeladaSession[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'sessions';
  const q = query(
    collection(db, path),
    where('visibility', '==', 'public')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as PeladaSession);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export async function createPlayerInCloud(player: Player): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const clean = sanitizePlayerPayload({ ...player, createdBy: uid });
  const path = `players/${clean.id}`;
  try {
    await setDoc(doc(db, 'players', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePlayerInCloud(
  playerId: string,
  updates: Partial<Player>
): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(playerId);
  const path = `players/${cleanId}`;
  try {
    await updateDoc(doc(db, 'players', cleanId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePlayerInCloud(playerId: string): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(playerId);
  const path = `players/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'players', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createSessionInCloud(session: PeladaSession): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const clean = sanitizeSessionPayload({ ...session, createdBy: uid });
  const path = `sessions/${clean.id}`;
  try {
    await setDoc(doc(db, 'sessions', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSessionInCloud(session: PeladaSession): Promise<void> {
  if (!auth.currentUser) return;
  const clean = sanitizeSessionPayload(session);
  const path = `sessions/${clean.id}`;
  const {
    createdAt: _c,
    updatedAt: _u,
    createdBy: _b,
    id: _i,
    visibility: _v,
    ...mutableFields
  } = clean;
  try {
    await updateDoc(doc(db, 'sessions', clean.id), {
      ...mutableFields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedCloudIfEmpty(
  localPlayers: Player[],
  localSessions: PeladaSession[]
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const batch = writeBatch(db);
  for (const p of localPlayers) {
    const clean = sanitizePlayerPayload({ ...p, createdBy: uid });
    batch.set(doc(db, 'players', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  for (const s of localSessions) {
    const clean = sanitizeSessionPayload({ ...s, createdBy: uid });
    batch.set(doc(db, 'sessions', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_seed');
  }
}
