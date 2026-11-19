import React, { useEffect, useState } from 'react';
import {
  Check,
  Radio,
  Share2,
  ShieldAlert,
  Square,
  Trophy,
} from 'lucide-react';
import type { PeladaSession, Player } from '../types/pelada';
import {
  computeLivePunishmentRemaining,
  computeLiveRemainingSeconds,
  formatClock,
  isPlayerSuspended,
} from '../utils/peladaRules';
import { PlayerAvatar } from './PlayerAvatar';

interface SpectatorViewProps {
  sessions: PeladaSession[];
  activeSession: PeladaSession | null;
  playerMap: Map<string, Player>;
  onSelectSession: (sessionId: string) => void;
}

type EventFilter = 'all' | 'goal' | 'card';

export const SpectatorView: React.FC<SpectatorViewProps> = ({
  sessions,
  activeSession,
  playerMap,
  onSelectSession,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const liveSessions = sessions.filter((s) => s.status !== 'finished');
  const displaySession =
    activeSession || liveSessions[0] || sessions[0] || null;

  // Real-time 1s tick for spectator display synchronized against clock anchor
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCopySpectatorLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'espectador');
    if (displaySession) {
      url.searchParams.set('sessao', displaySession.id);
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (!displaySession) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-slate-900">
          Modo Espectador
        </h1>
        <p className="text-sm text-slate-600">
          Nenhuma pelada cadastrada no momento. Assim que uma sessão iniciar, o
          placar e os eventos aparecerão aqui em tempo real.
        </p>
      </div>
    );
  }

  const { currentMatch } = displaySession;
  const liveSeconds = computeLiveRemainingSeconds(currentMatch, nowMs);
  const activePunishments = currentMatch.punishments.filter((p) => !p.returned);
  const activeGksCount = Array.from(
    new Set([
      ...displaySession.teamA,
      ...displaySession.teamB,
      ...displaySession.waitingQueue,
    ])
  ).filter((id) => playerMap.get(id)?.position === 'Goleiro').length;
  const hasFixedGoalkeepers = activeGksCount > 0 && activeGksCount <= 2;

  // Per-player in-match stats derived from match events
  const playerGoalsInMatch = new Map<string, number>();
  const playerAssistsInMatch = new Map<string, number>();
  const playerCardsInMatch = new Map<string, Array<'yellow' | 'blue' | 'red'>>();

  for (const evt of currentMatch.events) {
    if (evt.type === 'goal') {
      playerGoalsInMatch.set(
        evt.playerId,
        (playerGoalsInMatch.get(evt.playerId) || 0) + 1
      );
      if (evt.assistPlayerId) {
        playerAssistsInMatch.set(
          evt.assistPlayerId,
          (playerAssistsInMatch.get(evt.assistPlayerId) || 0) + 1
        );
      }
    }
    if (evt.type === 'card' && evt.cardType) {
      const prev = playerCardsInMatch.get(evt.playerId) || [];
      playerCardsInMatch.set(evt.playerId, [...prev, evt.cardType]);
    }
  }

  const filteredEvents = currentMatch.events.filter((evt) => {
    if (eventFilter === 'goal') return evt.type === 'goal';
    if (eventFilter === 'card') return evt.type === 'card';
    return evt.type === 'goal' || evt.type === 'card' || evt.type === 'sub' || evt.type === 'return';
  });

  const renderSpectatorRoster = (
    team: 'A' | 'B',
    ids: string[],
    streak: number
  ) => {
    const isA = team === 'A';
    const accentText = isA ? 'text-[#0D5C3B]' : 'text-[#1E3A8A]';
    const tone = isA ? 'emerald' : 'cobalt';

    return (
      <section
        aria-label={`Jogadores em campo Time ${team}`}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
      >
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className={`text-lg font-bold tracking-tight ${accentText}`}>
              Time {team}
            </h2>
            <span className="text-xs text-slate-500">
              · {ids.length} em campo
            </span>
          </div>
          {streak > 0 && (
            <span className="text-xs font-semibold text-amber-800 whitespace-nowrap">
              {streak} {streak === 1 ? 'vitória' : 'vitórias'}
            </span>
          )}
        </div>

        {ids.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 text-center">
            Aguardando definição do time.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ids.map((id) => {
              const p = playerMap.get(id);
              const name = p?.name || id;
              const suspended = isPlayerSuspended(currentMatch, id);
              const gCount = playerGoalsInMatch.get(id) || 0;
              const aCount = playerAssistsInMatch.get(id) || 0;
              const cards = playerCardsInMatch.get(id) || [];

              return (
                <li
                  key={id}
                  className={`px-4 py-2.5 min-h-[56px] flex items-center justify-between gap-3 ${
                    suspended ? 'bg-red-50/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={name}
                      photoDataUrl={p?.photoDataUrl}
                      size="sm"
                      tone={suspended ? 'crimson' : tone}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p?.position || 'Versátil'}
                        {p?.position === 'Goleiro' && hasFixedGoalkeepers && (
                          <span className="text-[#0D5C3B] font-semibold">
                            {' '}
                            · Fixo
                          </span>
                        )}
                        {suspended && (
                          <span className="text-red-700 font-semibold">
                            {' '}
                            · Suspenso (VM)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Clean unboxed in-match event summary */}
                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono font-bold tabular-nums">
                    {gCount > 0 && (
                      <span className="text-[#0D5C3B]" title="Gols na partida">
                        {gCount}G
                      </span>
                    )}
                    {aCount > 0 && (
                      <span className="text-slate-600" title="Assistências na partida">
                        {aCount}A
                      </span>
                    )}
                    {cards.map((c, idx) => (
                      <Square
                        key={`${id}_c_${idx}`}
                        aria-label={
                          c === 'yellow'
                            ? 'Cartão Amarelo'
                            : c === 'blue'
                              ? 'Cartão Azul'
                              : 'Cartão Vermelho'
                        }
                        className={`w-3.5 h-3.5 fill-current ${
                          c === 'yellow'
                            ? 'text-amber-500'
                            : c === 'blue'
                              ? 'text-blue-600'
                              : 'text-red-600'
                        }`}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5" data-testid="spectator-mode">
      {/* Public Broadcast Header */}
      <section
        aria-label="Placar ao vivo para espectadores"
        className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 ${
                  currentMatch.isRunning ? 'text-[#0D5C3B]' : 'text-slate-500'
                }`}
              >
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {displaySession.status === 'finished'
                    ? 'Sessão encerrada'
                    : currentMatch.isRunning
                      ? 'Modo Espectador · Ao vivo'
                      : 'Modo Espectador · Cronômetro pausado'}
                </span>
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-500">Acesso público</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {displaySession.name}
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Partida #{currentMatch.matchNumber} · {displaySession.dateLabel} ·{' '}
              {displaySession.playersPerTeam} vs {displaySession.playersPerTeam}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {sessions.length > 1 && (
              <select
                aria-label="Escolher sessão para assistir"
                value={displaySession.id}
                onChange={(e) => onSelectSession(e.target.value)}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 max-w-full flex-1 sm:flex-initial truncate"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status === 'finished' ? 'Encerrada' : 'Ativa'})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void handleCopySpectatorLink()}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-[#0D5C3B]" aria-hidden="true" />
                  <span>Link copiado</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Compartilhar Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Read-Only Scoreboard & Synchronized Clock */}
        <div className="py-6 grid grid-cols-3 items-center gap-2 md:gap-6 text-center">
          <div className="space-y-1">
            <p className="text-xs md:text-sm font-bold text-[#0D5C3B]">
              Time A
            </p>
            <p
              data-testid="spectator-score-a"
              className="font-display text-5xl md:text-7xl font-extrabold text-slate-900 tabular-nums leading-none"
            >
              {currentMatch.scoreA}
            </p>
            <p className="text-xs text-slate-500">
              {displaySession.teamAStreak > 0
                ? `${displaySession.teamAStreak} vit. seguidas`
                : 'Em campo'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center space-y-1.5">
            <div
              data-testid="spectator-timer"
              className={`px-4 py-2.5 rounded-2xl border font-mono text-2xl md:text-4xl font-bold tabular-nums ${
                liveSeconds === 0
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : currentMatch.isRunning
                    ? 'bg-emerald-50 border-emerald-300 text-[#0D5C3B]'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {formatClock(liveSeconds)}
            </div>
            <span className="text-xs font-medium text-slate-500">
              {liveSeconds === 0
                ? 'Tempo encerrado'
                : currentMatch.isRunning
                  ? 'Tempo correndo'
                  : 'Pausado'}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs md:text-sm font-bold text-[#1E3A8A]">
              Time B
            </p>
            <p
              data-testid="spectator-score-b"
              className="font-display text-5xl md:text-7xl font-extrabold text-slate-900 tabular-nums leading-none"
            >
              {currentMatch.scoreB}
            </p>
            <p className="text-xs text-slate-500">
              {displaySession.teamBStreak > 0
                ? `${displaySession.teamBStreak} vit. seguidas`
                : 'Em campo'}
            </p>
          </div>
        </div>
      </section>

      {/* Read-Only Punished Players Banner */}
      {activePunishments.length > 0 && (
        <section
          aria-label="Atletas suspensos na partida"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 animate-punishment"
        >
          <div className="flex items-center gap-2 text-red-800">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            <h2 className="text-lg font-bold">
              Atletas Punidos (VM) · {activePunishments.length}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePunishments.map((pun) => {
              const p = playerMap.get(pun.playerId);
              const rem = computeLivePunishmentRemaining(pun, nowMs);
              return (
                <div
                  key={pun.playerId}
                  className="bg-white border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={p?.name || pun.playerId}
                      photoDataUrl={p?.photoDataUrl}
                      size="sm"
                      tone="crimson"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {p?.name || pun.playerId}
                      </p>
                      <p className="text-xs text-red-700">
                        Time {pun.team} ·{' '}
                        {pun.reason === 'second_yellow'
                          ? '2º Amarelo'
                          : 'Cartão Vermelho'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-base font-bold tabular-nums text-red-700 shrink-0">
                    {rem > 0 ? formatClock(rem) : 'Liberado'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Spectator Grid: Rosters + Live Events + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSpectatorRoster('A', displaySession.teamA, displaySession.teamAStreak)}
          {renderSpectatorRoster('B', displaySession.teamB, displaySession.teamBStreak)}
        </div>

        <div className="lg:col-span-5 space-y-5">
          {/* Events Feed with Goals / Cards Filter */}
          <section
            aria-label="Eventos registrados na partida"
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Eventos ({filteredEvents.length})
              </h2>
              <div
                role="tablist"
                aria-label="Filtrar eventos da partida"
                className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
              >
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'goal', label: 'Gols' },
                    { id: 'card', label: 'Cartões' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={eventFilter === t.id}
                    onClick={() => setEventFilter(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      eventFilter === t.id
                        ? 'bg-white text-[#0D5C3B] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">
                Nenhum evento registrado com esse filtro até o momento.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {filteredEvents.map((evt) => (
                  <li
                    key={evt.id}
                    className="px-4 py-3 flex items-start gap-3 text-xs"
                  >
                    <span className="font-mono font-bold text-slate-500 tabular-nums shrink-0 pt-0.5">
                      {evt.minuteLabel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-medium leading-relaxed">
                        {evt.description}
                      </p>
                    </div>
                    {evt.type === 'card' && evt.cardType && (
                      <Square
                        aria-hidden="true"
                        className={`w-3.5 h-3.5 fill-current shrink-0 mt-0.5 ${
                          evt.cardType === 'yellow'
                            ? 'text-amber-500'
                            : evt.cardType === 'blue'
                              ? 'text-blue-600'
                              : 'text-red-600'
                        }`}
                      />
                    )}
                    {evt.type === 'goal' && (
                      <Trophy
                        aria-hidden="true"
                        className="w-3.5 h-3.5 text-[#0D5C3B] shrink-0 mt-0.5"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Read-Only Waiting Queue & Completed Matches */}
          <section
            aria-label="Próximos na fila e resultados anteriores"
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-lg font-bold text-slate-900">
                Próximos na Fila ({displaySession.waitingQueue.length})
              </h2>
            </div>

            {displaySession.waitingQueue.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">
                Nenhum atleta aguardando na fila.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {displaySession.waitingQueue.map((id, idx) => {
                  const p = playerMap.get(id);
                  const isPriority = displaySession.latePriorityIds.includes(id);
                  return (
                    <li
                      key={id}
                      className="px-4 py-2.5 flex items-center gap-3 text-sm"
                    >
                      <span className="font-mono text-xs font-bold text-slate-400 w-5 tabular-nums">
                        {idx + 1}.
                      </span>
                      <PlayerAvatar
                        name={p?.name || id}
                        photoDataUrl={p?.photoDataUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {p?.name || id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p?.position || 'Versátil'}
                          {isPriority && (
                            <span className="text-[#0D5C3B] font-semibold">
                              {' '}
                              · Prioridade
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {displaySession.matchHistory.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
                <h3 className="text-xs font-semibold text-slate-600">
                  Resultados desta sessão
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-slate-700 tabular-nums">
                  {displaySession.matchHistory.slice(0, 6).map((m) => (
                    <span key={m.matchNumber}>
                      J{m.matchNumber}: {m.scoreA}x{m.scoreB} (Venc. {m.winner}
                      {m.tieBreaker === 'penalties' ? ' Pên.' : ''})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
