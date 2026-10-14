import { RefObject, useCallback, useEffect, useRef } from 'react';

export interface PanZoomView { x: number; y: number; s: number }

export const MIN_SCALE = 0.12;
export const MAX_SCALE = 2;
/** Below this the cards are hard to read: choosing one zooms in to it. */
export const READABLE_SCALE = 0.7;

const PAD = 24;
/** On narrow screens the zoom controls sit over the top of the canvas: the chart starts below them. */
const topPad = (vp: HTMLElement) => (vp.clientWidth < 640 ? 64 : PAD);
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** An element's place inside the zoomed content, unaffected by the current zoom. */
function localRect(el: HTMLElement, content: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== content) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  // A row inside a scrolled member list sits higher than its offset says.
  const list = el.parentElement?.closest<HTMLElement>('[data-scrollable]');
  if (list && content.contains(list)) y -= list.scrollTop;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/**
 * Pan and zoom for a canvas: the content is moved with a CSS transform (not re-rendered), so
 * zooming stays smooth with hundreds of cards. Wheel or pinch zooms around the pointer, dragging
 * moves; a drag never counts as a click on the card under it. Lists inside the canvas marked
 * data-scrollable keep scrolling with the wheel while they can. `active`: the viewport is mounted.
 */
export function usePanZoom(viewport: RefObject<HTMLDivElement | null>, content: RefObject<HTMLDivElement | null>, active: boolean) {
  const view = useRef<PanZoomView>({ x: 0, y: 0, s: 1 });
  const listeners = useRef(new Set<(view: PanZoomView) => void>());
  /** The user moved or zoomed since the last fit (a resize then keeps their view). */
  const moved = useRef(false);
  const dragged = useRef(false);

  const apply = useCallback((animate: boolean) => {
    const el = content.current;
    const vp = viewport.current;
    if (!el || !vp) return;
    const { x, y, s } = view.current;
    el.style.transition = animate ? 'transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    vp.style.backgroundSize = `${24 * s}px ${24 * s}px`;
    vp.style.backgroundPosition = `${x}px ${y}px`;
    listeners.current.forEach((listener) => listener(view.current));
  }, [content, viewport]);

  /** Some of the content always stays in sight. */
  const set = useCallback((next: PanZoomView, animate = false) => {
    const el = content.current;
    const vp = viewport.current;
    if (!el || !vp) return;
    const s = clampScale(next.s);
    const w = el.offsetWidth * s;
    const h = el.offsetHeight * s;
    const keep = Math.min(120, vp.clientWidth / 3, vp.clientHeight / 3);
    view.current = {
      s,
      x: Math.min(vp.clientWidth - keep, Math.max(keep - w, next.x)),
      y: Math.min(vp.clientHeight - keep, Math.max(keep - h, next.y)),
    };
    apply(animate);
  }, [apply, content, viewport]);

  /** The whole chart in view (never bigger than its real size). */
  const fit = useCallback((animate = false) => {
    const el = content.current;
    const vp = viewport.current;
    if (!el || !vp || !vp.clientWidth || !vp.clientHeight) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const top = topPad(vp);
    const s = clampScale(Math.min(1, (vp.clientWidth - 2 * PAD) / w, (vp.clientHeight - top - PAD) / h));
    moved.current = false;
    set({ s, x: (vp.clientWidth - w * s) / 2, y: Math.max(top, (vp.clientHeight - h * s) / 2) }, animate);
  }, [content, set, viewport]);

  const zoomAt = useCallback((px: number, py: number, factor: number, animate = false) => {
    const { x, y, s } = view.current;
    const ns = clampScale(s * factor);
    moved.current = true;
    set({ s: ns, x: px - (px - x) * (ns / s), y: py - (py - y) * (ns / s) }, animate);
  }, [set]);

  const zoomBy = useCallback((factor: number) => {
    const vp = viewport.current;
    if (vp) zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, factor, true);
  }, [viewport, zoomAt]);

  /** Brings an element of the content into view, zoomed in enough to read it. */
  const focus = useCallback((el: HTMLElement, options: { onlyIfNeeded?: boolean; minScale?: number } = {}) => {
    const root = content.current;
    const vp = viewport.current;
    if (!root || !vp || !root.contains(el)) return;
    const { minScale = 0.9, onlyIfNeeded = false } = options;
    // A row further down a member list is scrolled into the list first.
    const list = el.parentElement?.closest<HTMLElement>('[data-scrollable]');
    if (list && root.contains(list) && el.offsetParent === list) {
      list.scrollTop = el.offsetTop - (list.clientHeight - el.offsetHeight) / 2;
    }
    const r = localRect(el, root);
    const { x, y, s } = view.current;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const inView = r.x * s + x >= 0 && (r.x + r.w) * s + x <= vw && r.y * s + y >= 0 && (r.y + r.h) * s + y <= vh;
    if (onlyIfNeeded && inView && s >= READABLE_SCALE) return;
    const ns = clampScale(Math.min(Math.max(s, minScale), (vw - 2 * PAD) / r.w));
    moved.current = true;
    set({
      s: ns,
      x: vw / 2 - (r.x + r.w / 2) * ns,
      // A third of the way down, so what hangs under the card (a deputy's teams) shows too.
      y: r.h * ns > vh - topPad(vp) - PAD ? topPad(vp) - r.y * ns : Math.max(topPad(vp), vh / 3 - (r.h * ns) / 2) - r.y * ns,
    }, true);
  }, [content, set, viewport]);

  const subscribe = useCallback((listener: (view: PanZoomView) => void) => {
    listeners.current.add(listener);
    listener(view.current);
    return () => { listeners.current.delete(listener); };
  }, []);

  useEffect(() => {
    const vp = viewport.current;
    if (!active || !vp) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number } | null = null;
    let pinch: { dist: number; mid: { x: number; y: number } } | null = null;

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = vp.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const pinchOf = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const onWheel = (e: WheelEvent) => {
      const list = (e.target as Element).closest<HTMLElement>('[data-scrollable]');
      if (list && !e.ctrlKey && list.scrollHeight > list.clientHeight) {
        const canScroll = e.deltaY > 0 ? list.scrollTop + list.clientHeight < list.scrollHeight - 1 : list.scrollTop > 0;
        if (canScroll) return;
      }
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const p = local(e);
      // A pinch on a touchpad arrives as a wheel with ctrl held, in much smaller steps.
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element).closest('input, select, textarea')) return;
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) {
        start = local(e);
        dragged.current = false;
      } else if (pointers.size === 2) {
        pinch = pinchOf();
        dragged.current = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 2 && pinch) {
        const now = pinchOf();
        const { x, y, s } = view.current;
        const ns = clampScale(s * (now.dist / pinch.dist));
        moved.current = true;
        set({
          s: ns,
          x: now.mid.x - (pinch.mid.x - x) * (ns / s),
          y: now.mid.y - (pinch.mid.y - y) * (ns / s),
        });
        pinch = now;
        return;
      }
      if (pointers.size !== 1 || !start) return;
      if (!dragged.current && Math.hypot(p.x - start.x, p.y - start.y) < 5) return;
      if (!dragged.current) {
        dragged.current = true;
        vp.setPointerCapture(e.pointerId);
        vp.dataset.dragging = 'true';
      }
      moved.current = true;
      set({ ...view.current, x: view.current.x + p.x - prev.x, y: view.current.y + p.y - prev.y });
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        start = null;
        delete vp.dataset.dragging;
      }
    };

    // The click that ends a drag does not select the card under the pointer.
    const onClick = (e: MouseEvent) => {
      if (!dragged.current) return;
      dragged.current = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onDoubleClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('[data-node], button, input, select, textarea')) return;
      const p = local(e);
      zoomAt(p.x, p.y, 1.8, true);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.target !== vp) return;
      const step = 80;
      const keys: Record<string, () => void> = {
        '+': () => zoomBy(1.3),
        '=': () => zoomBy(1.3),
        '-': () => zoomBy(1 / 1.3),
        '0': () => fit(true),
        ArrowLeft: () => set({ ...view.current, x: view.current.x + step }, true),
        ArrowRight: () => set({ ...view.current, x: view.current.x - step }, true),
        ArrowUp: () => set({ ...view.current, y: view.current.y + step }, true),
        ArrowDown: () => set({ ...view.current, y: view.current.y - step }, true),
      };
      const action = keys[e.key];
      if (!action) return;
      e.preventDefault();
      moved.current = true;
      action();
    };

    const onDragStart = (e: DragEvent) => e.preventDefault();

    // Until the user moves the chart, it keeps fitting the canvas as the canvas changes size.
    const resize = new ResizeObserver(() => {
      if (!moved.current) fit();
      else set(view.current);
    });
    resize.observe(vp);

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    vp.addEventListener('click', onClick, true);
    vp.addEventListener('dblclick', onDoubleClick);
    vp.addEventListener('keydown', onKey);
    vp.addEventListener('dragstart', onDragStart);
    return () => {
      resize.disconnect();
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
      vp.removeEventListener('click', onClick, true);
      vp.removeEventListener('dblclick', onDoubleClick);
      vp.removeEventListener('keydown', onKey);
      vp.removeEventListener('dragstart', onDragStart);
    };
  }, [active, fit, set, viewport, zoomAt, zoomBy]);

  return { fit, zoomBy, focus, subscribe };
}
