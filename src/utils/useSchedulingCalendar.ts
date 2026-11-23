import { useEffect, useState } from 'react';
import { SCHEDULING_CALENDAR_EVENT } from './jalali';

/** Re-renders the caller when the work calendar's days are (re)loaded, so pickers show the current days off. */
export function useSchedulingCalendarVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const on = () => setVersion((v) => v + 1);
    window.addEventListener(SCHEDULING_CALENDAR_EVENT, on);
    return () => window.removeEventListener(SCHEDULING_CALENDAR_EVENT, on);
  }, []);
  return version;
}
