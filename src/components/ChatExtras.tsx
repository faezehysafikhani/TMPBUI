import React, { useEffect, useRef, useState } from 'react';
import { Smile, Mic, Square } from 'lucide-react';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_LABEL } from '../types';
import { toPersianDigits } from '../utils/helpers';

export const CHAT_EMOJIS = [
  '👍', '😂', '😭', '👏', '🤞', '🙏', '😊', '🥰', '😮', '🙌',
  '🙃', '😉', '🥳', '🤪', '💀', '😱', '🎉', '😎', '😴', '✌',
  '😁', '👌', '🤭', '😐', '🙋', '😋', '💰', '🥴', '🥺', '😢',
  '😜', '🤗', '💯', '🤢', '😏', '🌹', '🤫', '😬',
  '😳', '🎂', '🎈', '😵', '😷', '🤔', '😡', '🤬', '😤',
  '🤕', '🥱', '🤮', '🤯', '🥵', '🥶', '🤠', '🧐', '👻',
  '🤙', '☝', '🤝', '🙍', '💻', '🏃',
];

const VOICE_NAME = /^voice-.*\.(webm|ogg|m4a|mp4|wav|mp3)$/i;

/** A voice message is an audio recording made in the app; it cannot become a task. */
export const isVoiceName = (name?: string) => !!name && VOICE_NAME.test(name);

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

interface EmojiButtonProps {
  onPick: (emoji: string) => void;
  className?: string;
  iconClassName?: string;
}

/** A smiley button that opens a grid of emojis above it. */
export const EmojiButton: React.FC<EmojiButtonProps> = ({ onPick, className = '', iconClassName = 'w-5 h-5' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A click anywhere outside (or Escape) closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="ایموجی"
        aria-label="انتخاب ایموجی"
        className={className}
      >
        <Smile className={iconClassName} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-40 w-72 max-h-60 overflow-y-auto p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">انتخاب ایموجی</p>
          <div className="grid grid-cols-8 gap-1 justify-items-center">
            {CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl leading-none rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                style={{ fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif" }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface RecordedVoice {
  name: string;
  /** data: URL of the recording. */
  url: string;
  size: number;
  type: string;
}

interface VoiceButtonProps {
  onRecorded: (voice: RecordedVoice) => void;
  onError?: (message: string) => void;
  className?: string;
  iconClassName?: string;
}

/** Records from the microphone; the result is checked against the admin-configured upload limit. */
export const VoiceButton: React.FC<VoiceButtonProps> = ({ onRecorded, onError, className = '', iconClassName = 'w-5 h-5' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);
        setIsRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          alert(`حجم پیام صوتی بیشتر از ${MAX_ATTACHMENT_LABEL} است.`);
          return;
        }
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const reader = new FileReader();
        reader.onload = () => onRecorded({ name: `voice-${Date.now()}.${ext}`, url: reader.result as string, size: blob.size, type: blob.type });
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    } catch {
      onError?.('دسترسی به میکروفون ممکن نشد.');
    }
  };

  const stop = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); };

  return (
    <button
      type="button"
      onClick={isRecording ? stop : start}
      title={isRecording ? 'توقف ضبط' : 'ضبط پیام صوتی'}
      aria-label={isRecording ? 'توقف ضبط' : 'ضبط پیام صوتی'}
      className={`${className} ${isRecording ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 animate-pulse' : ''} flex items-center gap-1 text-xs font-bold`}
    >
      {isRecording ? <Square className={iconClassName} /> : <Mic className={iconClassName} />}
      {isRecording && <span>{toPersianDigits(formatDuration(seconds))}</span>}
    </button>
  );
};
