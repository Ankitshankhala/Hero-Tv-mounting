import React from 'react';

interface Props {
  /** Raw announcement text (plain text only). */
  text: string;
  announcementEnabled: boolean;
  promoBadgeEnabled: boolean;
  /** When true, nothing renders (avoids a flash of stale content). */
  loading?: boolean;
}

/**
 * Hero pill area under the phone number: optional 20% OFF badge and/or an
 * admin-authored announcement. Renders nothing (no empty container) when both
 * are off, so the hero has no layout shift.
 */
export const HeroAnnouncement: React.FC<Props> = ({
  text,
  announcementEnabled,
  promoBadgeEnabled,
  loading,
}) => {
  const message = (text ?? '').trim();
  const showAnnouncement = announcementEnabled && message.length > 0;

  if (loading || (!promoBadgeEnabled && !showAnnouncement)) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {promoBadgeEnabled && (
        <span className="inline-flex items-center gap-2 bg-blue-600 text-white font-extrabold uppercase tracking-wide px-4 py-2 rounded-full shadow-lg text-sm">
          <span className="bg-white text-blue-700 rounded-full px-2.5 py-0.5 text-sm">20% OFF</span>
          <span>Already applied</span>
        </span>
      )}
      {showAnnouncement && (
        <span className="inline-block max-w-[min(100%,26rem)] bg-slate-700/80 border border-slate-500/60 text-white font-semibold px-4 py-2 rounded-full shadow-lg text-sm text-center break-words">
          {message}
        </span>
      )}
    </div>
  );
};
