// «چیدمان آزاد»: a card (with what hangs under it) that can be dragged to any place on the chart.
// Only how the chart looks changes: the offsets are kept in the browser, the structure is untouched.
import React, { useRef } from 'react';

export interface FreeOffset { x: number; y: number }

export const FreeDrag: React.FC<{
  id: string;
  enabled: boolean;
  offset?: FreeOffset;
  /** The chart's current zoom (the drag moves in chart units, not screen pixels). */
  scale: () => number;
  onMove: (id: string, offset: FreeOffset) => void;
  onEnd: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ id, enabled, offset, scale, onMove, onEnd, className = '', children }) => {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; active: boolean } | null>(null);
  const suppress = useRef(false);
  const o = enabled ? offset : undefined;
  return (
    <div
      data-free-id={id}
      data-free-drag={enabled ? '' : undefined}
      className={`${className} ${enabled ? 'cursor-move' : ''}`}
      style={o && (o.x || o.y) ? { transform: `translate(${o.x}px, ${o.y}px)` } : undefined}
      onPointerDown={enabled ? (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if ((e.target as Element).closest('button, input, select, textarea, a')) return;
        drag.current = { sx: e.clientX, sy: e.clientY, ox: offset?.x ?? 0, oy: offset?.y ?? 0, active: false };
      } : undefined}
      onPointerMove={enabled ? (e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.active) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
          d.active = true;
          // Captured only once it is a drag, so a plain click still reaches the card.
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const s = scale() || 1;
        onMove(id, { x: d.ox + (e.clientX - d.sx) / s, y: d.oy + (e.clientY - d.sy) / s });
      } : undefined}
      onPointerUp={enabled ? (e) => {
        const d = drag.current;
        drag.current = null;
        if (!d?.active) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        suppress.current = true;
        setTimeout(() => { suppress.current = false; }, 0);
        onEnd();
      } : undefined}
      onPointerCancel={enabled ? () => { drag.current = null; } : undefined}
      onClickCapture={(e) => { if (suppress.current) { e.stopPropagation(); e.preventDefault(); } }}
    >
      {children}
    </div>
  );
};
