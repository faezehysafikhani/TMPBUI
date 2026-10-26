import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown, BadgeCheck } from 'lucide-react';
import { AdminCard, AdminDialog, Field, IconAction, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle, inputClass } from '../AdminUi';
import { userErrorMessage } from '../../../utils/errorMessages';
import { toPersianDigits } from '../../../utils/helpers';
import { Honorific, createTitle, deleteTitle, listTitles, updateTitle } from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, useLoad } from './orgShared';
import { appConfirm } from '../../../utils/appDialog';

type Message = { type: 'success' | 'error'; text: string } | null;

/**
 * «عنوان‌ها»: titles put before people's names («آقای»، «خانم»، «جناب مهندس»...). Whoever may add
 * users manages this list; a user's title is chosen in their create/edit dialog, and their name
 * is shown with it everywhere.
 */
export const TitlesPanel: React.FC = () => {
  const data = useLoad(listTitles, 'دریافت فهرست عنوان‌ها ممکن نشد.');
  const [message, setMessage] = useState<Message>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState<Honorific | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: success });
      await data.reload();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, failure) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const titles = data.data || [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (await run(() => createTitle(title), `عنوان «${title}» اضافه شد.`, 'افزودن عنوان انجام نشد.')) setNewTitle('');
  };

  /** Moves a title one place up or down; the list is then numbered 1, 2, 3... again. */
  const move = (index: number, by: -1 | 1) => {
    const order = [...titles];
    [order[index], order[index + by]] = [order[index + by], order[index]];
    run(async () => {
      for (const [i, t] of order.entries()) {
        if (t.sortOrder !== i + 1) await updateTitle(t.id, { title: t.title, sortOrder: i + 1, isActive: t.isActive });
      }
    }, 'ترتیب عنوان‌ها ذخیره شد.', 'تغییر ترتیب انجام نشد.');
  };

  return (
    <div className="space-y-4">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <AdminCard>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
              <BadgeCheck className="w-5 h-5 text-indigo-600" /> عنوان‌ها
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              عنوانی که پیش از نام افراد می‌آید، مثل «آقای»، «خانم» یا «جناب مهندس». هنگام ایجاد یا ویرایش کاربر انتخاب می‌شود و نام او در همه‌جای سامانه با آن نمایش داده می‌شود.
            </p>
          </div>
          <form onSubmit={add} className="flex gap-2">
            <input className={inputClass} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={40} placeholder="عنوان جدید، مثلاً: جناب مهندس" aria-label="عنوان جدید" />
            <PrimaryButton type="submit" disabled={busy || !newTitle.trim()} className="shrink-0">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} افزودن
            </PrimaryButton>
          </form>
        </div>
        {data.loading ? <LoadingRow /> : data.error ? <div className="p-5"><Notice type="error">{data.error}</Notice></div>
          : titles.length === 0 ? <EmptyRow>هنوز عنوانی تعریف نشده است.</EmptyRow> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {titles.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.title}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{t.userCount ? `${toPersianDigits(t.userCount)} کاربر` : 'بدون کاربر'}</span>
                    {!t.isActive && <StatusBadge tone="red">غیرفعال</StatusBadge>}
                  </div>
                  <div className="whitespace-nowrap">
                    <IconAction icon={ArrowUp} label="بالاتر" disabled={busy || i === 0} onClick={() => move(i, -1)} />
                    <IconAction icon={ArrowDown} label="پایین‌تر" disabled={busy || i === titles.length - 1} onClick={() => move(i, 1)} />
                    <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(t)} />
                    <IconAction
                      icon={Trash2}
                      tone="rose"
                      label="حذف"
                      disabled={busy || t.userCount > 0}
                      disabledReason="کاربرانی این عنوان را دارند؛ به‌جای حذف، آن را غیرفعال کنید."
                      onClick={async () => await appConfirm(`عنوان «${t.title}» حذف شود؟`) && run(() => deleteTitle(t.id), 'عنوان حذف شد.', 'حذف عنوان انجام نشد.')}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
      </AdminCard>

      {editing && (
        <AdminDialog
          title="ویرایش عنوان"
          onClose={() => setEditing(null)}
          footer={<>
            <SecondaryButton onClick={() => setEditing(null)}>انصراف</SecondaryButton>
            <PrimaryButton
              disabled={busy || !editing.title.trim()}
              onClick={async () => {
                const ok = await run(() => updateTitle(editing.id, { title: editing.title.trim(), sortOrder: editing.sortOrder, isActive: editing.isActive }), 'عنوان ویرایش شد.', 'ذخیره عنوان انجام نشد.');
                if (ok) setEditing(null);
              }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره
            </PrimaryButton>
          </>}
        >
          <Field label="عنوان" required hint={editing.userCount ? `نام ${toPersianDigits(editing.userCount)} کاربری که این عنوان را دارند هم تغییر می‌کند.` : undefined}>
            <input className={inputClass} value={editing.title} maxLength={40} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </Field>
          <Toggle
            checked={editing.isActive}
            onChange={(isActive) => setEditing({ ...editing, isActive })}
            label="فعال"
            description="عنوان غیرفعال برای کاربران جدید قابل انتخاب نیست؛ کسانی که آن را دارند نگهش می‌دارند."
          />
        </AdminDialog>
      )}
    </div>
  );
};
