import React from 'react';
import {
  Printer,
  FileText,
  CheckCircle2,
  Sparkles,
  Kanban,
  MessageSquare,
  Users,
  Filter,
  ListTodo,
  FolderPlus,
  BookOpen,
} from 'lucide-react';
import { toPersianDigits, formatToJalali } from '../utils/helpers';

interface FeatureListPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureListPdfModal: React.FC<FeatureListPdfModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const openCatalogPrintWindow = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const contentElement = document.getElementById('pdf-report-content');
    const contentHtml = contentElement ? contentElement.innerHTML : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>دفترچه راهنما و کاتالوگ امکانات سامانه</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Vazirmatn', sans-serif; background: #f8fafc; color: #0f172a; padding: 16px; margin: 0; }
          @media print {
            body { background: #ffffff; padding: 0; }
            .no-print { display: none !important; }
            .print-container { border: none !important; shadow: none !important; padding: 0 !important; }
          }
        </style>
      </head>
      <body class="dir-rtl text-right">
        <div class="no-print max-w-3xl mx-auto mb-6 p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl border border-slate-800">
          <div>
            <h3 class="font-black text-sm sm:text-base flex items-center gap-2 text-emerald-400">
              <span>🖨️ پیش‌نمایش دفترچه راهنما و لیست امکانات</span>
            </h3>
            <p class="text-xs text-slate-300 mt-1">جهت چاپ یا ذخیره فایل PDF روی گزینه چاپ کلیک کرده یا در صورت اتمام کار صفحه را ببندید.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="window.print()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95">
              <span>🖨️ چاپ دفترچه / ذخیره PDF</span>
            </button>
            <button onclick="window.close()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all cursor-pointer active:scale-95">
              <span>✕ بستن صفحه</span>
            </button>
          </div>
        </div>

        <div class="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 print-container shadow-sm">
          ${contentHtml}
        </div>

        <script>
          setTimeout(() => {
            window.print();
          }, 600);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentDateJalali = formatToJalali(new Date().toISOString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header Actions */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-center text-center border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-center gap-3 max-w-full">
            <div className="p-2.5 bg-emerald-600/30 border border-emerald-400/30 rounded-2xl shrink-0">
              <FileText className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-center min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis">
                دفترچه راهنما و لیست امکانات سامانه
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                مستندات و شناسنامه جامع کلیه ابزارها و قابلیتهای فعال
              </p>
            </div>
          </div>
        </div>

        {/* Printable Document View */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          <div
            id="pdf-report-content"
            className="bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mx-auto font-sans leading-relaxed text-right space-y-8 dir-rtl"
            style={{ direction: 'rtl' }}
          >
            {/* Document Header */}
            <div className="border-b-2 border-emerald-600 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-right">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-bold text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>سامانه مدیریت وظایف (TM) و پروژه‌های تیمی</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  دفترچه راهنما و شناسنامه امکانات سامانه
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  لیست کامل و به‌روز کلیه قابلیت‌ها، ابزارها و ماژول‌های فعال اپلیکیشن
                </p>
              </div>

              <div className="text-left text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 shrink-0">
                <div>
                  <strong>تاریخ انتشار:</strong> {toPersianDigits(currentDateJalali)}
                </div>
                <div>
                  <strong>نسخه سامانه:</strong> ۳.۰.۰ Pro
                </div>
                <div>
                  <strong>پایگاه داده:</strong> PocketBase / SQLite
                </div>
              </div>
            </div>

            {/* Category 1: مدیریت وظایف */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-700 font-black text-base border-r-4 border-indigo-600 pr-3 py-1 bg-indigo-50/50 rounded-l-xl">
                <ListTodo className="w-5 h-5 text-indigo-600 shrink-0" />
                <h2>۱. مدیریت هوشمند وظایف و زیرفعالیت‌ها (Task Management)</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ثبت کار جدید:</strong> با عنوان، شرح کامل، زمان‌بندی دقیق، برچسب‌ها و تعیین اولویت</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تایپ و ورودی صوتی (Voice-to-Text):</strong> قابلیت ضبط صدا و تبدیل خودکار گفتار به متن فارسی با هوش مصنوعی برای ثبت سریع عنوان و شرح کار</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تخصیص چندگانه هوشمند (Multi-Assignee):</strong> ارجاع همزمان کار به چندین همکار همراه با کلیدهای اقدام سریع («انتخاب همه»، «هیچ‌کدام»، «فقط من»)</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>سطوح اهمیت ۴گانه:</strong> اولویت‌بندی کارها به صورت (کم، متوسط، زیاد، فوری)</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>وضعیت‌های ۴گانه کار:</strong> (در انتظار، در حال اجرا، بررسی، تکمیل شده)</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>چک‌لیست زیرکارها (Sub-tasks):</strong> ثبت زیرفعالیت‌ها با زمان‌بندی و محاسبه خودکار درصد پیشرفت</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>کارهای تکرارشونده:</strong> تعریف وظایف با دوره‌های تکرار روزانه، هفتگی و ماهانه</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پیوست فایل، تصویر و صوت:</strong> آپلود و پخش مستقیم فایل‌های صوتی، اسناد و تصاویر روی هر فعالیت</span>
                </li>
              </ul>
            </section>

            {/* Category 2: پروژه‌ها */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-purple-700 font-black text-base border-r-4 border-purple-600 pr-3 py-1 bg-purple-50/50 rounded-l-xl">
                <FolderPlus className="w-5 h-5 text-purple-600 shrink-0" />
                <h2>۲. مدیریت پروژه‌ها و کنترل انحراف زمان‌بندی (Project Management & Variance Analysis)</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تعریف پروژه مادر:</strong> ثبت پروژه‌های کلان با کد پروژه و بازه زمانی شمسی</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>اتصال کارها به پروژه:</strong> ارتباط مستقیم فعالیت‌ها به پروژه مربوطه و رصد دسته‌بندی‌شده</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>محاسبه پیشرفت واقعی وزنی:</strong> محاسبه درصد پیشرفت دقیق پروژه بر اساس وزن زیرفعالیت‌ها</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پیشرفت برنامه‌ای و سنجش انحراف:</strong> مقایسه خودکار پیشرفت واقعی و برنامه‌ای تا امروز و تعیین وضعیت انحراف (جلوتر، مطابق یا عقب‌تر از برنامه)</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تعیین تیم مسئول پروژه:</strong> ارجاع پروژه به گروه‌های کاری تخصصی سازمان</span>
                </li>
              </ul>
            </section>

            {/* Category 3: نماهای عملیاتی و هوشمند */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-blue-700 font-black text-base border-r-4 border-blue-600 pr-3 py-1 bg-blue-50/50 rounded-l-xl">
                <Kanban className="w-5 h-5 text-blue-600 shrink-0" />
                <h2>۳. نماهای عملیاتی، تقویم جلالی و ناوبری (Kanban, Jalali Calendar & Overdue View)</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>بورد کانبان تعاملی (Kanban Board):</strong> جابه‌جایی سریع و بصری وضعیت کارها</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تقویم شمسی کامل (Jalali Calendar):</strong> پایش بار کاری روزانه و ماهانه با نشانگر روز جاری</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پایش کارهای معوقه (Overdue Tasks):</strong> مرتب‌سازی بر اساس بیشترین تاخیر و اولویت، تفکیک تاخیر شدید و کشیدن به چپ (Swipe) جهت تکمیل سریع</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>انیمیشن بارگذاری مدرن (Loading Spinner):</strong> دایره چرخان ساده و شیک در مرکز صفحه با رنگبندی هماهنگ با تم فعال هنگام جابجایی بین صفحات</span>
                </li>
              </ul>
            </section>

            {/* Category 4: فیلترها و جستجو */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-amber-700 font-black text-base border-r-4 border-amber-600 pr-3 py-1 bg-amber-50/50 rounded-l-xl">
                <Filter className="w-5 h-5 text-amber-600 shrink-0" />
                <h2>۴. جستجو، فیلترهای ترکیبی و فیلترهای سفارشی کاربر</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>جستجوی متنی لحظه‌ای:</strong> جستجو در عنوان، شرح و کد شناسه فعالیت‌ها</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>فیلترهای آیکونی چندگانه:</strong> فیلتر همزمان بر اساس وضعیت، اولویت، مسئول و برچسب</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ذخیره فیلترهای سفارشی:</strong> ذخیره‌سازی ترکیب فیلترهای دلخواه با نام اختصاصی</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پیش‌فرض‌های آماده:</strong> دسترسی سریع به کارهای فوری، کارهای من و پروژه‌ها</span>
                </li>
              </ul>
            </section>

            {/* Category 5: گفتگوی تیمی و اطلاع‌رسانی */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-rose-700 font-black text-base border-r-4 border-rose-600 pr-3 py-1 bg-rose-50/50 rounded-l-xl">
                <MessageSquare className="w-5 h-5 text-rose-600 shrink-0" />
                <h2>۵. گفتگوی تیمی، پیام‌رسان و سیستم اطلاع‌رسانی (Notifications & Chat)</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>چت مستقیم (Direct Message):</strong> گفتگوی ۲نفره بین اعضای تیم با ارسال فایل و پیوست</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>اطلاع‌رسانی پیامکی کاوه‌نگار (Kavenegar SMS):</strong> ارسال هشدارهای پیامکی زمان‌بندی‌شده به همراه کد تایید ورود</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>تبدیل پیام به وظیفه:</strong> تبدیل مستقیم هر پیام چت به یک کار جدید با ۱ کلیک</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>نشانگر پیام‌های خوانده‌نشده:</strong> اعلان و شمارش تعداد پیام‌های جدید و هشدار معوقات</span>
                </li>
              </ul>
            </section>

            {/* Category 6: کاربران، امنیت و استقرار ابری */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-cyan-700 font-black text-base border-r-4 border-cyan-600 pr-3 py-1 bg-cyan-50/50 rounded-l-xl">
                <Users className="w-5 h-5 text-cyan-600 shrink-0" />
                <h2>۶. مدیریت کاربران، امنیت، زیرساخت Vercel و پایگاه‌داده</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پشتیبانی کامل از Vercel & Express API:</strong> معماری کامل سرور و کلاینت (Full-Stack) سازگار با Vercel و پروکسی ایمن API Key</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پایگاه داده PocketBase / SQLite & کش محلی:</strong> ذخیره‌سازی همگام‌سازی‌شده داده‌ها با کارکرد آفلاین</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>احراز هویت و ورود ایمن:</strong> ورود با نام کاربری یا شماره موبایل، همراه با کد امنیتی (CAPTCHA) پس از ورود ناموفق</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>پنل مدیریت کاربران (Admin):</strong> مدیریت نقش‌ها، تنظیمات پیامک و سطح دسترسی کاربران</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>مدیریت تیم‌های کاری:</strong> ایجاد گروه و ساختار تیم‌های سازمانی و تخصیص پروژه</span>
                </li>
              </ul>
            </section>

            {/* Category 7: ویدجت خلاصه ورود، یادداشت‌ها، اعلان‌ها و شخصی‌سازی */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-slate-800 font-black text-base border-r-4 border-slate-700 pr-3 py-1 bg-slate-100 rounded-l-xl">
                <BookOpen className="w-5 h-5 text-slate-700 shrink-0" />
                <h2>۷. ویدجت خلاصه ورود، یادداشت‌ها، تم‌ها و بافت‌های گرافیکی</h2>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>ویدجت پاپ‌آپ خلاصه وضعیت ورود (Welcome Summary Widget):</strong> نمایش پنجره خلاصه عملکرد با آمار کارهای انجام‌شده، معوقات و کارهای فوری در ابتدای ورود</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>۶ پالت رنگی اختصاصی:</strong> انتخاب تم اصلی برنامه از بین ۶ پالت نیلی، زمردی، گلبهی، کهربایی، فیروزه‌ای و زغالی با اعمال خودکار در تمام عناصر</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>۷ طرح بافت گرافیکی پس‌زمینه (Background Patterns):</strong> انتخاب طرح زمینه از بین حالت ساده، شطرنجی، خطوط مورب، شبکه‌ای، نقطه‌ای، چهارخانه و موجی</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>حالت روز و شب (Light / Dark Mode):</strong> تطبیق کامل و آنی تمام صفحات و المان‌ها با حالت شب و تاریک جهت راحتی دید کاربر</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>دفترچه یادداشت‌های دیجیتال شخصی:</strong> ثبت یادداشت‌های روزانه با امکان سنجاق کردن و دسته‌بندی رنگی</span>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>مرکز اعلان‌ها و هشدارهای موعد مقرر:</strong> مشاهده لحظه‌ای رخدادها، تغییرات وظایف و وضعیت پروژه‌ها</span>
                </li>
              </ul>
            </section>

            {/* Document Footer */}
            <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500 space-y-1">
              <p className="font-bold">
                این دفترچه به صورت خودکار مطابق آخرین وضعیت و امکانات فعال برنامه به‌روزرسانی می‌شود.
              </p>
              <p className="text-[10px] text-slate-400">
                طراحی شده با React, TypeScript, Express, PocketBase, Vercel & Tailwind CSS
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs shrink-0 gap-3">
          <span className="text-slate-500 dark:text-slate-400 font-medium text-center sm:text-right text-[11px] sm:text-xs">
            جهت چاپ یا ذخیره فایل PDF روی کلید «چاپ» کلیک فرمایید.
          </span>
          <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={openCatalogPrintWindow}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
              title="چاپ یا ذخیره نسخه PDF"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              بستن صفحه
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

