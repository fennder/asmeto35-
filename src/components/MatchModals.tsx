import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Trash2, X } from 'lucide-react';
import type { CardType, PeladaSession, Player, PlayerPosition } from '../types/pelada';
import { isPlayerSuspended } from '../utils/peladaRules';
import { PlayerAvatar } from './PlayerAvatar';

function compressImageToDataUrl(
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number
): string {
  const maxDim = 220;
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight, 1));
  const targetW = Math.max(64, Math.round(srcWidth * scale));
  const targetH = Math.max(64, Math.round(srcHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.78);
}

/* 1. GOAL + MANDATORY ASSIST MODAL */
interface GoalModalProps {
  open: boolean;
  session: PeladaSession;
  playerMap: Map<string, Player>;
  defaultTeam?: 'A' | 'B';
  onClose: () => void;
  onConfirm: (team: 'A' | 'B', scorerId: string, assistId?: string) => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  open,
  session,
  playerMap,
  defaultTeam = 'A',
  onClose,
  onConfirm,
}) => {
  const [team, setTeam] = useState<'A' | 'B'>(defaultTeam);
  const [scorerId, setScorerId] = useState('');
  const [assistId, setAssistId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTeam(defaultTeam);
      setScorerId('');
      setAssistId('');
      setError('');
    }
  }, [open, defaultTeam]);

  if (!open) return null;

  const rosterIds = (team === 'A' ? session.teamA : session.teamB).filter(
    (id) => !isPlayerSuspended(session.currentMatch, id)
  );
  const assistCandidates = rosterIds.filter((id) => id !== scorerId);
  const assistRequired = rosterIds.length > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scorerId) {
      setError('Selecione o autor do gol.');
      return;
    }
    if (assistRequired && !assistId) {
      setError('A atribuição da assistência é obrigatória.');
      return;
    }
    onConfirm(team, scorerId, assistRequired ? assistId : undefined);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="goal-modal-title" className="text-xl font-bold text-slate-900">
            Registrar Gol e Assistência
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de gol"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <span className="block text-xs font-semibold text-slate-600 mb-2">
              Equipe que marcou
            </span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setTeam('A');
                  setScorerId('');
                  setAssistId('');
                }}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                  team === 'A'
                    ? 'bg-[#0D5C3B] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Time A
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeam('B');
                  setScorerId('');
                  setAssistId('');
                }}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                  team === 'B'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Time B
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="goal-scorer-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Autor do Gol
            </label>
            <select
              id="goal-scorer-select"
              value={scorerId}
              onChange={(e) => {
                setScorerId(e.target.value);
                if (e.target.value === assistId) setAssistId('');
                setError('');
              }}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C3B]"
            >
              <option value="">Selecione quem marcou o gol</option>
              {rosterIds.map((id) => {
                const p = playerMap.get(id);
                return (
                  <option key={id} value={id}>
                    {p?.name || id}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="goal-assist-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Assistência {assistRequired ? '(obrigatório)' : '(opcional)'}
            </label>
            <select
              id="goal-assist-select"
              value={assistId}
              onChange={(e) => {
                setAssistId(e.target.value);
                setError('');
              }}
              disabled={!scorerId || !assistRequired}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D5C3B]"
            >
              <option value="">Selecione quem deu a assistência</option>
              {assistCandidates.map((id) => {
                const p = playerMap.get(id);
                return (
                  <option key={id} value={id}>
                    {p?.name || id}
                  </option>
                );
              })}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold hover:bg-[#0A492F]"
            >
              Confirmar Gol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 2. CARD MODAL */
interface CardModalProps {
  open: boolean;
  session: PeladaSession;
  playerMap: Map<string, Player>;
  onClose: () => void;
  onConfirm: (team: 'A' | 'B', playerId: string, cardType: CardType) => void;
}

export const CardModal: React.FC<CardModalProps> = ({
  open,
  session,
  playerMap,
  onClose,
  onConfirm,
}) => {
  const [team, setTeam] = useState<'A' | 'B'>('A');
  const [playerId, setPlayerId] = useState('');
  const [cardType, setCardType] = useState<CardType>('yellow');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTeam('A');
      setPlayerId('');
      setCardType('yellow');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const rosterIds = team === 'A' ? session.teamA : session.teamB;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      setError('Selecione o atleta que receberá o cartão.');
      return;
    }
    onConfirm(team, playerId, cardType);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="card-modal-title" className="text-xl font-bold text-slate-900">
            Registrar Cartão
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de cartão"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTeam('A');
                setPlayerId('');
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${
                team === 'A' ? 'bg-[#0D5C3B] text-white' : 'text-slate-700'
              }`}
            >
              Time A
            </button>
            <button
              type="button"
              onClick={() => {
                setTeam('B');
                setPlayerId('');
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${
                team === 'B' ? 'bg-[#1E3A8A] text-white' : 'text-slate-700'
              }`}
            >
              Time B
            </button>
          </div>

          <div>
            <label
              htmlFor="card-player-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Atleta
            </label>
            <select
              id="card-player-select"
              value={playerId}
              onChange={(e) => {
                setPlayerId(e.target.value);
                setError('');
              }}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
            >
              <option value="">Selecione o atleta</option>
              {rosterIds.map((id) => {
                const p = playerMap.get(id);
                const yellows = session.currentMatch.yellowCountsInMatch[id] ?? 0;
                return (
                  <option key={id} value={id}>
                    {p?.name || id} {yellows > 0 ? `(${yellows} CA na partida)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Tipo de Cartão
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCardType('yellow')}
                className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                  cardType === 'yellow'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                Amarelo (CA)
              </button>
              <button
                type="button"
                onClick={() => setCardType('blue')}
                className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                  cardType === 'blue'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-blue-50 text-blue-900 border-blue-200'
                }`}
              >
                Azul
              </button>
              <button
                type="button"
                onClick={() => setCardType('red')}
                className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                  cardType === 'red'
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-red-50 text-red-900 border-red-200'
                }`}
              >
                Vermelho (CV)
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cartão Vermelho ou 2º Amarelo suspende o atleta por{' '}
              {session.punishmentDurationSeconds}s sem possibilidade de substituição.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Aplicar Cartão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 3. TIE-BREAKER / END MATCH MODAL */
interface TieBreakerModalProps {
  open: boolean;
  scoreA: number;
  scoreB: number;
  onClose: () => void;
  onResolve: (
    winner: 'A' | 'B',
    tieBreaker: 'penalties' | 'declared',
    penaltyScoreA?: number,
    penaltyScoreB?: number
  ) => void;
}

export const TieBreakerModal: React.FC<TieBreakerModalProps> = ({
  open,
  scoreA,
  scoreB,
  onClose,
  onResolve,
}) => {
  const [mode, setMode] = useState<'penalties' | 'declared'>('penalties');
  const [penA, setPenA] = useState(3);
  const [penB, setPenB] = useState(2);
  const [declaredWinner, setDeclaredWinner] = useState<'A' | 'B'>('A');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (mode === 'penalties') {
      if (penA === penB) {
        setError('Defina um placar vencedor nos pênaltis (não pode terminar empatado).');
        return;
      }
      onResolve('penalties' === mode ? (penA > penB ? 'A' : 'B') : 'A', 'penalties', penA, penB);
      return;
    }
    onResolve(declaredWinner, 'declared');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tie-modal-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="tie-modal-title" className="text-xl font-bold text-slate-900">
            Empate ({scoreA} x {scoreB}) — Definir Campeão
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de desempate"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('penalties');
                setError('');
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${
                mode === 'penalties' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
            >
              Pênaltis
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('declared');
                setError('');
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${
                mode === 'declared' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
            >
              Declarar Campeã
            </button>
          </div>

          {mode === 'penalties' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="text-xs font-semibold text-[#0D5C3B]">Pênaltis Time A</span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label="Diminuir pênaltis Time A"
                    onClick={() => setPenA((v) => Math.max(0, v - 1))}
                    className="w-10 h-10 rounded-lg border border-slate-200 font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono text-2xl font-bold tabular-nums">{penA}</span>
                  <button
                    type="button"
                    aria-label="Aumentar pênaltis Time A"
                    onClick={() => setPenA((v) => v + 1)}
                    className="w-10 h-10 rounded-lg border border-slate-200 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="text-xs font-semibold text-[#1E3A8A]">Pênaltis Time B</span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label="Diminuir pênaltis Time B"
                    onClick={() => setPenB((v) => Math.max(0, v - 1))}
                    className="w-10 h-10 rounded-lg border border-slate-200 font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono text-2xl font-bold tabular-nums">{penB}</span>
                  <button
                    type="button"
                    aria-label="Aumentar pênaltis Time B"
                    onClick={() => setPenB((v) => v + 1)}
                    className="w-10 h-10 rounded-lg border border-slate-200 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeclaredWinner('A')}
                className={`min-h-[52px] rounded-xl border font-bold text-sm ${
                  declaredWinner === 'A'
                    ? 'bg-[#0D5C3B] text-white border-[#0D5C3B]'
                    : 'bg-white text-slate-800 border-slate-200'
                }`}
              >
                Declarar Time A
              </button>
              <button
                type="button"
                onClick={() => setDeclaredWinner('B')}
                className={`min-h-[52px] rounded-xl border font-bold text-sm ${
                  declaredWinner === 'B'
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-slate-800 border-slate-200'
                }`}
              >
                Declarar Time B
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold"
            >
              Encerrar e Rotacionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 4. TIMER CONFIG MODAL */
interface TimerConfigModalProps {
  open: boolean;
  matchDurationSeconds: number;
  punishmentDurationSeconds: number;
  onClose: () => void;
  onSave: (matchSecs: number, punishmentSecs: number) => void;
}

export const TimerConfigModal: React.FC<TimerConfigModalProps> = ({
  open,
  matchDurationSeconds,
  punishmentDurationSeconds,
  onClose,
  onSave,
}) => {
  const [matchMins, setMatchMins] = useState(Math.round(matchDurationSeconds / 60));
  const [punishSecs, setPunishSecs] = useState(punishmentDurationSeconds);

  useEffect(() => {
    if (open) {
      setMatchMins(Math.round(matchDurationSeconds / 60));
      setPunishSecs(punishmentDurationSeconds);
    }
  }, [open, matchDurationSeconds, punishmentDurationSeconds]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timer-config-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="timer-config-title" className="text-lg font-bold text-slate-900">
            Configurar Cronômetros
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações de tempo"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(
              Math.max(1, Math.min(90, matchMins)) * 60,
              Math.max(15, Math.min(600, punishSecs))
            );
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label htmlFor="cfg-match-mins" className="block text-xs font-semibold text-slate-700 mb-1">
              Duração da Partida (minutos)
            </label>
            <input
              id="cfg-match-mins"
              type="number"
              min={1}
              max={90}
              value={matchMins}
              onChange={(e) => setMatchMins(Number(e.target.value) || 10)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="cfg-punish-secs" className="block text-xs font-semibold text-slate-700 mb-1">
              Tempo de Punição VM (segundos)
            </label>
            <input
              id="cfg-punish-secs"
              type="number"
              min={15}
              max={600}
              value={punishSecs}
              onChange={(e) => setPunishSecs(Number(e.target.value) || 90)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 5. ATHLETE REGISTRATION + CAMERA MODAL */
interface AthleteModalProps {
  open: boolean;
  editingPlayer: Player | null;
  onClose: () => void;
  onSave: (data: { name: string; position: PlayerPosition; photoDataUrl: string }) => void;
}

export const AthleteModal: React.FC<AthleteModalProps> = ({
  open,
  editingPlayer,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('Meio');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [formError, setFormError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (open) {
      setName(editingPlayer?.name || '');
      setPosition(editingPlayer?.position || 'Meio');
      setPhotoDataUrl(editingPlayer?.photoDataUrl || '');
      setCameraError('');
      setFormError('');
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, editingPlayer]);

  if (!open) return null;

  const startWebcam = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não disponível neste navegador. Use enviar foto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraError('Permissão de câmera indisponível. Envie uma imagem pelo arquivo.');
    }
  };

  const captureFromWebcam = () => {
    if (!videoRef.current) return;
    const vw = videoRef.current.videoWidth || 320;
    const vh = videoRef.current.videoHeight || 320;
    const dataUrl = compressImageToDataUrl(videoRef.current, vw, vh);
    if (dataUrl) {
      setPhotoDataUrl(dataUrl);
    }
    stopCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToDataUrl(img, img.width, img.height);
        if (compressed) setPhotoDataUrl(compressed);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Informe o nome completo do atleta.');
      return;
    }
    stopCamera();
    onSave({ name: name.trim(), position, photoDataUrl });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="athlete-modal-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="athlete-modal-title" className="text-xl font-bold text-slate-900">
            {editingPlayer ? 'Editar Atleta' : 'Cadastrar Atleta'}
          </h2>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Fechar cadastro de atleta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-4">
            <PlayerAvatar name={name || 'Atleta'} photoDataUrl={photoDataUrl} size="lg" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startWebcam}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-1.5 hover:bg-slate-100"
              >
                <Camera className="w-4 h-4 text-[#0D5C3B]" aria-hidden="true" />
                <span>Tirar Foto</span>
              </button>
              <label className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50">
                <ImagePlus className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>Câmera / Galeria</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl('')}
                  aria-label="Remover foto do atleta"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {cameraActive && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 space-y-2 p-2">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-48 object-cover rounded-xl bg-black"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 min-h-[44px] rounded-xl bg-slate-700 text-white text-xs font-semibold"
                >
                  Cancelar Câmera
                </button>
                <button
                  type="button"
                  onClick={captureFromWebcam}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#0D5C3B] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Capturar Foto
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {cameraError}
            </p>
          )}

          <div>
            <label htmlFor="athlete-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome do Atleta
            </label>
            <input
              id="athlete-name-input"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormError('');
              }}
              placeholder="Ex: Gabriel Martins"
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C3B]"
            />
          </div>

          <div>
            <label htmlFor="athlete-pos-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Posição Principal
            </label>
            <select
              id="athlete-pos-select"
              value={position}
              onChange={(e) => setPosition(e.target.value as PlayerPosition)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
            >
              <option value="Goleiro">Goleiro</option>
              <option value="Defesa">Defesa</option>
              <option value="Meio">Meio</option>
              <option value="Atacante">Atacante</option>
              <option value="Versátil">Versátil</option>
            </select>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold hover:bg-[#0A492F]"
            >
              Salvar Atleta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 6. NEW SESSION MODAL */
interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (cfg: {
    name: string;
    dateLabel: string;
    playersPerTeam: number;
    matchDurationSeconds: number;
    punishmentDurationSeconds: number;
    maxWinStreak: number;
  }) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [dateLabel, setDateLabel] = useState(
    new Date().toLocaleDateString('pt-BR')
  );
  const [playersPerTeam, setPlayersPerTeam] = useState(7);
  const [matchMins, setMatchMins] = useState(10);
  const [punishSecs, setPunishSecs] = useState(90);
  const [maxWins, setMaxWins] = useState(3);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDateLabel(new Date().toLocaleDateString('pt-BR'));
      setPlayersPerTeam(7);
      setMatchMins(10);
      setPunishSecs(90);
      setMaxWins(3);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da pelada (ex: Pelada de Quarta).');
      return;
    }
    onCreate({
      name: name.trim(),
      dateLabel: dateLabel.trim() || new Date().toLocaleDateString('pt-BR'),
      playersPerTeam: Math.max(1, Math.min(11, playersPerTeam)),
      matchDurationSeconds: Math.max(1, Math.min(90, matchMins)) * 60,
      punishmentDurationSeconds: Math.max(15, Math.min(600, punishSecs)),
      maxWinStreak: Math.max(1, Math.min(10, maxWins)),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-session-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="new-session-title" className="text-xl font-bold text-slate-900">
            Criar Nova Pelada
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal nova pelada"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="session-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Sessão
            </label>
            <input
              id="session-name-input"
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Ex: Pelada de Quarta"
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="session-date-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Data
              </label>
              <input
                id="session-date-input"
                type="text"
                maxLength={40}
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="session-per-team" className="block text-xs font-semibold text-slate-700 mb-1">
                Atletas por Time
              </label>
              <input
                id="session-per-team"
                type="number"
                min={1}
                max={11}
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(Number(e.target.value) || 7)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="session-mins" className="block text-xs font-semibold text-slate-700 mb-1">
                Tempo (min)
              </label>
              <input
                id="session-mins"
                type="number"
                min={1}
                max={90}
                value={matchMins}
                onChange={(e) => setMatchMins(Number(e.target.value) || 10)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="session-punish" className="block text-xs font-semibold text-slate-700 mb-1">
                Punição (s)
              </label>
              <input
                id="session-punish"
                type="number"
                min={15}
                max={600}
                value={punishSecs}
                onChange={(e) => setPunishSecs(Number(e.target.value) || 90)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="session-streak" className="block text-xs font-semibold text-slate-700 mb-1">
                Máx. Vitórias
              </label>
              <input
                id="session-streak"
                type="number"
                min={1}
                max={10}
                value={maxWins}
                onChange={(e) => setMaxWins(Number(e.target.value) || 3)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold"
            >
              Criar Pelada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
