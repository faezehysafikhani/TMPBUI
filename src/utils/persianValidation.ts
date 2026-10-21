// The browser's own messages for form fields ("Please fill out this field.") follow its language,
// not the app's. This puts Persian messages on every native check (required, email, length...)
// in one place, so no form shows English.

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function messageFor(field: Field): string {
  const v = field.validity;
  if (v.valueMissing) return field instanceof HTMLSelectElement ? 'لطفاً یک گزینه را انتخاب کنید.' : 'لطفاً این فیلد را پر کنید.';
  if (v.typeMismatch) {
    if (field.type === 'email') return 'لطفاً یک نشانی ایمیل معتبر وارد کنید.';
    if (field.type === 'url') return 'لطفاً یک نشانی اینترنتی معتبر وارد کنید.';
    return 'مقدار واردشده معتبر نیست.';
  }
  const digits = (n: number) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  if (v.tooShort && 'minLength' in field) return `حداقل ${digits(field.minLength)} نویسه لازم است.`;
  if (v.tooLong && 'maxLength' in field) return `حداکثر ${digits(field.maxLength)} نویسه مجاز است.`;
  if (v.patternMismatch) return field.title || 'قالب مقدار واردشده درست نیست.';
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch) return 'مقدار واردشده خارج از محدودهٔ مجاز است.';
  if (v.badInput) return 'مقدار واردشده معتبر نیست.';
  return '';
}

function isField(target: EventTarget | null): target is Field {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function installPersianValidationMessages(): void {
  if (typeof document === 'undefined') return;
  // Capture phase: "invalid" does not bubble.
  document.addEventListener('invalid', (e) => {
    if (!isField(e.target)) return;
    const field = e.target;
    field.setCustomValidity('');
    if (!field.validity.valid) field.setCustomValidity(messageFor(field));
  }, true);
  // Once the value changes, let the field be checked afresh.
  const clear = (e: Event) => { if (isField(e.target)) e.target.setCustomValidity(''); };
  document.addEventListener('input', clear, true);
  document.addEventListener('change', clear, true);
}
