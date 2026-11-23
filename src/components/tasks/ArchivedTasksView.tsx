import React, { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, FolderKanban, Loader2, Repeat } from 'lucide-react';
import { PRIORITIES, STATUSES } from '../../types';
import { AdminCard, IconAction, Notice, Pagination, SearchBox, useDebounced } from '../admin/AdminUi';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { formatToJalali, toPersianDigits } from '../../utils/helpers';
import {
  bulkTaskAction,
  listArchivedTasks,
  PRIORITY_FROM_SERVER,
  restoreTask,
  STATUS_FROM_SERVER,
} from '../../services/taskFeaturesApi';
import type { Paged, TaskListRow } from './types';

/**
 * «بایگانی» (CAT-210): archived tasks and projects are hidden from the board and reports but nothing is
 * deleted. Here they are listed and brought back, one at a time or many at once.
 */
export const ArchivedTasksView: React.FC = () => {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<Paged<TaskListRow> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listArchivedTasks(page, pageSize, debounced)
      .then((result) => { setData(result); setError(''); })
      .catch((err) => setError(userErrorMessage(err, 'فهرست بایگانی خوانده نشد.')))
      .finally(() => setLoading(false));
  }, [page, pageSize, debounced]);
  useEffect(load, [load]);
  useEffect(() => { setPage(1); }, [debounced]);
  useEffect(() => { setSelected(new Set()); }, [data]);

  const restoreOne = async (row: TaskListRow) => {
    setBusy(true);
    try {
      await restoreTask(row.id);
      showToast(`«${row.title}» از بایگانی برگشت.`, 'ok');
      load();
    } catch (err) {
      showToast(userErrorMessage(err, 'فعالیت از بایگانی برنگشت.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const restoreSelected = async () => {
    const ids = [...selected];
    if (!(await appConfirm(`${toPersianDigits(ids.length)} فعالیت از بایگانی برگردد؟`, { confirmLabel: 'بازگرداندن' }))) return;
    setBusy(true);
    try {
      const result = await bulkTaskAction({ ids, action: 'Restore' });
      const failed = result.failed.length;
      showToast(
        failed === 0
          ? `${toPersianDigits(result.succeeded.length)} فعالیت از بایگانی برگشت.`
          : `${toPersianDigits(result.succeeded.length)} فعالیت برگشت؛ ${toPersianDigits(failed)} فعالیت برنگشت.`,
        failed === 0 ? 'ok' : 'info',
      );
      load();
    } catch (err) {
      showToast(userErrorMessage(err, 'فعالیت‌ها از بایگانی برنگشتند.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.items || [];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const th = 'px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-2.5 align-middle';

  return (
    <div className="w-full space-y-4" dir="rtl">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">بایگانی فعالیت‌ها</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">فعالیت‌های بایگانی‌شده از بورد و گزارش‌ها پنهان‌اند ولی حذف نشده‌اند و قابل بازگرداندن هستند.</p>
          </div>
          <SearchBox value={search} onChange={setSearch} placeholder="جستجوی عنوان..." />
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900">
            <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-200">{toPersianDigits(selected.size)} مورد انتخاب شده</span>
            <button type="button" disabled={busy} onClick={restoreSelected} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
              <ArchiveRestore className="w-3.5 h-3.5" /> بازگرداندن انتخاب‌شده‌ها
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer">لغو انتخاب</button>
          </div>
        )}
        {error && <Notice type="error">{error}</Notice>}
      </AdminCard>

      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className={`${th} w-10`}>
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="cursor-pointer"
                  />
                </th>
                <th className={th}>عنوان</th>
                <th className={th}>وضعیت</th>
                <th className={th}>اولویت</th>
                <th className={th}>مسئول</th>
                <th className={th}>موعد</th>
                <th className={th}>تاریخ بایگانی</th>
                <th className={`${th} w-14`}><span className="sr-only">بازگرداندن</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-medium">{debounced ? 'فعالیتی با این عنوان در بایگانی نیست.' : 'بایگانی خالی است.'}</td></tr>
              )}
              {rows.map((row) => {
                const status = STATUSES[STATUS_FROM_SERVER[row.status]];
                const priority = PRIORITIES[PRIORITY_FROM_SERVER[row.priority]];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className={td}>
                      <input
                        type="checkbox"
                        aria-label={`انتخاب «${row.title}»`}
                        checked={selected.has(row.id)}
                        onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className={`${td} min-w-[220px]`}>
                      <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                        {row.isProject && <FolderKanban className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {row.isRecurring && <Repeat className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
                        <span className="line-clamp-1" title={row.title}>{row.title}</span>
                      </span>
                    </td>
                    <td className={td}>{status && <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${status.badgeBg} ${status.badgeText}`}>{status.title}</span>}</td>
                    <td className={td}>{priority && <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${priority.bgColor} ${priority.textColor} ${priority.borderColor}`}>{priority.title}</span>}</td>
                    <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{row.assignedUser?.displayName || '—'}</td>
                    <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{row.dueDate ? formatToJalali(row.dueDate) : '—'}</td>
                    <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{row.archivedAtUtc ? formatToJalali(row.archivedAtUtc) : '—'}</td>
                    <td className={td}>
                      <IconAction icon={ArchiveRestore} label="بازگرداندن از بایگانی" tone="emerald" disabled={busy} onClick={() => restoreOne(row)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.totalCount > 0 && (
          <Pagination page={page} pageSize={pageSize} total={data.totalCount} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        )}
      </AdminCard>
    </div>
  );
};
