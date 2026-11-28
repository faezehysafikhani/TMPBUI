/**
 * What counts as the user being there. The server's idle timeout runs on this and nothing else:
 * a click, a key, a scroll or wheel, a touch, a mouse move. Polling, a chat window that is open,
 * messages arriving and a hidden tab are not activity - they would keep a forgotten workstation
 * signed in for ever.
 *
 * The server hears about it in two ways: the next request carries the header X-Nexus-Activity
 * (see takeActivityFlag, used by the HTTP client), and the session guard sends a short heartbeat
 * when nothing was sent for a while. Other tabs are told through a BroadcastChannel so their
 * warning does not appear while the user is working in this one.
 */

const CHANNEL_NAME = 'nexus-session';
/** Mouse moves and scrolls fire constantly; one note per second is plenty. */
const THROTTLE_MS = 1000;

type Listener = (at: number) => void;

let started = false;
let paused = false;
let pending = false;
let lastActivityAt = Date.now();
let lastNoteAt = 0;
let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function note(at: number, fromOtherTab: boolean): void {
  lastActivityAt = Math.max(lastActivityAt, at);
  if (!fromOtherTab) pending = true;
  listeners.forEach((listener) => listener(at));
}

let lastPointer: { x: number; y: number } | null = null;

function onInteraction(event: Event): void {
  if (paused) return;
  // Only the user's own input: not events fired by code, and not a mousemove the browser sends
  // when the page changes under a cursor that did not move (chat messages arriving, re-renders).
  if (!event.isTrusted) return;
  if (event.type === 'mousemove') {
    const { screenX: x, screenY: y } = event as MouseEvent;
    const moved = !lastPointer || lastPointer.x !== x || lastPointer.y !== y;
    lastPointer = { x, y };
    if (!moved) return;
  }
  const now = Date.now();
  if (now - lastNoteAt < THROTTLE_MS) return;
  lastNoteAt = now;
  note(now, false);
  try {
    channel?.postMessage({ type: 'activity', at: now });
  } catch {
    // Channel closed: this tab simply stops telling the others.
  }
}

/** Starts listening (once). Safe to call again. */
export function startActivityTracking(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const options = { passive: true, capture: true } as const;
  // No 'scroll': it also fires when code scrolls (a chat list following new messages). Wheel, keys
  // and touch cover the user scrolling.
  for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const) {
    window.addEventListener(name, onInteraction, options);
  }
  try {
    channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    channel?.addEventListener('message', (event) => {
      if (event.data?.type === 'activity' && typeof event.data.at === 'number') note(event.data.at, true);
    });
  } catch {
    channel = null;
  }
}

/** True once after the user did something, then false until they do again. */
export function takeActivityFlag(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}

/** Whether the user did something since the server was last told. */
export function hasPendingActivity(): boolean {
  return pending;
}

export function getLastActivityAt(): number {
  return lastActivityAt;
}

/**
 * While the "you are about to be signed out" dialog is open, moving the mouse must not dismiss it:
 * only the Continue button counts (this is also what accessibility guidance asks for).
 */
export function pauseActivityTracking(value: boolean): void {
  paused = value;
}

/** Called for activity in this tab and, with fromOtherTab, in the others. */
export function onActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tells the other tabs that the user chose to stay signed in (so their dialog closes too). */
export function broadcastContinued(at = Date.now()): void {
  try {
    channel?.postMessage({ type: 'continued', at });
  } catch {
    // Nothing to tell.
  }
}

export function onContinuedInOtherTab(listener: Listener): () => void {
  if (!channel) return () => undefined;
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'continued' && typeof event.data.at === 'number') listener(event.data.at);
  };
  channel.addEventListener('message', handler);
  return () => channel?.removeEventListener('message', handler);
}
