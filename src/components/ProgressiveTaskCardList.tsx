import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TaskCardList } from './TaskCardList';

type ListProps = React.ComponentProps<typeof TaskCardList>;

const PAGE_SIZE = 30;
const LOOK_AHEAD = 10;
// Short pause with the loader showing before the next page is drawn.
const LOAD_DELAY_MS = 300;

/**
 * Draws a column 30 cards at a time and the next 30 when the user reaches the last 10.
 *
 * While the scrollbar thumb is held down (a drag to the bottom) only one page is added for that
 * press, so dragging the thumb down never pulls in the whole list; the next page waits for the
 * next scroll after the thumb is let go.
 */
export const ProgressiveTaskCardList: React.FC<ListProps> = ({ tasks, ...cardProps }) => {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pressedRef = useRef(false);
  const loadedThisPressRef = useRef(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  // Where the new page will start (scroll offset inside the column) when a thumb drag loaded it.
  const jumpToRef = useRef<{ root: Element; top: number } | null>(null);
  const shownCount = Math.min(visible, tasks.length);
  const hasMore = shownCount < tasks.length;

  // Track a press on the scroll container (that is where a scrollbar drag starts).
  useEffect(() => {
    const root = sentinelRef.current?.closest('[data-scroll-root]');
    if (!hasMore || !root) return undefined;
    const down = () => { pressedRef.current = true; loadedThisPressRef.current = false; };
    const up = () => { pressedRef.current = false; loadedThisPressRef.current = false; };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('mouseup', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('mouseup', up);
    };
  }, [hasMore]);

  // Checked on scroll (wheel, touch, keys or a thumb drag): load when the last 10 cards come into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = sentinel?.closest('[data-scroll-root]');
    if (!hasMore || loadingMore || !sentinel || !root) return undefined;
    const check = () => {
      const inView = sentinel.getBoundingClientRect().top < root.getBoundingClientRect().bottom;
      if (!inView || (pressedRef.current && loadedThisPressRef.current)) return;
      if (pressedRef.current) loadedThisPressRef.current = true;
      // The new cards go where the loader row is now. If the user has reached it (a drag, or the
      // wheel down to the very end), the view moves there once they are drawn; a load started at
      // the 20th card, before the end is in view, leaves the view alone.
      const loader = loaderRef.current;
      const rootBox = root.getBoundingClientRect();
      const loaderTop = loader ? loader.getBoundingClientRect().top : Infinity;
      jumpToRef.current = loader && (pressedRef.current || loaderTop < rootBox.bottom)
        ? { root, top: loaderTop - rootBox.top + root.scrollTop }
        : null;
      setLoadingMore(true);
    };
    // A wheel, touch or key scroll is not a thumb drag. The browser often sends no pointerup when a
    // scrollbar drag ends, so these clear the press too, and the wheel also loads at the very end,
    // where it no longer scrolls (and so fires no scroll event).
    const notDragging = () => { pressedRef.current = false; loadedThisPressRef.current = false; check(); };
    root.addEventListener('scroll', check, { passive: true });
    root.addEventListener('wheel', notDragging, { passive: true });
    root.addEventListener('touchmove', notDragging, { passive: true });
    root.addEventListener('keydown', notDragging);
    return () => {
      root.removeEventListener('scroll', check);
      root.removeEventListener('wheel', notDragging);
      root.removeEventListener('touchmove', notDragging);
      root.removeEventListener('keydown', notDragging);
    };
  }, [hasMore, shownCount, loadingMore]);

  useEffect(() => {
    if (!loadingMore) return undefined;
    const timer = window.setTimeout(() => {
      // Keep the view where it is: the new cards go below, the thumb moves up and does not stay at the bottom.
      setVisible((count) => count + PAGE_SIZE);
      setLoadingMore(false);
    }, LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [loadingMore]);

  // After a drag loaded a page, bring the thumb back to the start of the new cards.
  useLayoutEffect(() => {
    const jump = jumpToRef.current;
    if (!jump || loadingMore) return;
    jumpToRef.current = null;
    jump.root.scrollTop = jump.top;
  }, [shownCount, loadingMore]);

  const shown = tasks.slice(0, shownCount);
  if (!hasMore) return <TaskCardList tasks={shown} {...cardProps} />;

  const split = Math.max(0, shownCount - LOOK_AHEAD);
  return (
    <>
      <TaskCardList tasks={shown.slice(0, split)} {...cardProps} />
      <div ref={sentinelRef} className="space-y-3">
        <TaskCardList tasks={shown.slice(split)} {...cardProps} />
      </div>
      <div
        ref={loaderRef}
        className="flex items-center justify-center gap-2 py-3 text-xs text-gray-500 dark:text-gray-400"
        role="status"
        aria-live="polite"
      >
        {loadingMore && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />}
        <span>{loadingMore ? 'در حال بارگذاری…' : `${tasks.length - shownCount} مورد دیگر — برای دیدن، پایین‌تر بروید`}</span>
      </div>
    </>
  );
};
