import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Filter,
  Flag,
  FolderKanban,
  GripVertical,
  History,
  Kanban,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  MousePointerClick,
  Network,
  Plus,
  RefreshCw,
  Repeat,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  StickyNote,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { User } from '../types';
import { can, canOpenTab, PERMISSIONS } from '../utils/permissions';
import { toPersianDigits } from '../utils/helpers';

// The in-app user guide: a few visual slides about what this system really does, opened only
// from the header's "?" button. Slides and items the user has no permission for are left out,
// so it never walks someone through something they cannot do.

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

interface GuideSlide {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  body: React.ReactNode;
}

// ---------------------------------------------------------------- small visual building blocks

const Chip: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${className}`}>{children}</span>
);

const Step: React.FC<{ n: number; title: string; children?: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex gap-2.5">
    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">{toPersianDigits(n)}</span>
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
      {children && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-6">{children}</p>}
    </div>
  </li>
);

const Tile: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; text: string; tone?: string }> = ({ icon: Icon, title, text, tone = 'indigo' }) => {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300',
  };
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
      <span className={`p-2 rounded-xl shrink-0 ${tones[tone] || tones.indigo}`}><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-6">{text}</p>
      </div>
    </div>
  );
};

/** A slide: an illustration panel and a short explanation beside it (stacked on phones). */
const SlideLayout: React.FC<{ visual: React.ReactNode; children: React.ReactNode }> = ({ visual, children }) => (
  <div className="grid md:grid-cols-2 gap-4 md:gap-6 items-start">
    <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/60 border border-indigo-100 dark:border-slate-700 p-4" aria-hidden="true">
      {visual}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const Arrow: React.FC = () => <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />;

// ---------------------------------------------------------------- the guide

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const slides = useMemo<GuideSlide[]>(() => {
    const has = (permission: string) => can(currentUser, permission);
    const canCreate = has(PERMISSIONS.tasksCreate);
    const canRecurring = has('Tasks.ManageRecurring');
    const canUpload = has(PERMISSIONS.tasksUploadFiles);
    const list: GuideSlide[] = [];

    // 1. Introduction: the map of the sections this user can open.
    const sections = [
      { tab: 'kanban' as const, icon: Kanban, title: 'بورد کانبان', text: 'فعالیت‌ها در ستون وضعیت' },
      { tab: 'calendar' as const, icon: CalendarDays, title: 'نمای تقویم', text: 'فعالیت‌ها روی روزهای ماه' },
      { tab: 'overdue' as const, icon: AlertTriangle, title: 'موعد گذشته', text: 'کارهایی که عقب افتاده‌اند' },
      { tab: 'notes' as const, icon: StickyNote, title: 'یادداشت‌های شخصی', text: 'یادداشت‌های خودتان' },
      { tab: 'chat' as const, icon: MessagesSquare, title: 'گفتگوی تیمی', text: 'گفتگو با همکاران' },
      { tab: 'settings' as const, icon: Settings, title: 'تنظیمات', text: 'پروفایل، ظاهر و تیم‌ها' },
    ].filter((s) => canOpenTab(currentUser, s.tab));
    list.push({
      id: 'intro',
      title: 'به سامانه مدیریت وظایف خوش آمدید',
      subtitle: 'همه‌ی کارهای شما و تیمتان در یک جا',
      icon: Sparkles,
      body: (
        <SlideLayout
          visual={
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-wrap">
                <Chip className="bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800">ثبت فعالیت</Chip>
                <Arrow />
                <Chip className="bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800">انجام و پیگیری</Chip>
                <Arrow />
                <Chip className="bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">خاتمه</Chip>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sections.map((s) => (
                  <div key={s.tab} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                    <s.icon className="w-5 h-5 mx-auto text-indigo-600 dark:text-indigo-400" />
                    <p className="text-[11px] font-bold mt-1 text-slate-800 dark:text-slate-100">{s.title}</p>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            در این سامانه فعالیت‌ها را ثبت می‌کنید، مسئول انجام هرکدام را مشخص می‌کنید و پیشرفت کار را تا پایان دنبال می‌کنید.
          </p>
          <div className="grid gap-2">
            {sections.slice(0, 4).map((s) => (
              <Tile key={s.tab} icon={s.icon} title={s.title} text={s.text} />
            ))}
          </div>
        </SlideLayout>
      ),
    });

    // 2. Where things are.
    list.push({
      id: 'workspace',
      title: 'آشنایی با محیط کار',
      subtitle: 'هر چیزی کجاست؟',
      icon: LayoutDashboard,
      body: (
        <SlideLayout
          visual={
            <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[10px]">
              <div className="flex items-center justify-between px-2.5 py-2 bg-slate-800 text-white">
                <span className="font-bold">مدیریت وظایف</span>
                <span className="flex items-center gap-1.5">
                  <span className="relative"><Bell className="w-3.5 h-3.5" /><span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-rose-500" /></span>
                  <CircleHelp className="w-3.5 h-3.5 text-amber-300" />
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="w-4 h-4 rounded-md bg-indigo-500 flex items-center justify-center"><Plus className="w-3 h-3" /></span>
                </span>
              </div>
              <div className="flex h-32">
                <div className="w-16 bg-slate-100 dark:bg-slate-800 p-1.5 space-y-1.5 border-l border-slate-200 dark:border-slate-700">
                  {[Kanban, CalendarDays, AlertTriangle, MessagesSquare, Settings].map((Icon, i) => (
                    <div key={i} className={`h-5 rounded-md flex items-center justify-center ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-500'}`}><Icon className="w-3 h-3" /></div>
                  ))}
                </div>
                <div className="flex-1 p-2 grid grid-cols-3 gap-1.5">
                  {['شروع نشده', 'درحال اجرا', 'خاتمه یافته'].map((c) => (
                    <div key={c} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-1 space-y-1">
                      <p className="font-bold text-slate-500 truncate">{c}</p>
                      <div className="h-4 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
                      <div className="h-4 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <ol className="space-y-3">
            <Step n={1} title="نوار بالای صفحه">زنگوله‌ی اعلان‌ها، همین راهنما (?)، به‌روزرسانی داده‌ها و خلاصه وضعیت شما.</Step>
            <Step n={2} title="منوی بخش‌ها">در رایانه در کنار صفحه و در گوشی در نوار پایین؛ بین کانبان، تقویم، موعد گذشته و بقیه جابه‌جا شوید.</Step>
            {canCreate && <Step n={3} title="دکمه افزودن فعالیت">فرم ثبت فعالیت جدید را باز می‌کند.</Step>}
          </ol>
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 text-xs text-sky-800 dark:text-sky-200">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>سامانه روی گوشی هم قابل استفاده است.</span>
          </div>
        </SlideLayout>
      ),
    });

    // 3. Creating a task - only for those who may.
    if (canCreate) {
      list.push({
        id: 'create',
        title: 'ثبت یک فعالیت جدید',
        subtitle: 'در چند قدم ساده',
        icon: Plus,
        body: (
          <SlideLayout
            visual={
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2 text-[11px]">
                <div className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2 flex items-center text-slate-400">عنوان فعالیت…</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2 flex items-center gap-1 text-slate-500"><Clock className="w-3 h-3" />موعد انجام</div>
                  <div className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 px-2 flex items-center text-slate-500">وضعیت</div>
                </div>
                <div className="h-8 rounded-lg border-2 border-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/50 px-2 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300"><UserCheck className="w-3.5 h-3.5" />مسئول اجرا</span>
                  <Chip className="bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300">الزامی</Chip>
                </div>
                <div className="flex gap-1.5">
                  <Chip className="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">کم</Chip>
                  <Chip className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300">متوسط</Chip>
                  <Chip className="bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300">زیاد</Chip>
                  <Chip className="bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300"><Tag className="w-3 h-3" />برچسب</Chip>
                </div>
                <div className="h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center">ذخیره</div>
              </div>
            }
          >
            <ol className="space-y-3">
              <Step n={1} title="عنوان و توضیح">کوتاه و روشن بنویسید چه کاری باید انجام شود.</Step>
              <Step n={2} title="موعد انجام">تاریخ و ساعت شمسی را از تقویم انتخاب کنید.</Step>
              <Step n={3} title="مسئول اجرا (الزامی)">خودتان یا یکی از همکاران فعال سازمان را انتخاب کنید؛ بدون مسئول، فعالیت ثبت نمی‌شود.</Step>
              <Step n={4} title="اولویت و برچسب">{canUpload ? 'اولویت را مشخص کنید و در صورت نیاز برچسب و فایل پیوست (تا ۲۰۰ کیلوبایت) اضافه کنید.' : 'اولویت را مشخص کنید و در صورت نیاز برچسب بگذارید.'}</Step>
            </ol>
          </SlideLayout>
        ),
      });

      // 4. Plain, recurring and project tasks.
      list.push({
        id: 'types',
        title: 'سه نوع فعالیت',
        subtitle: 'عادی، تکرارشونده و پروژه',
        icon: ListChecks,
        body: (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 space-y-2">
              <span className="inline-flex p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"><CheckCircle2 className="w-5 h-5" /></span>
              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">فعالیت عادی</p>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">یک کار با یک موعد انجام مشخص.</p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Clock className="w-3.5 h-3.5" />موعد: ۱۴۰۵/۰۷/۱۵ - ۱۰:۰۰</div>
            </div>
            {canRecurring && (
              <div className="p-4 rounded-3xl border border-purple-200 dark:border-purple-900 bg-purple-50/60 dark:bg-purple-950/30 space-y-2">
                <span className="inline-flex p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300"><Repeat className="w-5 h-5" /></span>
                <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">فعالیت تکرارشونده</p>
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">با گزینه «تکرارشونده» زمان‌بندی را تعیین کنید: روزانه، هفتگی یا ماهانه؛ در این حالت فیلد موعد انجام لازم نیست.</p>
                <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300"><Bell className="w-3.5 h-3.5" />در هر نوبت، به مسئول انجام یادآوری می‌شود.</div>
              </div>
            )}
            <div className="p-4 rounded-3xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
              <span className="inline-flex p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300"><FolderKanban className="w-5 h-5" /></span>
              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">پروژه</p>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">با گزینه «پروژه است» زیرفعالیت‌ها و منشور پروژه (شرح، مدیر، تاریخ شروع و پایان) را وارد کنید.</p>
              <div className="space-y-1">
                {['طراحی', 'اجرا', 'تحویل'].map((t, i) => (
                  <div key={t} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className={`w-3 h-3 rounded ${i === 0 ? 'bg-emerald-500' : 'border border-slate-300 dark:border-slate-600'}`} />{t}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">وضعیت پروژه از روی زیرفعالیت‌ها خودکار حساب می‌شود.</p>
            </div>
          </div>
        ),
      });
    }

    // 5. The Kanban board.
    if (canOpenTab(currentUser, 'kanban')) {
      list.push({
        id: 'kanban',
        title: 'بورد کانبان',
        subtitle: 'وضعیت همه‌ی کارها در یک نگاه',
        icon: Kanban,
        body: (
          <SlideLayout
            visual={
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                  <Chip className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">شروع نشده</Chip>
                  <Arrow />
                  <Chip className="bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300">درحال اجرا</Chip>
                  <Arrow />
                  <Chip className="bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">خاتمه یافته</Chip>
                </div>
                <div className="flex items-center justify-center"><Chip className="bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">متوقف</Chip></div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 flex items-center gap-2 shadow-sm">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">تهیه گزارش هفتگی</p>
                    <p className="text-[10px] text-slate-400">مسئول: شما</p>
                  </div>
                  <Chip className="bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300"><Flag className="w-3 h-3" />زیاد</Chip>
                </div>
                <div className="flex items-end gap-1.5 h-12 justify-center">
                  {[60, 35, 80, 45].map((h, i) => <div key={i} className="w-5 rounded-t bg-indigo-400/80" style={{ height: `${h}%` }} />)}
                  <div className="w-10 h-10 rounded-full border-[6px] border-emerald-400 border-l-rose-400 mr-3" />
                </div>
              </div>
            }
          >
            <div className="grid gap-2">
              <Tile icon={GripVertical} title="تغییر وضعیت" text="کارت فعالیت را به ستون دیگر بکشید؛ اگر اجازه‌ی تغییر وضعیت آن را داشته باشید." />
              <Tile icon={Filter} title="فیلترها" tone="sky" text="دکمه فیلتر در بالای صفحه (فقط در کانبان) کارها را بر اساس وضعیت، اولویت، مسئول و برچسب محدود می‌کند." />
              <Tile icon={BarChart3} title="نمودارها" tone="emerald" text="زیر بورد، تاخیر کارهای جاری شما و تعداد کارهای هر مسئول را می‌بینید؛ با کلیک روی نمودار، فهرست همان کارها باز می‌شود." />
            </div>
          </SlideLayout>
        ),
      });
    }

    // 6. Calendar and overdue.
    if (canOpenTab(currentUser, 'calendar')) {
      list.push({
        id: 'calendar',
        title: 'تقویم و موعد گذشته',
        subtitle: 'برنامه‌ی زمانی کارها',
        icon: CalendarDays,
        body: (
          <SlideLayout
            visual={
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const day = i + 8;
                    const highlight = day === 15;
                    return (
                      <div key={day} className={`h-9 rounded-lg border text-[10px] p-0.5 flex flex-col justify-between ${highlight ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <div className="flex justify-between items-center">
                          <span>{toPersianDigits(day)}</span>
                          {highlight && canCreate && <Plus className="w-3 h-3" />}
                        </div>
                        {(day === 10 || day === 15 || day === 19) && <span className={`w-1.5 h-1.5 rounded-full mx-auto ${highlight ? 'bg-white' : 'bg-indigo-500'}`} />}
                      </div>
                    );
                  })}
                </div>
                {canOpenTab(currentUser, 'overdue') && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />بازبینی قرارداد — ۳ روز تاخیر
                  </div>
                )}
              </div>
            }
          >
            <div className="grid gap-2">
              <Tile icon={MousePointerClick} title="انتخاب روز" text="با کلیک روی هر روز، فعالیت‌های همان روز در کنار تقویم نمایش داده می‌شود." />
              {canCreate && <Tile icon={Plus} title="افزودن در همان روز" tone="emerald" text="دکمه + هر روز، فرم فعالیت را با تاریخ همان روز باز می‌کند." />}
              {canOpenTab(currentUser, 'overdue') && <Tile icon={AlertTriangle} title="موعد گذشته" tone="rose" text="همه‌ی کارهای انجام‌نشده‌ای که موعدشان گذشته، یک‌جا و با میزان تاخیر." />}
            </div>
          </SlideLayout>
        ),
      });
    }

    // 7. Working together: task details and notifications.
    list.push({
      id: 'collaborate',
      title: 'همکاری و اعلان‌ها',
      subtitle: 'از تغییرات جا نمانید',
      icon: Bell,
      body: (
        <SlideLayout
          visual={
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                {[
                  { icon: MessageSquare, text: 'نظر جدید' },
                  { icon: History, text: 'تغییر در فعالیت' },
                  { icon: Clock, text: 'یادآوری موعد' },
                ].map((s) => (
                  <div key={s.text} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    <s.icon className="w-3.5 h-3.5 text-indigo-500" />{s.text}
                  </div>
                ))}
              </div>
              <Arrow />
              <div className="w-20 h-20 rounded-3xl bg-indigo-600 text-white flex flex-col items-center justify-center shadow-lg relative">
                <Bell className="w-7 h-7" />
                <span className="absolute -top-1.5 -left-1.5 min-w-6 h-6 px-1 rounded-full bg-rose-500 text-[11px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900">{toPersianDigits(3)}</span>
                <span className="text-[10px] mt-1">زنگوله</span>
              </div>
            </div>
          }
        >
          <div className="grid gap-2">
            <Tile icon={MessageSquare} title="جزئیات فعالیت" text={`با باز کردن هر فعالیت، نظرات${canUpload ? '، فایل‌های پیوست' : ''} و تاریخچه‌ی تغییرات آن را می‌بینید.`} />
            <Tile icon={Bell} title="زنگوله اعلان‌ها" tone="amber" text="نظرها، تغییرات فعالیت‌های شما و یادآوری موعدها اینجا جمع می‌شوند و خوانده/نخوانده بودنشان حفظ می‌شود." />
            <Tile icon={Smartphone} title="پیامک یادآوری" tone="sky" text="اگر پیامک در سامانه فعال باشد و شماره‌ی شما ثبت شده باشد، یادآوری موعد پیامک هم می‌شود." />
          </div>
        </SlideLayout>
      ),
    });

    // 8. Personal tools.
    const personal = [
      canOpenTab(currentUser, 'notes') && { icon: StickyNote, title: 'یادداشت‌های شخصی', text: 'یادداشت‌هایی که فقط برای خودتان است.', tone: 'amber' },
      canOpenTab(currentUser, 'chat') && { icon: MessagesSquare, title: 'گفتگوی تیمی', text: 'پیام‌رسانی با همکاران بدون خروج از سامانه.', tone: 'sky' },
      has('groups.manage_own') && { icon: Users, title: 'تیم کاری من', text: 'در تنظیمات، تیم‌های کاری خود را بسازید و هنگام ثبت فعالیت از میان اعضای تیم مسئول انتخاب کنید.', tone: 'emerald' },
      { icon: Settings, title: 'تنظیمات و پروفایل', text: 'تغییر رنگ و ظاهر برنامه، مشخصات و رمز عبور.', tone: 'purple' },
    ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; title: string; text: string; tone: string }[];
    list.push({
      id: 'personal',
      title: 'ابزارهای شما',
      subtitle: 'یادداشت، گفتگو، تیم و تنظیمات',
      icon: Settings,
      body: (
        <div className="grid sm:grid-cols-2 gap-3">
          {personal.map((p) => <Tile key={p.title} icon={p.icon} title={p.title} text={p.text} tone={p.tone} />)}
        </div>
      ),
    });

    // 9. Administration: only the parts this user may use.
    const admin = [
      has('users.view') && { icon: Users, title: 'مدیریت کاربران', text: 'فهرست کاربران سازمان' + (has('users.create') ? '، ایجاد کاربر' : '') + (has('users.change_status') ? '، فعال یا غیرفعال کردن حساب' : '') + '.', tone: 'indigo' },
      has('users.assign_permissions') && { icon: ShieldCheck, title: 'نقش‌ها و دسترسی‌ها', text: 'دسترسی هر کاربر از نقش، گروه یا به‌صورت مستقیم می‌آید؛ برداشتن تیک یک مجوز آن را فقط برای همان کاربر غیرفعال می‌کند.', tone: 'emerald' },
      has('audit_logs.view') && { icon: History, title: 'تاریخچه ورود', text: 'ورودها و تلاش‌های ناموفق ورود به سامانه.', tone: 'amber' },
      has('sms_settings.view') && { icon: Smartphone, title: 'پنل پیامکی', text: 'تنظیم و آزمایش ارسال پیامک سازمان.', tone: 'sky' },
      has('ldap_settings.view') && { icon: Network, title: 'اتصال LDAP', text: 'تنظیم و آزمایش اتصال به سرور LDAP سازمان.', tone: 'purple' },
    ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; title: string; text: string; tone: string }[];
    if (admin.length > 0) {
      list.push({
        id: 'admin',
        title: 'مدیریت سامانه',
        subtitle: 'در «تنظیمات»، بر اساس دسترسی‌های شما',
        icon: ShieldCheck,
        body: (
          <SlideLayout
            visual={
              <div className="space-y-2">
                {has('users.assign_permissions') ? (
                  <>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />وضعیت هر مجوز برای یک کاربر</p>
                    {[
                      { on: true, label: 'مشاهده فعالیت‌ها', badge: 'فعال از طریق نقش کاربر', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800' },
                      { on: true, label: 'ایجاد فعالیت', badge: 'دسترسی مستقیم', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
                      { on: false, label: 'مشاهده کاربران', badge: 'غیرفعال برای این کاربر', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800' },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${r.on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{r.on && <CheckCircle2 className="w-2.5 h-2.5" />}</span>
                          {r.label}
                        </span>
                        <Chip className={r.cls}>{r.badge}</Chip>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {admin.map((a) => (
                      <div key={a.title} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                        <a.icon className="w-5 h-5 mx-auto text-indigo-600 dark:text-indigo-400" />
                        <p className="text-[11px] font-bold mt-1 text-slate-800 dark:text-slate-100">{a.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          >
            <div className="grid gap-2">
              {admin.map((a) => <Tile key={a.title} icon={a.icon} title={a.title} text={a.text} tone={a.tone} />)}
            </div>
          </SlideLayout>
        ),
      });
    }

    // Last: where to find the guide again.
    list.push({
      id: 'done',
      title: 'آماده‌ی شروع هستید',
      subtitle: 'راهنما همیشه در دسترس است',
      icon: CheckCircle2,
      body: (
        <div className="text-center space-y-4 py-2">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-lg">
            <CircleHelp className="w-10 h-10" />
          </div>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            هر زمان سؤالی داشتید، از آیکون <span className="font-bold text-indigo-600 dark:text-indigo-400">؟</span> در بالای صفحه همین راهنما را دوباره باز کنید.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {canCreate && <Chip className="bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300"><Plus className="w-3 h-3" />اولین فعالیت را ثبت کنید</Chip>}
            <Chip className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300"><Bell className="w-3 h-3" />اعلان‌ها را دنبال کنید</Chip>
          </div>
        </div>
      ),
    });

    return list;
  }, [currentUser]);

  const total = slides.length;
  const current = slides[Math.min(index, total - 1)];
  const isFirst = index === 0;
  const isLast = index >= total - 1;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Every opening starts at the first slide; focus moves into the dialog and back afterwards.
  useEffect(() => {
    if (!isOpen) return;
    setIndex(0);
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [isOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowLeft') {
      next(); // right to left: the next slide is on the left
    } else if (e.key === 'ArrowRight') {
      prev();
    } else if (e.key === 'Tab' && dialogRef.current) {
      // Keep keyboard focus inside the guide.
      const focusable: HTMLElement[] = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!isOpen || !current) return null;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-guide-title"
        tabIndex={-1}
        dir="rtl"
        onKeyDown={onKeyDown}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[min(640px,calc(100dvh-1rem))] sm:h-[min(640px,calc(100dvh-2rem))] outline-hidden text-slate-800 dark:text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">راهنمای کاربری | مرحله {toPersianDigits(index + 1)} از {toPersianDigits(total)}</p>
              <h2 id="user-guide-title" className="text-base sm:text-lg font-extrabold truncate">{current.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{current.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن راهنما" title="بستن (Esc)" className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800 shrink-0">
          <div className="h-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>

        {/* Slide (scrolls inside itself only when the screen is too small) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5" aria-live="polite">
          {current.body}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button type="button" onClick={prev} disabled={isFirst} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <ChevronRight className="w-4 h-4" />
            <span>قبلی</span>
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="اسلایدهای راهنما">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`اسلاید ${toPersianDigits(i + 1)}: ${s.title}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${i === index ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'}`}
              />
            ))}
          </div>
          {isLast ? (
            <button type="button" onClick={onClose} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
              <span>شروع کار</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={next} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
              <span>بعدی</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
