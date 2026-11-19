import React from 'react';
import { Calendar, CheckSquare, Plus, Shuffle, Square, UserPlus } from 'lucide-react';
import type { PeladaSession, Player } from '../types/pelada';
import { PlayerAvatar } from './PlayerAvatar';

interface SessionsViewProps {
  sessions: PeladaSession[];
  activeSession: PeladaSession | null;
  players: Player[];
  onSelectActiveSession: (sessionId: string) => void;
  onOpenNewSessionModal: () => void;
  onToggleConfirmPlayer: (playerId: string) => void;
  onToggleConfirmAll: () => void;
  onDrawTeams: () => void;
  onFinishSession: () => void;
  onOpenRegisterPlayerModal: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  activeSession,
  players,
  onSelectActiveSession,
  onOpenNewSessionModal,
  onToggleConfirmPlayer,
  onToggleConfirmAll,
  onDrawTeams,
  onFinishSession,
  onOpenRegisterPlayerModal,
}) => {
  const confirmedSet = new Set(activeSession?.confirmedPlayerIds || []);
  const allConfirmed =
    players.length > 0 && players.every((p) => confirmedSet.has(p.id));

  return (
    <div className="space-y-6">
      {/* Matchday Editorial Header Banner */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[190px] flex items-end">
        <img
          src="/src/assets/images/pitch_matchday_banner_1795116917328.jpg"
          alt="Campo de futebol society da Pelada ASMETO"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20"
        />
        <div className="relative z-10 w-full p-5 md:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-300">
              {activeSession
                ? `${activeSession.dateLabel} · ${activeSession.confirmedPlayerIds.length} atletas confirmados`
                : 'Gestão de Sessões'}
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight text-balance">
              {activeSession ? activeSession.name : 'Sessões da Pelada'}
            </h1>
          </div>
          <button
            type="button"
            onClick={onOpenNewSessionModal}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold hover:bg-[#0A492F] flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nova Pelada</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Lista de Confirmação e Sorteio */}
        <section
          aria-label="Lista de confirmação e sorteio"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
        >
          {activeSession ? (
            <>
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Lista de Confirmação
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeSession.confirmedPlayerIds.length} de {players.length} atletas presentes ·{' '}
                    {activeSession.playersPerTeam} por time
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenRegisterPlayerModal}
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4 text-[#0D5C3B]" aria-hidden="true" />
                    <span>Cadastrar Atleta</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleConfirmAll}
                    aria-pressed={allConfirmed}
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {allConfirmed ? (
                      <CheckSquare className="w-4 h-4 text-[#0D5C3B]" aria-hidden="true" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    )}
                    <span>{allConfirmed ? 'Desmarcar Todos' : 'Confirmar Todos'}</span>
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {players.map((p) => {
                  const isConfirmed = confirmedSet.has(p.id);
                  const orderIndex = activeSession.registeredOrderIds.indexOf(p.id);
                  return (
                    <li key={p.id}>
                      <label className="px-4 py-2.5 min-h-[58px] flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isConfirmed}
                            onChange={() => onToggleConfirmPlayer(p.id)}
                            className="w-5 h-5 rounded border-slate-300 text-[#0D5C3B] focus:ring-[#0D5C3B]"
                          />
                          <PlayerAvatar
                            name={p.name}
                            photoDataUrl={p.photoDataUrl}
                            size="sm"
                            tone={isConfirmed ? 'emerald' : 'neutral'}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {p.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {p.position}
                              {orderIndex >= 0 && ` · Ordem #${orderIndex + 1}`}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            isConfirmed ? 'text-[#0D5C3B]' : 'text-slate-400'
                          }`}
                        >
                          {isConfirmed ? 'Presente' : 'Ausente'}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onFinishSession}
                  disabled={activeSession.status === 'finished'}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                >
                  Encerrar Sessão
                </button>
                <button
                  type="button"
                  onClick={onDrawTeams}
                  disabled={activeSession.confirmedPlayerIds.length < 2}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold hover:bg-[#0A492F] disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                >
                  <Shuffle className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {activeSession.drawDone
                      ? 'Refazer Sorteio e Ir para Partida'
                      : 'Sortear Times por Ordem'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              Crie uma nova pelada para começar a confirmar os atletas.
            </div>
          )}
        </section>

        {/* Right: Histórico de Sessões */}
        <section
          aria-label="Histórico de sessões"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
        >
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Histórico de Sessões
            </h2>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {sessions.length} sessões
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => {
              const isSelected = s.id === activeSession?.id;
              return (
                <li key={s.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {s.dateLabel} · {s.confirmedPlayerIds.length} atletas confirmados ·{' '}
                          {s.matchesCompleted} partidas
                        </span>
                      </p>
                      <p className="text-xs font-semibold">
                        <span
                          className={
                            s.status === 'finished'
                              ? 'text-slate-500'
                              : 'text-[#0D5C3B]'
                          }
                        >
                          {s.status === 'finished' ? 'Finalizada' : 'Em andamento'}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectActiveSession(s.id)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#0D5C3B] text-white'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? 'Selecionada' : 'Abrir'}
                    </button>
                  </div>

                  {s.matchHistory.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
                      {s.matchHistory.slice(0, 3).map((m) => (
                        <span key={m.matchNumber}>
                          J{m.matchNumber}: {m.scoreA}x{m.scoreB} (Venc. {m.winner}
                          {m.tieBreaker === 'penalties' ? ' Pên.' : ''})
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
};
