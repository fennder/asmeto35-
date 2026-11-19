import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Square,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { PeladaSession, Player } from '../types/pelada';
import { formatClock, isPlayerSuspended } from '../utils/peladaRules';
import { PlayerAvatar } from './PlayerAvatar';

interface MatchDayViewProps {
  session: PeladaSession | null;
  players: Player[];
  playerMap: Map<string, Player>;
  feedbackMessage: string | null;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onOpenTimerConfig: () => void;
  onOpenGoalModal: (defaultTeam?: 'A' | 'B') => void;
  onOpenCardModal: () => void;
  onSubstitutePlayer: (playerId: string) => void;
  onRemovePlayerFromMatch: (playerId: string) => void;
  onReturnPunished: (playerId: string) => void;
  onAddPlayerToQueue: (playerId: string) => void;
  onOpenNewLateAthleteModal: () => void;
  onFinishMatch: (winner?: 'A' | 'B') => void;
  onGoToSessions: () => void;
}

export const MatchDayView: React.FC<MatchDayViewProps> = ({
  session,
  players,
  playerMap,
  feedbackMessage,
  onToggleTimer,
  onResetTimer,
  onOpenTimerConfig,
  onOpenGoalModal,
  onOpenCardModal,
  onSubstitutePlayer,
  onRemovePlayerFromMatch,
  onReturnPunished,
  onAddPlayerToQueue,
  onOpenNewLateAthleteModal,
  onFinishMatch,
  onGoToSessions,
}) => {
  const [selectedQueueAddId, setSelectedQueueAddId] = useState('');

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Nenhuma Pelada Ativa</h1>
        <p className="text-sm text-slate-600">
          Crie uma nova sessão ou selecione uma pelada na aba Sessões para iniciar o sorteio e a partida.
        </p>
        <button
          type="button"
          onClick={onGoToSessions}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold"
        >
          Ir para Sessões
        </button>
      </div>
    );
  }

  const { currentMatch } = session;
  const activePunishments = currentMatch.punishments.filter((p) => !p.returned);
  const notInMatchPlayers = players.filter(
    (p) =>
      !session.teamA.includes(p.id) &&
      !session.teamB.includes(p.id) &&
      !session.waitingQueue.includes(p.id)
  );
  const gkIds = new Set(
    players.filter((p) => p.position === 'Goleiro').map((p) => p.id)
  );
  const activeGks = Array.from(
    new Set([...session.teamA, ...session.teamB, ...session.waitingQueue])
  ).filter((id) => gkIds.has(id));
  const hasFixedGoalkeepers = activeGks.length > 0 && activeGks.length <= 2;

  const isTimeWarning = currentMatch.remainingSeconds <= 60 && currentMatch.remainingSeconds > 0;
  const isTimeUp = currentMatch.remainingSeconds === 0;
  const canEndDirect = currentMatch.scoreA !== currentMatch.scoreB;

  const renderRoster = (team: 'A' | 'B', ids: string[], streak: number) => {
    const isTeamA = team === 'A';
    const accentText = isTeamA ? 'text-[#0D5C3B]' : 'text-[#1E3A8A]';
    const tone = isTeamA ? 'emerald' : 'cobalt';

    return (
      <section
        aria-label={`Escalação Time ${team}`}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={`text-lg font-bold tracking-tight ${accentText}`}>
              Time {team}
            </h3>
            <span className="text-xs text-slate-500">
              · {ids.length}/{session.playersPerTeam} em campo
            </span>
          </div>
          {streak > 0 && (
            <span className="text-xs font-semibold text-amber-800 whitespace-nowrap">
              {streak} {streak === 1 ? 'vitória seguida' : 'vitórias seguidas'}
            </span>
          )}
        </div>

        {ids.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Nenhum atleta escalado. Realize o sorteio na aba Sessões.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ids.map((id) => {
              const p = playerMap.get(id);
              const name = p?.name || id;
              const suspended = isPlayerSuspended(currentMatch, id);
              const yellowCount = currentMatch.yellowCountsInMatch[id] ?? 0;
              const isGk = p?.position === 'Goleiro';
              const isFixedGk =
                isGk &&
                hasFixedGoalkeepers &&
                !session.waitingQueue.some((qid) => gkIds.has(qid));

              return (
                <li
                  key={id}
                  className={`px-4 py-2.5 min-h-[60px] flex items-center justify-between gap-3 ${
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
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>{p?.position || 'Versátil'}</span>
                        {isFixedGk && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#0D5C3B]">
                              Fixo
                            </span>
                          </>
                        )}
                        {yellowCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-amber-700">
                              {yellowCount} CA
                            </span>
                          </>
                        )}
                        {suspended && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-red-700">
                              Punido VM
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSubstitutePlayer(id)}
                      disabled={
                        suspended ||
                        session.waitingQueue.length === 0 ||
                        isFixedGk
                      }
                      aria-label={`Substituir ${name}`}
                      title={
                        suspended
                          ? 'Atleta punido não pode ser substituído'
                          : isFixedGk
                            ? 'Goleiro fixo na partida (até 2 goleiros)'
                            : session.waitingQueue.length === 0
                              ? 'Sem atletas na fila de espera'
                              : 'Substituir pelo próximo da fila'
                      }
                      className="min-h-[44px] px-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Substituir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemovePlayerFromMatch(id)}
                      aria-label={`Remover ${name} da partida`}
                      title="Remover da partida (chama próximo da fila)"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
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
    <div className="space-y-5">
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-950 text-white px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between gap-3"
        >
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Focal Anchor: Scoreboard + Match Clock */}
      <section
        aria-label="Placar e cronômetro da partida"
        className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {session.name}
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Partida #{currentMatch.matchNumber} · {session.playersPerTeam} vs{' '}
              {session.playersPerTeam} · Máx. {session.maxWinStreak} vitórias seguidas
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenTimerConfig}
            aria-label="Configurar tempos da partida"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" />
            <span>Tempos</span>
          </button>
        </div>

        {/* Scoreboard Grid */}
        <div className="py-5 grid grid-cols-3 items-center gap-2 md:gap-6 text-center">
          {/* Team A */}
          <div className="space-y-1">
            <p className="text-xs md:text-sm font-bold text-[#0D5C3B] tracking-wide">
              Time A
            </p>
            <p
              data-testid="score-a"
              className="font-display text-5xl md:text-6xl font-extrabold text-slate-900 tabular-nums leading-none"
            >
              {currentMatch.scoreA}
            </p>
            <p className="text-xs text-slate-500">
              {session.teamAStreak > 0 ? `Sequência: ${session.teamAStreak}` : 'Desafiante'}
            </p>
          </div>

          {/* Center Countdown Clock */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div
              data-testid="match-timer"
              className={`px-4 py-2 rounded-2xl border font-mono text-2xl md:text-4xl font-bold tabular-nums transition-colors ${
                isTimeUp
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : isTimeWarning
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : currentMatch.isRunning
                      ? 'bg-emerald-50 border-emerald-300 text-[#0D5C3B]'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {formatClock(currentMatch.remainingSeconds)}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleTimer}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  currentMatch.isRunning
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#0D5C3B] hover:bg-[#0A492F]'
                }`}
              >
                {currentMatch.isRunning ? (
                  <>
                    <Pause className="w-4 h-4" aria-hidden="true" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" aria-hidden="true" />
                    <span>Iniciar</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onResetTimer}
                aria-label="Reiniciar cronômetro"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Team B */}
          <div className="space-y-1">
            <p className="text-xs md:text-sm font-bold text-[#1E3A8A] tracking-wide">
              Time B
            </p>
            <p
              data-testid="score-b"
              className="font-display text-5xl md:text-6xl font-extrabold text-slate-900 tabular-nums leading-none"
            >
              {currentMatch.scoreB}
            </p>
            <p className="text-xs text-slate-500">
              {session.teamBStreak > 0 ? `Sequência: ${session.teamBStreak}` : 'Desafiante'}
            </p>
          </div>
        </div>

        {/* Guided Match Event Actions */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => onOpenGoalModal('A')}
            className="min-h-[46px] px-3 py-2 rounded-xl bg-[#0D5C3B] text-white text-xs md:text-sm font-semibold hover:bg-[#0A492F] flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Registrar Gol</span>
          </button>
          <button
            type="button"
            onClick={onOpenCardModal}
            className="min-h-[46px] px-3 py-2 rounded-xl bg-amber-500 text-white text-xs md:text-sm font-semibold hover:bg-amber-600 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Registrar Cartão</span>
          </button>
          <button
            type="button"
            onClick={() => onFinishMatch('A')}
            className="min-h-[46px] px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[#0D5C3B] text-xs md:text-sm font-semibold hover:bg-emerald-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Award className="w-4 h-4" aria-hidden="true" />
            <span>Vencedor A</span>
          </button>
          <button
            type="button"
            onClick={() => onFinishMatch('B')}
            className="min-h-[46px] px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-[#1E3A8A] text-xs md:text-sm font-semibold hover:bg-blue-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Award className="w-4 h-4" aria-hidden="true" />
            <span>Vencedor B</span>
          </button>
          <button
            type="button"
            onClick={() => onFinishMatch()}
            className="col-span-2 sm:col-span-1 min-h-[46px] px-3 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-semibold hover:bg-slate-800 whitespace-nowrap"
          >
            {canEndDirect ? 'Encerrar' : 'Encerrar (Empate)'}
          </button>
        </div>
      </section>

      {/* Punished Players List (VM) */}
      {activePunishments.length > 0 && (
        <section
          aria-label="Jogadores punidos em suspensão"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 animate-punishment"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              <h2 className="text-lg font-bold">
                Jogadores Punidos (VM) · {activePunishments.length}
              </h2>
            </div>
            <span className="text-xs font-medium text-red-700">
              Sem substituição até o retorno
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePunishments.map((pun) => {
              const player = playerMap.get(pun.playerId);
              const canReturn = pun.remainingSeconds <= 0;
              return (
                <div
                  key={pun.playerId}
                  className="bg-white border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={player?.name || pun.playerId}
                      photoDataUrl={player?.photoDataUrl}
                      size="sm"
                      tone="crimson"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {player?.name || pun.playerId}
                      </p>
                      <p className="text-xs text-red-700">
                        Time {pun.team} ·{' '}
                        {pun.reason === 'second_yellow'
                          ? '2º Amarelo'
                          : 'Cartão Vermelho'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-base font-bold tabular-nums text-red-700">
                      {formatClock(pun.remainingSeconds)}
                    </span>
                    <button
                      type="button"
                      disabled={!canReturn}
                      onClick={() => onReturnPunished(pun.playerId)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#0D5C3B] text-white text-xs font-semibold disabled:bg-slate-200 disabled:text-slate-500 flex items-center gap-1 whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Retornar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Content Grid: Pitch Teams (left/center) + Waiting Queue & Events (right on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderRoster('A', session.teamA, session.teamAStreak)}
          {renderRoster('B', session.teamB, session.teamBStreak)}
        </div>

        <div className="lg:col-span-4 space-y-5">
          {/* Waiting Queue */}
          <section
            aria-label="Fila de espera"
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
              <h2 className="text-lg font-bold text-slate-900">
                Fila de Espera ({session.waitingQueue.length})
              </h2>
              <button
                type="button"
                onClick={onOpenNewLateAthleteModal}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#0D5C3B] hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Novo na Fila</span>
              </button>
            </div>

            {notInMatchPlayers.length > 0 && (
              <div className="p-3 border-b border-slate-100 flex gap-2">
                <select
                  aria-label="Selecionar atleta cadastrado para entrar na fila"
                  value={selectedQueueAddId}
                  onChange={(e) => setSelectedQueueAddId(e.target.value)}
                  className="flex-1 min-h-[44px] px-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                >
                  <option value="">Incluir atleta na fila (prioridade)</option>
                  {notInMatchPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedQueueAddId}
                  onClick={() => {
                    if (selectedQueueAddId) {
                      onAddPlayerToQueue(selectedQueueAddId);
                      setSelectedQueueAddId('');
                    }
                  }}
                  className="min-h-[44px] px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  Incluir
                </button>
              </div>
            )}

            {session.waitingQueue.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">
                Nenhum atleta aguardando na fila.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {session.waitingQueue.map((id, idx) => {
                  const p = playerMap.get(id);
                  const isPriority = session.latePriorityIds.includes(id);
                  return (
                    <li
                      key={id}
                      className="px-4 py-2.5 min-h-[54px] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-400 w-5 tabular-nums">
                          {idx + 1}.
                        </span>
                        <PlayerAvatar
                          name={p?.name || id}
                          photoDataUrl={p?.photoDataUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {p?.name || id}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p?.position || 'Versátil'}
                            {isPriority && (
                              <span className="text-[#0D5C3B] font-semibold">
                                {' '}
                                · Prioridade (atrasado)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePlayerFromMatch(id)}
                        aria-label={`Remover ${p?.name || id} da fila`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Match Events Log */}
          <section
            aria-label="Linha do tempo da partida"
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-lg font-bold text-slate-900">
                Eventos da Partida ({currentMatch.events.length})
              </h2>
            </div>
            {currentMatch.events.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">
                Nenhum evento registrado ainda nesta partida.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {currentMatch.events.map((evt) => (
                  <li key={evt.id} className="px-4 py-2.5 flex items-start gap-2.5 text-xs">
                    <span className="font-mono font-bold text-slate-500 tabular-nums shrink-0 pt-0.5">
                      {evt.minuteLabel}
                    </span>
                    <span className="text-slate-800 leading-relaxed">
                      {evt.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
