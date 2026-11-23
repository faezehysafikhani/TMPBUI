import React, { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { can } from '../../utils/permissions';
import { getSessionUser, isGuid } from '../../services/nexusApi';
import { taskFromMessage, WORK_PERMISSIONS } from '../../services/workApi';

/**
 * «ثبت فوری به‌عنوان فعالیت» on a chat message (CAT-133): one click, no form - the message text becomes a
 * task due in the default time, given to the person clicking, and the task keeps the message as its source.
 * (The other button still opens the full task form.) Track 2 owns this file.
 */
export const QuickMessageTaskButton: React.FC<{ messageId: string; text: string; className: string }> = ({ messageId, text, className }) => {
  const [busy, setBusy] = useState(false);
  if (!isGuid(messageId) || !text.trim() || !can(getSessionUser(), WORK_PERMISSIONS.tasksCreate)) return null;
  const run = async () => {
    setBusy(true);
    try {
      const created = await taskFromMessage(messageId, text.trim(), text.trim().length > 80 ? `${text.trim().slice(0, 79)}…` : undefined);
      showToast(`فعالیت «${created.title}» از این پیام ساخته شد.`, 'ok');
    } catch (err) {
      showToast(userErrorMessage(err, 'فعالیت از پیام ساخته نشد.'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" disabled={busy} onClick={run} className={className} title="ثبت فوری این پیام به‌عنوان فعالیت (بدون فرم)" aria-label="ثبت فوری به‌عنوان فعالیت">
      {busy ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Zap className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
};
