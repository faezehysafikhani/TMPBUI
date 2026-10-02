# مدیریت وظایف (Task Manager)

سامانه مدیریت وظایف و پروژه با بورد کانبان، تقویم شمسی، فیلترهای ترکیبی، گفتگوی تیمی و یادداشت‌های شخصی.

ساخته‌شده با React، TypeScript، Express و Tailwind CSS؛ بک‌اند آن NexusCore (ASP.NET Core) است.

## قابلیت‌ها

- بورد کانبان با جابه‌جایی کشیدنی و وضعیت‌های قابل تنظیم
- مدیریت پروژه‌ها، زیرفعالیت‌ها و تحلیل انحراف زمان‌بندی
- تقویم جلالی و نمای کارهای معوقه
- جستجو و فیلترهای ترکیبی و سفارشی
- گفتگوی تیمی، اعلان‌ها و مدیریت کاربران و تیم‌ها
- یادداشت‌های شخصی، تم روشن/تیره و پالت‌های رنگی
- خروجی PDF از فهرست قابلیت‌ها
- نصب به‌صورت PWA

## پیش‌نیازها

- Node.js نسخه ۲۰ یا بالاتر
- یک نمونه در حال اجرا از API سامانه NexusCore. در Production آدرس API از
  `config/runtime-config.js` داخل خروجی build خوانده می‌شود و بدون rebuild قابل تغییر است.

## راه‌اندازی

۱. نصب وابستگی‌ها:

```bash
npm install
```

۲. برای توسعه محلی، در صورت نیاز فایل `.env.development` را بر اساس
`.env.development.example` بسازید.

۳. اجرای برنامه در حالت توسعه:

```bash
npm run dev
```

برنامه روی `http://localhost:3000` بالا می‌آید.

## ساخت نسخه تولید

```bash
npm run build
npm start
```

بعد از build، برای استقرار same-origin پشت IIS مقدارهای زیر را در
`dist/config/runtime-config.js` خالی بگذارید:

```js
window.__TMPB_RUNTIME_CONFIG__ = {
  apiBaseUrl: "",
  signalRBaseUrl: "",
  tenantSlug: "",
  requestTimeoutMs: 30000
};
```

در این حالت فرانت‌اند API را از `/api` و SignalR را از `/hubs/...` مصرف می‌کند.
اگر Backend روی origin جداست، فقط همین فایل runtime را روی سرور تغییر دهید؛ نیازی به
تغییر سورس یا اجرای دوباره `npm run build` نیست.

## دستورات

| دستور | کاربرد |
| --- | --- |
| `npm run dev` | اجرای سرور توسعه به‌همراه Vite |
| `npm run build` | ساخت خروجی فرانت‌اند و باندل سرور |
| `npm start` | اجرای نسخه ساخته‌شده |
| `npm run lint` | بررسی نوع‌ها با TypeScript |
| `npm run clean` | پاک‌کردن خروجی‌های ساخت |

## ساختار پروژه

```
api/          نقطه ورود برای استقرار روی Vercel
public/       آیکون‌ها، manifest و service worker
scripts/      ابزار ساخت آیکون‌ها
src/
  components/ کامپوننت‌های رابط کاربری
  services/   ارتباط با API سامانه NexusCore
  utils/      توابع کمکی، تاریخ شمسی، تم و ذخیره‌سازی
server.ts     سرور Express
```
