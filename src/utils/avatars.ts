export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
}

// Helper to create unique gradient SVG data URLs for avatars
const createSvgAvatar = (bg1: string, bg2: string, emojiOrIcon: string, idSuffix: string = '') => {
  const gradId = `grad-${bg1.replace('#','')}-${bg2.replace('#','')}-${idSuffix}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#${gradId})" />
    <text x="50%" y="52%" dominant-baseline="central" text-anchor="middle" font-size="62" font-family="system-ui, sans-serif">${emojiOrIcon}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'avatar-1', name: 'مدیر پروژه', url: createSvgAvatar('#4f46e5', '#7c3aed', '👨‍💼', '1') },
  { id: 'avatar-2', name: 'طراح خلاق', url: createSvgAvatar('#059669', '#0d9488', '👩‍🎨', '2') },
  { id: 'avatar-3', name: 'توسعه‌دهنده', url: createSvgAvatar('#2563eb', '#0891b2', '👨‍💻', '3') },
  { id: 'avatar-4', name: 'سرپرست تیم', url: createSvgAvatar('#e11d48', '#db2777', '👩‍💼', '4') },
  { id: 'avatar-5', name: 'کارشناس فنی', url: createSvgAvatar('#d97706', '#ea580c', '👨‍🔧', '5') },
  { id: 'avatar-6', name: 'پژوهشگر', url: createSvgAvatar('#9333ea', '#c026d3', '👩‍🔬', '6') },
  { id: 'avatar-7', name: 'استاد آموزگار', url: createSvgAvatar('#0284c7', '#2563eb', '👩‍🏫', '7') },
  { id: 'avatar-8', name: 'دانش‌آموخته', url: createSvgAvatar('#475569', '#1e293b', '👨‍🎓', '8') },
  { id: 'avatar-9', name: 'فضانورد', url: createSvgAvatar('#0f172a', '#3b82f6', '👨‍🚀', '9') },
  { id: 'avatar-10', name: 'پزشک کارشناس', url: createSvgAvatar('#06b6d4', '#0284c7', '👩‍⚕️', '10') },
  { id: 'avatar-11', name: 'قهرمان طلایی', url: createSvgAvatar('#eab308', '#ca8a04', '🏆', '11') },
  { id: 'avatar-12', name: 'ستاره درخشان', url: createSvgAvatar('#f43f5e', '#be123c', '🌟', '12') },
  { id: 'avatar-13', name: 'روباه باهوش', url: createSvgAvatar('#f97316', '#ea580c', '🦊', '13') },
  { id: 'avatar-14', name: 'شیر شجاع', url: createSvgAvatar('#d97706', '#b45309', '🦁', '14') },
  { id: 'avatar-15', name: 'پاندای آرام', url: createSvgAvatar('#334155', '#0f172a', '🐼', '15') },
  { id: 'avatar-16', name: 'جغد دانا', url: createSvgAvatar('#7c3aed', '#5b21b6', '🦉', '16') },
  { id: 'avatar-17', name: 'موشک پیشتاز', url: createSvgAvatar('#0284c7', '#1d4ed8', '🚀', '17') },
  { id: 'avatar-18', name: 'الماس گرانبها', url: createSvgAvatar('#06b6d4', '#0e7490', '💎', '18') },
  { id: 'avatar-19', name: 'تاج پادشاهی', url: createSvgAvatar('#eab308', '#a16207', '👑', '19') },
  { id: 'avatar-20', name: 'جرقه انرژی', url: createSvgAvatar('#f59e0b', '#dc2626', '⚡', '20') },
  { id: 'avatar-21', name: 'هدف و نشانه', url: createSvgAvatar('#ef4444', '#991b1b', '🎯', '21') },
  { id: 'avatar-22', name: 'گل شبدر شانسی', url: createSvgAvatar('#10b981', '#047857', '🍀', '22') },
  { id: 'avatar-23', name: 'اسب تک‌شاخ', url: createSvgAvatar('#ec4899', '#8b5cf6', '🦄', '23') },
  { id: 'avatar-24', name: 'موج اقیانوس', url: createSvgAvatar('#3b82f6', '#1d4ed8', '🌊', '24') },
];

/**
 * Utility to compress/resize image files before setting as user avatar data URL.
 * Ensures uploaded profile pictures stay strictly under 200 KB limit.
 */
export function compressImageFile(
  file: File,
  maxWidth = 250,
  maxHeight = 250,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('امکان ایجاد بوم تصویر برای فشرده‌سازی وجود ندارد.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('بارگذاری فایل تصویر ناموفق بود.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود.'));
    reader.readAsDataURL(file);
  });
}

