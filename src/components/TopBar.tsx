import React from 'react';
import { CalendarDays, Eye, LogIn, LogOut, Timer, Trophy, Users } from 'lucide-react';

export type AppTab = 'partida' | 'espectador' | 'sessoes' | 'atletas' | 'ranking';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  userDisplayName: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'partida', label: 'Partida', Icon: Timer },
  { id: 'espectador', label: 'Espectador', Icon: Eye },
  { id: 'sessoes', label: 'Sessões', Icon: CalendarDays },
  { id: 'atletas', label: 'Atletas', Icon: Users },
  { id: 'ranking', label: 'Ranking', Icon: Trophy },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  userDisplayName,
  onSignIn,
  onSignOut,
}) => {
  return (
    <>
      {/* Desktop Top Bar (3-zone contract) + Compact Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-13 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('partida');
            }}
            className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
          >
            Pelada ASMETO
          </a>

          {/* Zone 2: 5 single-line nav links (Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6"
          >
            {NAV_ITEMS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-[#0D5C3B] border-[#0D5C3B]'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {userDisplayName ? (
              <button
                type="button"
                onClick={onSignOut}
                aria-label={`Sair da conta ${userDisplayName}`}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span className="max-w-[110px] truncate">{userDisplayName}</span>
                <LogOut className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D5C3B] text-white text-xs md:text-sm font-semibold hover:bg-[#0A492F] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span>Entrar Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Thumb-Zone Tab Bar */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#0D5C3B]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-semibold tracking-tight leading-none">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
