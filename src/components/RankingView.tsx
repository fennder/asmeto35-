import React, { useState } from 'react';
import type { Player, RankingCategory } from '../types/pelada';
import { computeApprovalRate, sortPlayersForRanking } from '../utils/peladaRules';
import { PlayerAvatar } from './PlayerAvatar';

interface RankingViewProps {
  players: Player[];
}

const RANKING_TABS: Array<{ id: RankingCategory; label: string; subtitle: string }> = [
  { id: 'gol', label: 'Gol', subtitle: 'Artilharia geral da Pelada ASMETO' },
  { id: 'assistencia', label: 'Assistência', subtitle: 'Líderes em passes para gol' },
  { id: 'disciplinado', label: 'Disciplinado', subtitle: 'Menor índice de cartões (CA, Azul, CV)' },
  { id: 'aproveitamento', label: 'Aproveitamento', subtitle: 'Percentual de vitórias por partidas jogadas' },
];

export const RankingView: React.FC<RankingViewProps> = ({ players }) => {
  const [category, setCategory] = useState<RankingCategory>('gol');
  const sorted = sortPlayersForRanking(players, category);
  const activeMeta = RANKING_TABS.find((t) => t.id === category)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Ranking Público
          </h1>
          <p className="text-sm text-slate-500">{activeMeta.subtitle}</p>
        </div>

        {/* Segmented Category Filter */}
        <div
          role="tablist"
          aria-label="Critérios de ranking"
          className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-full"
        >
          {RANKING_TABS.map((tab) => {
            const isActive = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(tab.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-[#0D5C3B] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Highlight Strip */}
      {sorted.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sorted.slice(0, 3).map((p, index) => {
            const apr = computeApprovalRate(p);
            const highlightValue =
              category === 'gol'
                ? `${p.goals} gols`
                : category === 'assistencia'
                  ? `${p.assists} assist.`
                  : category === 'disciplinado'
                    ? `${p.yellowCards} CA · ${p.redCards} CV`
                    : `${apr}% (${p.wins}V)`;
            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-display text-2xl font-extrabold text-[#0D5C3B] w-6 tabular-nums">
                    {index + 1}º
                  </span>
                  <PlayerAvatar
                    name={p.name}
                    photoDataUrl={p.photoDataUrl}
                    size="md"
                    tone="emerald"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.position} · {p.matchesPlayed} {p.matchesPlayed === 1 ? 'jogo' : 'jogos'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                  {highlightValue}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Public Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th scope="col" className="py-3 px-4 w-12">#</th>
                <th scope="col" className="py-3 px-4">Atleta</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">JOG</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">GOL</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">AST</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">CA</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">CV</th>
                <th scope="col" className="py-3 px-3 text-right font-mono">VIT</th>
                <th scope="col" className="py-3 px-4 text-right font-mono">APR %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sorted.map((p, idx) => {
                const apr = computeApprovalRate(p);
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar
                          name={p.name}
                          photoDataUrl={p.photoDataUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-none">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.position}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums">
                      {p.matchesPlayed}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {p.goals}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                      {p.assists}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700 tabular-nums">
                      {p.yellowCards}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-red-700 tabular-nums">
                      {p.redCards}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-800 tabular-nums">
                      {p.wins}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#0D5C3B] tabular-nums">
                      {apr}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
