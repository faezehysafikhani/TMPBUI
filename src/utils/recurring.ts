import { RecurringConfig, ProjectSubTask } from '../types';
import { gregorianToJalali } from './jalali';
import { toPersianDigits } from './helpers';

const DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

function getJalaliMonthLength(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  // Month 12 Kabise (leap) check
  const isLeap = (((jy + 38) * 31) % 128) < 31;
  return isLeap ? 30 : 29;
}

export function generateRecurringOccurrences(
  config: RecurringConfig,
  existingSubTasks: ProjectSubTask[] = []
): ProjectSubTask[] {
  if (!config || !config.startDate) return existingSubTasks;

  const startDateObj = new Date(config.startDate);
  if (isNaN(startDateObj.getTime())) return existingSubTasks;

  const startOfDay = new Date(startDateObj);
  startOfDay.setHours(0, 0, 0, 0);

  // Default end date if not provided: 60 days after start date
  let endDateObj = config.endDate ? new Date(config.endDate) : new Date(startDateObj.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (isNaN(endDateObj.getTime())) {
    endDateObj = new Date(startDateObj.getTime() + 60 * 24 * 60 * 60 * 1000);
  }

  // Ensure start is before or equal to end
  if (startDateObj > endDateObj) return existingSubTasks;

  const startTime = config.startTime || config.dailyTime || config.time || '09:00';
  const endTime = config.endTime || '10:00';

  const occurrences: ProjectSubTask[] = [];
  const curr = new Date(startOfDay);

  const endLimit = new Date(endDateObj);
  endLimit.setHours(23, 59, 59, 999);

  let count = 0;
  const MAX_OCCURRENCES = 150; // Safety limit to prevent infinite loops

  const intervalWeeks = Math.max(1, config.intervalWeeks || 1);

  while (curr <= endLimit && count < MAX_OCCURRENCES) {
    const gy = curr.getFullYear();
    const gm = curr.getMonth() + 1;
    const gd = curr.getDate();
    const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);

    // JS day: 0=Sun, 1=Mon, ..., 6=Sat
    // Persian day index: 0=شنبه, 1=یکشنبه, 2=دوشنبه, 3=سه‌شنبه, 4=چهارشنبه, 5=پنج‌شنبه, 6=جمعه
    const jsDay = curr.getDay();
    const persianDayIndex = (jsDay + 1) % 7;

    let isMatch = false;
    let periodName = '';

    const freq = config.frequency;

    if (freq === 'daily') {
      isMatch = true;
      periodName = 'روزانه';
    } else if (freq === 'weekly') {
      const selectedDays = config.weeklyDays || [0];
      if (selectedDays.includes(persianDayIndex)) {
        // Calculate week difference from start date
        const diffMs = curr.getTime() - startOfDay.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const weekIndex = Math.floor(diffDays / 7);

        if (weekIndex % intervalWeeks === 0) {
          isMatch = true;
          const intervalText = intervalWeeks > 1 ? `هر ${toPersianDigits(intervalWeeks)} هفته یکبار - ` : '';
          periodName = `${intervalText}${DAY_NAMES[persianDayIndex]}`;
        }
      }
    } else if (freq === 'monthly' || freq === 'monthly_day') {
      const selectedMonthlyDays = config.monthlyDays || [1];
      if (selectedMonthlyDays.includes(jd)) {
        isMatch = true;
        periodName = `ماهیانه (روز ${toPersianDigits(jd)})`;
      }
    } else if (freq === 'monthly_nth_weekday') {
      const targetDay = config.nthWeekday ?? 2; // Default Monday (2 = دوشنبه)
      const targetNth = config.nthOccurrence || 'first'; // 'first', 'second', 'third', 'fourth', 'last'

      if (persianDayIndex === targetDay) {
        const monthLen = getJalaliMonthLength(jy, jm);
        let matchesNth = false;

        if (targetNth === 'first' && jd >= 1 && jd <= 7) matchesNth = true;
        else if (targetNth === 'second' && jd >= 8 && jd <= 14) matchesNth = true;
        else if (targetNth === 'third' && jd >= 15 && jd <= 21) matchesNth = true;
        else if (targetNth === 'fourth' && jd >= 22 && jd <= 28) matchesNth = true;
        else if (targetNth === 'last' && jd + 7 > monthLen) matchesNth = true;

        if (matchesNth) {
          isMatch = true;
          const nthTextMap: Record<string, string> = {
            first: 'اولین',
            second: 'دومین',
            third: 'سومین',
            fourth: 'چهارمین',
            last: 'آخرین',
          };
          const nthLabel = nthTextMap[targetNth] || 'اولین';
          periodName = `${nthLabel} ${DAY_NAMES[targetDay]} ماه`;
        }
      }
    }

    if (isMatch) {
      count++;
      const [sH, sM] = startTime.split(':').map((n) => parseInt(n, 10) || 0);
      const [eH, eM] = endTime.split(':').map((n) => parseInt(n, 10) || 0);

      const occStart = new Date(curr);
      occStart.setHours(sH, sM, 0, 0);

      const occEnd = new Date(curr);
      occEnd.setHours(eH, eM, 0, 0);

      const shamsiStr = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
      const shamsiPersian = toPersianDigits(shamsiStr);
      const startTimePersian = toPersianDigits(startTime);
      const endTimePersian = toPersianDigits(endTime);

      occurrences.push({
        id: `rec_occ_${count}_${curr.getTime()}`,
        title: `تکرار ادواری ${periodName} - ${shamsiPersian} (ساعت ${startTimePersian} تا ${endTimePersian})`,
        startDate: occStart.toISOString(),
        endDate: occEnd.toISOString(),
        importance: 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Advance 1 day
    curr.setDate(curr.getDate() + 1);
  }

  // Preserve non-auto generated subtasks
  const customSubTasks = existingSubTasks.filter((st) => !st.id.startsWith('rec_occ_'));
  return [...customSubTasks, ...occurrences];
}
