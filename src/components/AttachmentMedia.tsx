import React, { useEffect, useState } from 'react';
import type { Attachment } from '../types';
import { loadAttachmentDataUrl } from '../services/nexusApi';

/**
 * An attachment's content as a data URL. Files from the server arrive without content (the board no longer
 * downloads every file on each load); it is fetched here the first time something shows it, then cached.
 * '' while loading or when it cannot be read.
 */
export function useAttachmentUrl(att: Attachment | null | undefined): { url: string; failed: boolean } {
  const [state, setState] = useState<{ key: string; url: string; failed: boolean }>({ key: '', url: '', failed: false });
  const key = att ? `${att.id}:${att.fileId || ''}` : '';
  useEffect(() => {
    if (!att || att.dataUrl || !att.fileId) return;
    let alive = true;
    loadAttachmentDataUrl(att)
      .then((url) => { if (alive) setState({ key, url, failed: !url }); })
      .catch(() => { if (alive) setState({ key, url: '', failed: true }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, att?.dataUrl]);
  if (!att) return { url: '', failed: false };
  if (att.dataUrl) return { url: att.dataUrl, failed: false };
  return state.key === key ? { url: state.url, failed: state.failed } : { url: '', failed: !att.fileId };
}

/** A thumbnail of an image attachment, loaded when shown. */
export const AttachmentImg: React.FC<{ att: Attachment; className?: string }> = ({ att, className }) => {
  const { url } = useAttachmentUrl(att);
  return url ? <img src={url} alt={att.name} className={className} /> : <span className={`block animate-pulse bg-slate-200 dark:bg-slate-700 ${className || ''}`} aria-label={att.name} />;
};

/** A voice message, loaded when shown. */
export const AttachmentAudio: React.FC<{ att: Attachment; className?: string }> = ({ att, className }) => {
  const { url, failed } = useAttachmentUrl(att);
  if (failed) return <p className="text-[11px] text-rose-500">پیام صوتی خوانده نشد.</p>;
  return url ? <audio controls src={url} className={className} /> : <span className={`block animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 ${className || ''}`} />;
};
