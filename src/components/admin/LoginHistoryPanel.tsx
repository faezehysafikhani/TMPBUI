import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { LoginHistoryEntry, listLoginHistory } from '../../services/nexusApi';
import { parseISOToJalali } from '../../utils/jalali';
import { toPersianDigits } from '../../utils/helpers';
import { AdminCard, SearchBox, StatusBadge, Pagination, Notice, BadgeTone, useDebounced } from './AdminUi';
import { userErrorMessage } from '../../utils/errorMessages';

const PAGE_SIZE = 15;

/** What each sign-in audit action means for a person reading the history. */
const OUTCOMES: Record<string, { label: string; tone: BadgeTone }> = {
  'identity.login': { label: 'ورود موفق', tone: 'green' },
  'identity.login_failed': { label: 'ورود ناموفق', tone: 'red' },
  'identity.login_blocked': { label: 'مسدود (تلاش زیاد)', tone: 'amber' },
  'identity.login_captcha_failed': { label: 'کد امنیتی نادرست', tone: 'amber' },
};

const REASONS: Record<string, string> = {
  'unknown account': 'حساب ناموجود',
  'wrong password': 'رمز نادرست',
  'account disabled': 'حساب غیرفعال',
};

/** "0912... (wrong password)" -> the identifier and a Persian reason. */
function describe(details: string | null): { identifier: string; reason: string | null } {
  if (!details) return { identifier: '—', reason: null };
  const match = /^(.*) \(([^)]+)\)$/.exec(details);
  return match ? { identifier: match[1], reason: REASONS[match[2]] || match[2] } : { identifier: details, reason: null };
}

function dateAndTime(iso: string): { date: string; time: string } {
  const j = parseISOToJalali(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: toPersianDigits(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`), time: toPersianDigits(`${pad(j.hour)}:${pad(j.minute)}`) };
}

export const LoginHistoryPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [newestFirst, setNewestFirst] = useState(true);
  const [rows, setRows] = useState<LoginHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listLoginHistory({ page, pageSize: PAGE_SIZE, search: debouncedSearch, newestFirst });
      setRows(result.items);
      setTotal(result.totalCount);
    } catch (err) {
      setError(userErrorMessage(err, 'دریافت تاریخچه ورود ممکن نشد.'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, newestFirst]);

  useEffect(() => { setPage(1); }, [debouncedSearch, newestFirst]);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminCard>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-5">
        <SearchBox value={search} onChange={setSearch} placeholder="جستجو در کاربر، نام کاربری، IP، رویداد..." />
        <span className="text-xs text-slate-500 dark:text-slate-400">داده‌ها از رویدادهای ثبت‌شده در Audit Log سامانه خوانده می‌شوند.</span>
      </div>
      {error && <div className="px-5 pb-3"><Notice type="error">{error}</Notice></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs">
              <th className="text-right font-bold px-5 py-3">کاربر</th>
              <th className="text-right font-bold px-3 py-3">نام کاربری / شناسه واردشده</th>
              <th className="text-right font-bold px-3 py-3">
                <button type="button" onClick={() => setNewestFirst((v) => !v)} className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer" title="تغییر ترتیب">
                  تاریخ <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="text-right font-bold px-3 py-3">ساعت</th>
              <th className="text-right font-bold px-3 py-3">وضعیت</th>
              <th className="text-right font-bold px-3 py-3">علت</th>
              <th className="text-right font-bold px-5 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-500">رویدادی یافت نشد.</td></tr>
            ) : rows.map((row) => {
              const outcome = OUTCOMES[row.action] || { label: row.action, tone: 'slate' as BadgeTone };
              const { identifier, reason } = describe(row.details);
              const { date, time } = dateAndTime(row.occurredAtUtc);
              return (
                <tr key={row.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${loading ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3 font-bold text-slate-900 dark:text-slate-100">{row.userDisplayName || <span className="text-slate-400 font-normal">نامشخص</span>}</td>
                  <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300 dir-ltr text-right">{toPersianDigits(row.username || identifier)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{date}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{time}</td>
                  <td className="px-3 py-3"><StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge></td>
                  <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{reason || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 dir-ltr text-right">{row.ipAddress || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
    </AdminCard>
  );
};
