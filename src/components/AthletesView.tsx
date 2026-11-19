import React, { useState } from 'react';
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Player } from '../types/pelada';
import { computeApprovalRate } from '../utils/peladaRules';
import { PlayerAvatar } from './PlayerAvatar';

interface AthletesViewProps {
  players: Player[];
  onAddAthlete: () => void;
  onEditAthlete: (player: Player) => void;
  onDeleteAthlete: (playerId: string) => void;
  onExportCsv: () => void;
}

export const AthletesView: React.FC<AthletesViewProps> = ({
  players,
  onAddAthlete,
  onEditAthlete,
  onDeleteAthlete,
  onExportCsv,
}) => {
  const [search, setSearch] = useState('');

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    p.position.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Base de Atletas
          </h1>
          <p className="text-sm text-slate-500">
            {players.length} atletas registrados · Estatísticas acumuladas e exportação CSV com foto
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-600" aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={onAddAthlete}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0D5C3B] text-white text-sm font-semibold hover:bg-[#0A492F] flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo Atleta</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar atleta por nome ou posição"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar atleta ou posição..."
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C3B]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Nenhum atleta encontrado com esse filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const apr = computeApprovalRate(p);
            return (
              <article
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={p.name}
                      photoDataUrl={p.photoDataUrl}
                      size="md"
                      tone="emerald"
                    />
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 truncate font-sans">
                        {p.name}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {p.position} · {p.matchesPlayed} jogos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditAthlete(p)}
                      aria-label={`Editar ${p.name}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAthlete(p.id)}
                      aria-label={`Excluir ${p.name}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-5 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500">GOL</dt>
                    <dd className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {p.goals}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500">AST</dt>
                    <dd className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {p.assists}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500">CA</dt>
                    <dd className="font-mono text-sm font-bold text-amber-700 tabular-nums">
                      {p.yellowCards}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500">CV</dt>
                    <dd className="font-mono text-sm font-bold text-red-700 tabular-nums">
                      {p.redCards}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500">APR</dt>
                    <dd className="font-mono text-sm font-bold text-[#0D5C3B] tabular-nums">
                      {apr}%
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
