import { fetchUploadPolicy, UploadPolicy } from '../services/nexusApi';

/** Accepted everywhere a user can upload a file: Excel, Word, PDF and images. */
export const ALLOWED_UPLOAD_EXTENSIONS = ['.xlsx', '.xls', '.doc', '.docx', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

/** For the `accept` attribute of a generic file `<input>` (not the image-only avatar picker). */
export const ALLOWED_UPLOAD_ACCEPT = '.xlsx,.xls,.doc,.docx,.pdf,image/*';

const DEFAULT_MAX_FILE_SIZE_KB = 200;

let cachedPolicy: Promise<UploadPolicy> | null = null;

/** The admin-configured upload limit, cached for the page's lifetime (falls back to 200 KB). */
export function getUploadPolicy(): Promise<UploadPolicy> {
  if (!cachedPolicy) {
    cachedPolicy = fetchUploadPolicy().catch(() => ({
      maxFileSizeKb: DEFAULT_MAX_FILE_SIZE_KB,
      allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS,
    }));
  }
  return cachedPolicy;
}

export function isAllowedUploadFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function formatKbLabel(sizeKb: number): string {
  if (sizeKb >= 1024) {
    const mb = sizeKb / 1024;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} مگابایت`;
  }
  return `${sizeKb} کیلوبایت`;
}

export const UPLOAD_TYPE_ERROR_MESSAGE = 'نوع فایل مجاز نیست. فقط فایل‌های اکسل، ورد، PDF و تصویر قابل بارگذاری هستند.';
