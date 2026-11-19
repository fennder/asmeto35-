import React, { useState } from 'react';

interface PlayerAvatarProps {
  name: string;
  photoDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'emerald' | 'cobalt' | 'neutral' | 'crimson';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  photoDataUrl,
  size = 'md',
  tone = 'neutral',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 text-xs'
      : size === 'lg'
        ? 'w-14 h-14 text-base'
        : 'w-11 h-11 text-xs';

  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-900/10 text-[#0D5C3B] border-emerald-900/15'
      : tone === 'cobalt'
        ? 'bg-blue-900/10 text-[#1E3A8A] border-blue-900/15'
        : tone === 'crimson'
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  if (photoDataUrl && !imgFailed) {
    return (
      <img
        src={photoDataUrl}
        alt={`Foto de ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} ${toneClass} rounded-full border font-bold flex items-center justify-center shrink-0 select-none tracking-tight`}
    >
      {getInitials(name)}
    </div>
  );
};
