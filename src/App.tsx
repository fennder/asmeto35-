import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AthletesView } from './components/AthletesView';
import {
  AthleteModal,
  CardModal,
  GoalModal,
  NewSessionModal,
  TieBreakerModal,
  TimerConfigModal,
} from './components/MatchModals';
import { MatchDayView } from './components/MatchDayView';
import { RankingView } from './components/RankingView';
import { SessionsView } from './components/SessionsView';
import { SpectatorView } from './components/SpectatorView';
import { TopBar, type AppTab } from './components/TopBar';
import { auth, googleProvider } from './firebase/config';
import {
  createPlayerInCloud,
  createSessionInCloud,
  deletePlayerInCloud,
  loadLocalPlayers,
  loadLocalSessions,
  saveLocalPlayers,
  saveLocalSessions,
  seedCloudIfEmpty,
  subscribePublicPlayers,
  subscribePublicSessions,
  updatePlayerInCloud,
  updateSessionInCloud,
} from './firebase/peladaService';
import type { CardType, PeladaSession, Player, PlayerPosition } from './types/pelada';
import {
  addToWaitingQueuePriority,
  buildPlayersCsv,
  createInitialMatchState,
  drawTeamsByRegistrationOrder,
  finishMatchAndRotate,
  issueMatchCard,
  recordGoalWithAssist,
  registerPlayerInSession,
  removePlayerFromSession,
  returnPunishedPlayer,
  substitutePlayerWithQueue,
} from './utils/peladaRules';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'espectador' || view === 'spectator') return 'espectador';
    if (view === 'sessoes') return 'sessoes';
    if (view === 'atletas') return 'atletas';
    if (view === 'ranking') return 'ranking';
    return 'partida';
  });
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [players, setPlayers] = useState<Player[]>(() => loadLocalPlayers());
  const [sessions, setSessions] = useState<PeladaSession[]>(() =>
    loadLocalSessions()
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSession = params.get('sessao');
    const loaded = loadLocalSessions();
    if (requestedSession && loaded.some((s) => s.id === requestedSession)) {
      return requestedSession;
    }
    return loaded[0]?.id || '';
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDefaultTeam, setGoalDefaultTeam] = useState<'A' | 'B'>('A');
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [timerConfigOpen, setTimerConfigOpen] = useState(false);
  const [athleteModalOpen, setAthleteModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [addNewAthleteToQueue, setAddNewAthleteToQueue] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  const cloudHasDataRef = useRef({ players: false, sessions: false });

  const showToast = (msg: string) => {
    setFeedback(msg);
  };

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach public Firestore listeners after authReady
  useEffect(() => {
    if (!authReady) return;

    const unsubPlayers = subscribePublicPlayers(
      (cloudPlayers) => {
        if (cloudPlayers.length > 0) {
          cloudHasDataRef.current.players = true;
          setPlayers(cloudPlayers);
          saveLocalPlayers(cloudPlayers);

          if (!cloudHasDataRef.current.sessions) {
            const cloudIdSet = new Set(cloudPlayers.map((p) => p.id));
            const cloudGkSet = new Set(
              cloudPlayers
                .filter((p) => p.position === 'Goleiro')
                .map((p) => p.id)
            );
            const allCloudIds = cloudPlayers.map((p) => p.id);
            setSessions((prevSessions) => {
              let changed = false;
              const nextSessions = prevSessions.map((s) => {
                if (s.createdBy !== 'seed') return s;
                const hasAnyValid = s.confirmedPlayerIds.some((id) =>
                  cloudIdSet.has(id)
                );
                if (hasAnyValid) return s;
                changed = true;
                const remappedBase: PeladaSession = {
                  ...s,
                  confirmedPlayerIds: allCloudIds,
                  registeredOrderIds: allCloudIds,
                  teamA: [],
                  teamB: [],
                  waitingQueue: [],
                  latePriorityIds: [],
                };
                return s.drawDone
                  ? drawTeamsByRegistrationOrder(remappedBase, cloudGkSet)
                  : remappedBase;
              });
              if (changed) {
                saveLocalSessions(nextSessions);
              }
              return changed ? nextSessions : prevSessions;
            });
          }
        }
      },
      () => {
        // Fallback smoothly to local data if offline/unconfigured
      }
    );

    const unsubSessions = subscribePublicSessions(
      (cloudSessions) => {
        if (cloudSessions.length > 0) {
          cloudHasDataRef.current.sessions = true;
          const sorted = [...cloudSessions].sort((a, b) =>
            b.dateLabel.localeCompare(a.dateLabel)
          );
          setSessions(sorted);
          saveLocalSessions(sorted);
          setActiveSessionId((prev) =>
            sorted.some((s) => s.id === prev) ? prev : sorted[0]?.id || ''
          );
        }
      },
      () => {
        // Fallback smoothly to local data
      }
    );

    return () => {
      unsubPlayers();
      unsubSessions();
    };
  }, [authReady]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const goalkeeperIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      if (p.position === 'Goleiro') set.add(p.id);
    }
    return set;
  }, [players]);

  const persistPlayers = (nextPlayers: Player[]) => {
    setPlayers(nextPlayers);
    saveLocalPlayers(nextPlayers);
  };

  const persistSession = (updated: PeladaSession, syncCloud = true) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      const next = exists
        ? prev.map((s) => (s.id === updated.id ? updated : s))
        : [updated, ...prev];
      saveLocalSessions(next);
      return next;
    });
    if (syncCloud && user) {
      void updateSessionInCloud(updated);
    }
  };

  // Cross-tab live sync for Spectator Mode when testing or viewing locally on the same device
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pelada_asmeto_sessions_v1') {
        setSessions(loadLocalSessions());
      }
      if (e.key === 'pelada_asmeto_players_v1') {
        setPlayers(loadLocalPlayers());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Real-time countdown tick for active match clock and active punishments
  const isTimerRunning = activeSession?.currentMatch.isRunning ?? false;
  const hasTickingPunishment =
    activeSession?.currentMatch.punishments.some(
      (p) => !p.returned && p.remainingSeconds > 0
    ) ?? false;

  useEffect(() => {
    if (!activeSession || (!isTimerRunning && !hasTickingPunishment)) {
      return;
    }

    const interval = window.setInterval(() => {
      setSessions((prev) => {
        const current = prev.find((s) => s.id === activeSession.id);
        if (!current) return prev;

        const cm = current.currentMatch;
        const nextRemaining = cm.isRunning
          ? Math.max(0, cm.remainingSeconds - 1)
          : cm.remainingSeconds;
        const nextIsRunning = nextRemaining === 0 ? false : cm.isRunning;

        const nextPunishments = cm.punishments.map((p) => {
          if (p.returned || p.remainingSeconds <= 0) return p;
          return { ...p, remainingSeconds: Math.max(0, p.remainingSeconds - 1) };
        });

        const updated: PeladaSession = {
          ...current,
          currentMatch: {
            ...cm,
            remainingSeconds: nextRemaining,
            isRunning: nextIsRunning,
            punishments: nextPunishments,
          },
        };

        const nextAll = prev.map((s) => (s.id === updated.id ? updated : s));
        saveLocalSessions(nextAll);
        return nextAll;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeSession?.id, isTimerRunning, hasTickingPunishment]);

  // Auth handlers
  const handleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (
        cred.user &&
        (!cloudHasDataRef.current.players || !cloudHasDataRef.current.sessions)
      ) {
        await seedCloudIfEmpty(players, sessions);
      }
      showToast(`Conectado como ${cred.user.displayName || 'Gestor'}.`);
    } catch {
      showToast('Login Google cancelado ou indisponível neste navegador.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('Desconectado da conta Google.');
  };

  // Match Day Handlers
  const handleToggleTimer = () => {
    if (!activeSession) return;
    const cm = activeSession.currentMatch;
    const starting = !cm.isRunning;
    const next: PeladaSession = {
      ...activeSession,
      currentMatch: {
        ...cm,
        isRunning: starting,
        lastTickAtMs: starting ? Date.now() : null,
        clockAnchorRemainingSeconds: cm.remainingSeconds,
      },
    };
    persistSession(next);
  };

  const handleResetTimer = () => {
    if (!activeSession) return;
    const next: PeladaSession = {
      ...activeSession,
      currentMatch: {
        ...activeSession.currentMatch,
        isRunning: false,
        remainingSeconds: activeSession.matchDurationSeconds,
        lastTickAtMs: null,
        clockAnchorRemainingSeconds: activeSession.matchDurationSeconds,
      },
    };
    persistSession(next);
    showToast('Cronômetro reiniciado.');
  };

  const handleSaveTimerConfig = (matchSecs: number, punishSecs: number) => {
    if (!activeSession) return;
    const next: PeladaSession = {
      ...activeSession,
      matchDurationSeconds: matchSecs,
      punishmentDurationSeconds: punishSecs,
      currentMatch: {
        ...activeSession.currentMatch,
        remainingSeconds: activeSession.currentMatch.isRunning
          ? activeSession.currentMatch.remainingSeconds
          : matchSecs,
      },
    };
    persistSession(next);
    setTimerConfigOpen(false);
    showToast('Tempos da partida atualizados.');
  };

  const handleConfirmGoal = (
    team: 'A' | 'B',
    scorerId: string,
    assistId?: string
  ) => {
    if (!activeSession) return;
    const scorer = playerMap.get(scorerId);
    const assistant = assistId ? playerMap.get(assistId) : undefined;
    const result = recordGoalWithAssist(
      activeSession,
      team,
      scorerId,
      scorer?.name || scorerId,
      assistId,
      assistant?.name
    );
    if (result.error) {
      showToast(result.error);
      return;
    }

    persistSession(result.session);

    // Update career stats for scorer and assistant
    const updatedPlayers = players.map((p) => {
      if (p.id === scorerId) {
        const nextP = { ...p, goals: p.goals + 1 };
        if (user) {
          void updatePlayerInCloud(p.id, { goals: nextP.goals });
        }
        return nextP;
      }
      if (assistId && p.id === assistId) {
        const nextP = { ...p, assists: p.assists + 1 };
        if (user) {
          void updatePlayerInCloud(p.id, { assists: nextP.assists });
        }
        return nextP;
      }
      return p;
    });
    persistPlayers(updatedPlayers);
    setGoalModalOpen(false);
    showToast(
      assistant
        ? `Gol de ${scorer?.name} com assistência de ${assistant.name}!`
        : `Gol de ${scorer?.name}!`
    );
  };

  const handleConfirmCard = (
    team: 'A' | 'B',
    playerId: string,
    cardType: CardType
  ) => {
    if (!activeSession) return;
    const target = playerMap.get(playerId);
    const { session: nextSession, triggeredSuspension, cardStatsDelta } =
      issueMatchCard(
        activeSession,
        team,
        playerId,
        target?.name || playerId,
        cardType
      );

    persistSession(nextSession);

    const updatedPlayers = players.map((p) => {
      if (p.id !== playerId) return p;
      const nextP: Player = {
        ...p,
        yellowCards: p.yellowCards + cardStatsDelta.yellow,
        blueCards: p.blueCards + cardStatsDelta.blue,
        redCards: p.redCards + cardStatsDelta.red,
      };
      if (user) {
        void updatePlayerInCloud(p.id, {
          yellowCards: nextP.yellowCards,
          blueCards: nextP.blueCards,
          redCards: nextP.redCards,
        });
      }
      return nextP;
    });
    persistPlayers(updatedPlayers);
    setCardModalOpen(false);

    if (triggeredSuspension) {
      showToast(
        `${target?.name || 'Atleta'} suspenso por ${activeSession.punishmentDurationSeconds}s (VM).`
      );
    } else {
      showToast(`Cartão registrado para ${target?.name || 'atleta'}.`);
    }
  };

  const handleSubstitutePlayer = (playerId: string) => {
    if (!activeSession) return;
    const outP = playerMap.get(playerId);
    const res = substitutePlayerWithQueue(
      activeSession,
      playerId,
      outP?.name || playerId,
      (inId) => playerMap.get(inId)?.name || inId,
      Date.now(),
      goalkeeperIds
    );
    if (res.error) {
      showToast(res.error);
      return;
    }
    const inName = res.incomingPlayerId
      ? playerMap.get(res.incomingPlayerId)?.name || res.incomingPlayerId
      : 'Próximo';
    persistSession(res.session);
    showToast(
      `Substituição: entrou ${inName}, saiu ${outP?.name || playerId}.`
    );
  };

  const handleRemovePlayerFromMatch = (playerId: string) => {
    if (!activeSession) return;
    const target = playerMap.get(playerId);
    const next = removePlayerFromSession(
      activeSession,
      playerId,
      target?.name || playerId,
      Date.now(),
      goalkeeperIds
    );
    persistSession(next);
    showToast(`${target?.name || 'Atleta'} removido da pelada atual.`);
  };

  const handleReturnPunished = (playerId: string) => {
    if (!activeSession) return;
    const target = playerMap.get(playerId);
    const res = returnPunishedPlayer(
      activeSession,
      playerId,
      target?.name || playerId
    );
    if (res.error) {
      showToast(res.error);
      return;
    }
    persistSession(res.session);
    showToast(`${target?.name || 'Atleta'} retornou ao jogo.`);
  };

  const handleAddPlayerToQueue = (playerId: string) => {
    if (!activeSession) return;
    const next = addToWaitingQueuePriority(
      activeSession,
      playerId,
      true,
      goalkeeperIds
    );
    persistSession(next);
    const target = playerMap.get(playerId);
    const isGk = goalkeeperIds.has(playerId);
    const inPitch =
      next.teamA.includes(playerId) || next.teamB.includes(playerId);
    showToast(
      inPitch
        ? `${target?.name || 'Goleiro'} entrou direto no gol do time!`
        : isGk
          ? `${target?.name || 'Goleiro'} entrou no topo da fila (prioridade de goleiro).`
          : `${target?.name || 'Atleta'} entrou na frente da fila (prioridade).`
    );
  };

  const finalizeMatchWithWinner = (
    winner: 'A' | 'B',
    tieBreaker: 'regulation' | 'penalties' | 'declared' = 'regulation',
    penA?: number,
    penB?: number
  ) => {
    if (!activeSession) return;
    const res = finishMatchAndRotate(
      activeSession,
      winner,
      tieBreaker,
      penA,
      penB,
      new Date().toISOString(),
      goalkeeperIds
    );
    persistSession(res.session);

    const winSet = new Set(res.winningPlayerIds);
    const partSet = new Set(res.participatingPlayerIds);
    const updatedPlayers = players.map((p) => {
      if (!partSet.has(p.id)) return p;
      const nextP: Player = {
        ...p,
        matchesPlayed: p.matchesPlayed + 1,
        wins: winSet.has(p.id) ? p.wins + 1 : p.wins,
      };
      if (user) {
        void updatePlayerInCloud(p.id, {
          matchesPlayed: nextP.matchesPlayed,
          wins: nextP.wins,
        });
      }
      return nextP;
    });
    persistPlayers(updatedPlayers);
    setTieModalOpen(false);

    if (res.forcedChampionExit) {
      showToast(
        `Time ${winner} alcançou ${activeSession.maxWinStreak} vitórias e cumpriu saída obrigatória!`
      );
    } else {
      showToast(`Vitória do Time ${winner} registrada. Equipes rotacionadas!`);
    }
  };

  const handleFinishMatch = (explicitWinner?: 'A' | 'B') => {
    if (!activeSession) return;
    if (explicitWinner) {
      finalizeMatchWithWinner(explicitWinner, 'regulation');
      return;
    }
    const { scoreA, scoreB } = activeSession.currentMatch;
    if (scoreA === scoreB) {
      setTieModalOpen(true);
      return;
    }
    finalizeMatchWithWinner(scoreA > scoreB ? 'A' : 'B', 'regulation');
  };

  // Sessions & Attendance Handlers
  const handleCreateSession = (cfg: {
    name: string;
    dateLabel: string;
    playersPerTeam: number;
    matchDurationSeconds: number;
    punishmentDurationSeconds: number;
    maxWinStreak: number;
  }) => {
    const id = `sess_${Date.now()}`;
    const newSess: PeladaSession = {
      id,
      name: cfg.name,
      dateLabel: cfg.dateLabel,
      status: 'open',
      playersPerTeam: cfg.playersPerTeam,
      matchDurationSeconds: cfg.matchDurationSeconds,
      punishmentDurationSeconds: cfg.punishmentDurationSeconds,
      maxWinStreak: cfg.maxWinStreak,
      drawDone: false,
      confirmedPlayerIds: [],
      registeredOrderIds: [],
      teamA: [],
      teamB: [],
      teamAStreak: 0,
      teamBStreak: 0,
      waitingQueue: [],
      latePriorityIds: [],
      matchesCompleted: 0,
      currentMatch: createInitialMatchState(1, cfg.matchDurationSeconds),
      matchHistory: [],
      visibility: 'public',
      createdBy: user?.uid || 'local',
    };
    const nextAll = [newSess, ...sessions];
    setSessions(nextAll);
    saveLocalSessions(nextAll);
    setActiveSessionId(id);
    if (user) {
      void createSessionInCloud(newSess);
    }
    setNewSessionOpen(false);
    showToast(`Sessão "${cfg.name}" criada!`);
  };

  const handleToggleConfirmPlayer = (playerId: string) => {
    if (!activeSession) return;
    const exists = activeSession.confirmedPlayerIds.includes(playerId);
    let next: PeladaSession;
    if (exists) {
      next = removePlayerFromSession(
        activeSession,
        playerId,
        playerMap.get(playerId)?.name,
        Date.now(),
        goalkeeperIds
      );
    } else {
      next = registerPlayerInSession(
        activeSession,
        playerId,
        true,
        goalkeeperIds
      );
    }
    persistSession(next);
  };

  const handleToggleConfirmAll = () => {
    if (!activeSession) return;
    const allIds = players.map((p) => p.id);
    const allConfirmed = allIds.every((id) =>
      activeSession.confirmedPlayerIds.includes(id)
    );
    const next: PeladaSession = {
      ...activeSession,
      confirmedPlayerIds: allConfirmed ? [] : allIds,
      registeredOrderIds: allConfirmed
        ? []
        : Array.from(new Set([...activeSession.registeredOrderIds, ...allIds])),
    };
    persistSession(next);
  };

  const handleDrawTeams = () => {
    if (!activeSession) return;
    const drawn = drawTeamsByRegistrationOrder(activeSession, goalkeeperIds);
    persistSession(drawn);
    setActiveTab('partida');
    showToast('Times sorteados com 1 goleiro por time!');
  };

  const handleFinishSession = () => {
    if (!activeSession) return;
    const next: PeladaSession = {
      ...activeSession,
      status: 'finished',
      currentMatch: {
        ...activeSession.currentMatch,
        isRunning: false,
      },
    };
    persistSession(next);
    showToast(`Sessão "${activeSession.name}" finalizada no histórico.`);
  };

  // Athletes CRUD & CSV Export
  const handleSaveAthlete = (data: {
    name: string;
    position: PlayerPosition;
    photoDataUrl: string;
  }) => {
    if (editingPlayer) {
      const updated: Player = {
        ...editingPlayer,
        name: data.name,
        position: data.position,
        photoDataUrl: data.photoDataUrl,
      };
      persistPlayers(
        players.map((p) => (p.id === updated.id ? updated : p))
      );
      if (user) {
        void updatePlayerInCloud(updated.id, {
          name: updated.name,
          position: updated.position,
          photoDataUrl: updated.photoDataUrl,
        });
      }
      setAthleteModalOpen(false);
      setEditingPlayer(null);
      showToast(`Cadastro de ${updated.name} atualizado.`);
      return;
    }

    const id = `atl_${Date.now()}`;
    const newPlayer: Player = {
      id,
      name: data.name,
      position: data.position,
      photoDataUrl: data.photoDataUrl,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      blueCards: 0,
      redCards: 0,
      wins: 0,
      matchesPlayed: 0,
      visibility: 'public',
      createdBy: user?.uid || 'local',
    };
    persistPlayers([newPlayer, ...players]);
    if (user) {
      void createPlayerInCloud(newPlayer);
    }

    if (activeSession && (addNewAthleteToQueue || activeTab === 'sessoes')) {
      const nextGkIds =
        newPlayer.position === 'Goleiro'
          ? new Set([...goalkeeperIds, id])
          : goalkeeperIds;
      const updatedSession = registerPlayerInSession(
        activeSession,
        id,
        true,
        nextGkIds
      );
      persistSession(updatedSession);
      const enteredPitch =
        updatedSession.teamA.includes(id) || updatedSession.teamB.includes(id);
      showToast(
        enteredPitch
          ? `${newPlayer.name} cadastrado e assumiu a vaga no gol!`
          : activeSession.drawDone
            ? `${newPlayer.name} cadastrado e incluído na frente da fila (prioridade)!`
            : `${newPlayer.name} cadastrado e confirmado na sessão!`
      );
    } else {
      showToast(`Atleta ${newPlayer.name} cadastrado!`);
    }

    setAddNewAthleteToQueue(false);
    setAthleteModalOpen(false);
  };

  const handleDeleteAthlete = (playerId: string) => {
    const target = playerMap.get(playerId);
    persistPlayers(players.filter((p) => p.id !== playerId));
    if (activeSession) {
      const cleaned = removePlayerFromSession(
        activeSession,
        playerId,
        target?.name,
        Date.now(),
        goalkeeperIds
      );
      persistSession(cleaned);
    }
    if (user) {
      void deletePlayerInCloud(playerId);
    }
    showToast(`Atleta ${target?.name || ''} removido da base.`);
  };

  const handleExportCsv = () => {
    const csv = buildPlayersCsv(players);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pelada-asmeto-atletas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exportação CSV com fotos concluída.');
  };

  return (
    <div id="top" className="min-h-screen bg-[#F6F7F5] text-[#0F172A] pb-24 md:pb-12">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userDisplayName={user?.displayName || user?.email || null}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-5 md:pt-7">
        {activeTab === 'partida' && (
          <MatchDayView
            session={activeSession}
            players={players}
            playerMap={playerMap}
            feedbackMessage={feedback}
            onToggleTimer={handleToggleTimer}
            onResetTimer={handleResetTimer}
            onOpenTimerConfig={() => setTimerConfigOpen(true)}
            onOpenGoalModal={(team = 'A') => {
              setGoalDefaultTeam(team);
              setGoalModalOpen(true);
            }}
            onOpenCardModal={() => setCardModalOpen(true)}
            onSubstitutePlayer={handleSubstitutePlayer}
            onRemovePlayerFromMatch={handleRemovePlayerFromMatch}
            onReturnPunished={handleReturnPunished}
            onAddPlayerToQueue={handleAddPlayerToQueue}
            onOpenNewLateAthleteModal={() => {
              setEditingPlayer(null);
              setAddNewAthleteToQueue(true);
              setAthleteModalOpen(true);
            }}
            onFinishMatch={handleFinishMatch}
            onGoToSessions={() => setActiveTab('sessoes')}
          />
        )}

        {activeTab === 'espectador' && (
          <SpectatorView
            sessions={sessions}
            activeSession={activeSession}
            playerMap={playerMap}
            onSelectSession={(id) => setActiveSessionId(id)}
          />
        )}

        {activeTab === 'sessoes' && (
          <SessionsView
            sessions={sessions}
            activeSession={activeSession}
            players={players}
            onSelectActiveSession={(id) => {
              setActiveSessionId(id);
              showToast('Sessão selecionada.');
            }}
            onOpenNewSessionModal={() => setNewSessionOpen(true)}
            onToggleConfirmPlayer={handleToggleConfirmPlayer}
            onToggleConfirmAll={handleToggleConfirmAll}
            onDrawTeams={handleDrawTeams}
            onFinishSession={handleFinishSession}
            onOpenRegisterPlayerModal={() => {
              setEditingPlayer(null);
              setAddNewAthleteToQueue(false);
              setAthleteModalOpen(true);
            }}
          />
        )}

        {activeTab === 'atletas' && (
          <AthletesView
            players={players}
            onAddAthlete={() => {
              setEditingPlayer(null);
              setAddNewAthleteToQueue(false);
              setAthleteModalOpen(true);
            }}
            onEditAthlete={(p) => {
              setEditingPlayer(p);
              setAddNewAthleteToQueue(false);
              setAthleteModalOpen(true);
            }}
            onDeleteAthlete={handleDeleteAthlete}
            onExportCsv={handleExportCsv}
          />
        )}

        {activeTab === 'ranking' && <RankingView players={players} />}
      </main>

      {/* Guided Modals */}
      {activeSession && (
        <>
          <GoalModal
            open={goalModalOpen}
            session={activeSession}
            playerMap={playerMap}
            defaultTeam={goalDefaultTeam}
            onClose={() => setGoalModalOpen(false)}
            onConfirm={handleConfirmGoal}
          />
          <CardModal
            open={cardModalOpen}
            session={activeSession}
            playerMap={playerMap}
            onClose={() => setCardModalOpen(false)}
            onConfirm={handleConfirmCard}
          />
          <TieBreakerModal
            open={tieModalOpen}
            scoreA={activeSession.currentMatch.scoreA}
            scoreB={activeSession.currentMatch.scoreB}
            onClose={() => setTieModalOpen(false)}
            onResolve={(winner, tb, penA, penB) =>
              finalizeMatchWithWinner(winner, tb, penA, penB)
            }
          />
          <TimerConfigModal
            open={timerConfigOpen}
            matchDurationSeconds={activeSession.matchDurationSeconds}
            punishmentDurationSeconds={activeSession.punishmentDurationSeconds}
            onClose={() => setTimerConfigOpen(false)}
            onSave={handleSaveTimerConfig}
          />
        </>
      )}

      <AthleteModal
        open={athleteModalOpen}
        editingPlayer={editingPlayer}
        onClose={() => {
          setAthleteModalOpen(false);
          setEditingPlayer(null);
          setAddNewAthleteToQueue(false);
        }}
        onSave={handleSaveAthlete}
      />

      <NewSessionModal
        open={newSessionOpen}
        onClose={() => setNewSessionOpen(false)}
        onCreate={handleCreateSession}
      />
    </div>
  );
}
