import { PageHeader, btnPrimary } from './layout/PageHeader';
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Pin,
  Trash2,
  Edit2,
  Search,
  Check,
  Copy,
  X,
  Lock,
  Sparkles,
  Paperclip,
  Download,
  Image as ImageIcon,
  File,
  UploadCloud,
  CheckSquare,
} from 'lucide-react';
import { User, PersonalNote, NoteAttachment, AppColorPalette, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_LABEL } from '../types';
import { toPersianDigits, formatFileSize } from '../utils/helpers';
import { COLOR_PALETTES } from '../utils/theme';
import { readFileAsDataUrl } from '../utils/storage';
import { isAllowedUploadFile, UPLOAD_TYPE_ERROR_MESSAGE, ALLOWED_UPLOAD_ACCEPT } from '../utils/uploadPolicy';
import {
  fetchPersonalNotesPB,
  createPersonalNotePB,
  updatePersonalNotePB,
  deletePersonalNotePB,
} from '../services/dataService';
import { appAlert, appConfirm } from '../utils/appDialog';
import { copyText } from '../utils/clipboard';
import { showToast } from '../utils/toast';

interface PersonalNotesViewProps {
  currentUser: User | null;
  appColorPalette?: AppColorPalette;
  /** `onCreated` runs with the new task's id once the task has really been saved. */
  onConvertToTask?: (title: string, description?: string, onCreated?: (taskId: string) => void) => void;
}

const NOTE_DOT: Record<string, string> = { amber: 'bg-amber-400', indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', cyan: 'bg-cyan-500', slate: 'bg-slate-400' };
const COLOR_NAMES: Record<string, string> = { amber: 'زرد', indigo: 'نیلی', emerald: 'سبز', rose: 'قرمز', cyan: 'آبی', slate: 'خاکستری' };

const COLOR_CONFIGS: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  amber: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/80',
    badge: 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200',
    text: 'text-amber-900 dark:text-amber-100',
  },
  indigo: {
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800/80',
    badge: 'bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200',
    text: 'text-indigo-900 dark:text-indigo-100',
  },
  emerald: {
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/80',
    badge: 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200',
    text: 'text-emerald-900 dark:text-emerald-100',
  },
  rose: {
    bg: 'bg-rose-50/80 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800/80',
    badge: 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200',
    text: 'text-rose-900 dark:text-rose-100',
  },
  cyan: {
    bg: 'bg-cyan-50/80 dark:bg-cyan-950/40',
    border: 'border-cyan-200 dark:border-cyan-800/80',
    badge: 'bg-cyan-200 dark:bg-cyan-900 text-cyan-900 dark:text-cyan-200',
    text: 'text-cyan-900 dark:text-cyan-100',
  },
  slate: {
    bg: 'bg-slate-100/80 dark:bg-slate-800/80',
    border: 'border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
    text: 'text-slate-900 dark:text-slate-100',
  },
};

export const PersonalNotesView: React.FC<PersonalNotesViewProps> = ({
  currentUser,
  appColorPalette = 'indigo',
  onConvertToTask,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State for Note Form
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);

  // Note Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formColor, setFormColor] = useState<string>('amber');
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [formAttachments, setFormAttachments] = useState<NoteAttachment[]>([]);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Notes already made into a task (note id -> task id), kept in this browser per person so the card can show it.
  const convertedKey = `parstask_note_tasks_${currentUser?.id ?? ''}`;
  const [convertedNotes, setConvertedNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setConvertedNotes(JSON.parse(localStorage.getItem(convertedKey) || '{}') || {}); } catch { setConvertedNotes({}); }
  }, [convertedKey]);
  const markConverted = (noteId: string, taskId: string) => {
    setConvertedNotes((current) => {
      const next = { ...current, [noteId]: taskId };
      try { localStorage.setItem(convertedKey, JSON.stringify(next)); } catch { /* storage unavailable: shown until reload */ }
      return next;
    });
  };
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // Load Notes with cache-first approach for instant initial load
  useEffect(() => {
    if (!currentUser) return;

    // Load from local storage cache first
    const cacheKey = `parstask_notes_${currentUser.id}`;
    let hasCache = false;
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const cachedNotes = JSON.parse(local);
        if (Array.isArray(cachedNotes) && cachedNotes.length > 0) {
          setNotes(cachedNotes);
          setIsLoading(false);
          hasCache = true;
        }
      }
    } catch (err) {
      console.warn('Failed parsing cached personal notes', err);
    }

    const loadNotes = async () => {
      if (!hasCache) {
        setIsLoading(true);
      }
      const data = await fetchPersonalNotesPB(currentUser.id);
      setNotes(data);
      setIsLoading(false);
    };

    loadNotes();
  }, [currentUser]);

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormColor('amber');
    setFormIsPinned(false);
    setFormAttachments([]);
    setIsModalOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (note: PersonalNote) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormColor(note.color || 'amber');
    setFormIsPinned(!!note.isPinned);
    setFormAttachments(note.attachments || []);
    setIsModalOpen(true);
  };

  // Handle Note File Upload
  const handleNoteFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAtts: NoteAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isAllowedUploadFile(file)) {
        void appAlert(UPLOAD_TYPE_ERROR_MESSAGE);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        void appAlert(`حجم فایل «${file.name}» بیشتر از ${MAX_ATTACHMENT_LABEL} است.`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        newAtts.push({
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to read note attachment:', err);
      }
    }

    setFormAttachments((prev) => [...prev, ...newAtts]);
    setIsUploading(false);
    if (noteFileInputRef.current) noteFileInputRef.current.value = '';
  };

  // Handle Remove Attachment
  const handleRemoveAttachment = (attId: string) => {
    setFormAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  // Save Note (Create or Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !currentUser) return;

    if (editingNote) {
      // Update
      const updated = await updatePersonalNotePB(editingNote.id, currentUser.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        color: formColor,
        isPinned: formIsPinned,
        attachments: formAttachments,
      });

      setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? updated : n)));
    } else {
      // Create
      const created = await createPersonalNotePB(currentUser.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        color: formColor,
        isPinned: formIsPinned,
        attachments: formAttachments,
      });

      setNotes((prev) => [created, ...prev]);
    }

    setIsModalOpen(false);
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    if (!currentUser) return;
    if (!(await appConfirm('آیا از حذف این یادداشت شخصی مطمئن هستید؟'))) return;

    await deletePersonalNotePB(id, currentUser.id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Toggle Pin Status directly from card
  const handleTogglePin = async (note: PersonalNote) => {
    if (!currentUser) return;
    const newPinned = !note.isPinned;

    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, isPinned: newPinned } : n))
    );

    await updatePersonalNotePB(note.id, currentUser.id, { isPinned: newPinned });
  };

  // Copy Note Text
  const handleCopyNote = async (note: PersonalNote) => {
    const fullText = `${note.title}\n\n${note.content}`;
    if (!(await copyText(fullText))) { showToast('کپی انجام نشد.', 'error'); return; }
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Filter & Sort Notes
  const filteredNotes = notes.filter(
    (n) =>
      (!colorFilter || (n.color || 'amber') === colorFilter) &&
      (n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Separate Pinned and Unpinned
  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-sm my-auto">
        <Lock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">یادداشت‌های شخصی و محرمانه</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">جهت ثبت و دسترسی به دفترچه یادداشت اختصاصی خود وارد حساب کاربری شوید.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      
      <PageHeader
        title="یادداشت شخصی"
        subtitle={`ایده‌ها، یادآوری‌ها و چک‌لیست‌های شخصی شما؛ فقط خودتان می‌بینید. ${toPersianDigits(notes.length)} یادداشت`}
        actions={<button type="button" onClick={handleOpenCreate} className={btnPrimary}><Plus className="w-4 h-4" /> یادداشت جدید</button>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در عنوان و متن…"
              aria-label="جستجو در یادداشت‌ها"
              className="w-full h-10 pr-9 pl-3 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80" role="group" aria-label="رنگ">
            <button type="button" onClick={() => setColorFilter('')} aria-pressed={!colorFilter} className={`h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer ${!colorFilter ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>همه</button>
            {Object.keys(COLOR_CONFIGS).map((c) => (
              <button key={c} type="button" onClick={() => setColorFilter(colorFilter === c ? '' : c)} aria-pressed={colorFilter === c} aria-label={`رنگ ${COLOR_NAMES[c] || c}`} title={COLOR_NAMES[c] || c}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${colorFilter === c ? 'bg-white shadow-sm dark:bg-slate-900' : 'hover:bg-white/60 dark:hover:bg-slate-900/60'}`}>
                <span className={`w-3.5 h-3.5 rounded-full ${NOTE_DOT[c]}`} />
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* Main Grid Content */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-semibold">
          در حال بارگذاری یادداشت‌ها...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <span className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center"><Sparkles className="w-7 h-7 text-indigo-500" /></span>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{searchQuery.trim() || colorFilter ? 'یادداشتی با این جستجو پیدا نشد' : 'هنوز یادداشتی ندارید'}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery.trim()
              ? 'عبارت دیگری را جستجو کنید یا جستجو را پاک کنید.'
              : 'اولین یادداشت شخصی، ایده یا چک‌لیست خود را ثبت نمایید.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className={`${btnPrimary} mt-2`}
          >
            <Plus className="w-4 h-4" />
            <span>ثبت یادداشت جدید</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Pin className="w-3.5 h-3.5" />
                <span>سنجاق‌شده‌ها · {toPersianDigits(pinnedNotes.length)}</span>
              </div>

              <div className="columns-1 md:columns-2 xl:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                {pinnedNotes.map((note) => renderNoteCard(note))}
              </div>
            </div>
          )}

          {/* Unpinned Section */}
          {unpinnedNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 pt-2">
                  <span>سایر یادداشت‌ها · {toPersianDigits(unpinnedNotes.length)}</span>
                </div>
              )}

              <div className="columns-1 md:columns-2 xl:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                {unpinnedNotes.map((note) => renderNoteCard(note))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* CREATE / EDIT NOTE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in">
          <div role="dialog" aria-modal="true" className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-5 p-6">
            
            {/* Modal Header */}
            <div className="-mx-6 -mt-6 px-6 h-16 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center"><FileText className="w-5 h-5" /></span>
                <span>{editingNote ? 'ویرایش یادداشت شخصی' : 'ثبت یادداشت شخصی جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note Form */}
            <form onSubmit={handleSaveNote} className="app-form space-y-4">
              {/* Title */}
              <div className="rounded-2xl border border-indigo-100/80 dark:border-indigo-900/50 bg-indigo-50/35 dark:bg-indigo-950/20 p-3.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان یادداشت <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="عنوان یا موضوع یادداشت..."
                  className="w-full px-4 py-3 bg-slate-50/80 dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              {/* Content */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/55 dark:bg-slate-900/40 p-3.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  متن و جزئیات یادداشت
                </label>
                <textarea
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="متن یادداشت، ایده‌ها یا اطلاعات محرمانه..."
                  className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all leading-relaxed"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>پیوست فایل و تصویر ({toPersianDigits(formAttachments.length)})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => noteFileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>افزودن فایل</span>
                  </button>
                  <input
                    ref={noteFileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_UPLOAD_ACCEPT}
                    onChange={handleNoteFileSelect}
                    className="hidden"
                  />
                </div>

                {/* List of attached files */}
                {formAttachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {formAttachments.map((att) => {
                      const isImg = att.type?.startsWith('image/') || att.dataUrl?.startsWith('data:image/');
                      return (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            {isImg ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-7 h-7 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <File className="w-5 h-5 text-slate-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                                {att.name}
                              </p>
                              {att.size && (
                                <p className="text-[10px] text-slate-400">
                                  {formatFileSize(att.size)}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                            title="حذف پیوست"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Options Row: Color Picker & Pin Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {/* Color Selector */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                    رنگ کارت
                  </span>
                  <div className="flex items-center gap-2">
                    {Object.keys(COLOR_CONFIGS).map((colorKey) => {
                      const cfg = COLOR_CONFIGS[colorKey];
                      const isSelected = formColor === colorKey;
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setFormColor(colorKey)}
                          className={`w-7 h-7 rounded-xl ${cfg.bg} ${cfg.border} border-2 transition-transform cursor-pointer flex items-center justify-center ${
                            isSelected ? 'scale-110 ring-2 ring-indigo-500' : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-slate-100" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pin Toggle Button */}
                <button
                  type="button"
                  onClick={() => setFormIsPinned((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    formIsPinned
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Pin className={`w-4 h-4 ${formIsPinned ? 'fill-amber-500 text-amber-600' : ''}`} />
                  <span>{formIsPinned ? 'سنجاق شده' : 'سنجاق کردن'}</span>
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className={`px-5 py-2.5 ${palette.accentBg} ${palette.accentHover} text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer`}
                >
                  {editingNote ? 'ذخیره تغییرات' : 'ثبت یادداشت'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );

  // Helper renderer for Note Card
  function renderNoteCard(note: PersonalNote) {
    const cfg = COLOR_CONFIGS[note.color || 'amber'] || COLOR_CONFIGS.amber;
    const dateStr = new Date(note.createdAt).toLocaleDateString('fa-IR');

    return (
      <article
        key={note.id}
        className="group relative flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all"
      >
        <span className={`absolute top-0 right-4 left-4 h-1 rounded-b-full ${NOTE_DOT[note.color || 'amber'] || NOTE_DOT.amber}`} aria-hidden="true" />
        <div className="flex items-start gap-2 pt-1">
          <h3 className="flex-1 min-w-0 text-base font-bold leading-7 break-words text-slate-900 dark:text-white">{note.title}</h3>
          <button
            type="button"
            onClick={() => handleTogglePin(note)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${note.isPinned ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
            title={note.isPinned ? 'برداشتن سنجاق' : 'سنجاق به بالا'}
            aria-label={note.isPinned ? 'برداشتن سنجاق' : 'سنجاق به بالا'}
            aria-pressed={!!note.isPinned}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>
        </div>

        {note.content && (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-7 whitespace-pre-wrap break-words line-clamp-[10]">{note.content}</p>
        )}

        {note.attachments && note.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.attachments.map((att) => {
              const isImg = att.type?.startsWith('image/') || att.dataUrl?.startsWith('data:image/');
              return (
                <a key={att.id} href={att.dataUrl} download={att.name} target="_blank" rel="noreferrer" title={`دانلود ${att.name}`}
                  className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300">
                  {isImg ? <ImageIcon className="w-3.5 h-3.5 shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <Download className="w-3 h-3 shrink-0 opacity-60" />
                </a>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <span className="tabular-nums">{toPersianDigits(dateStr)}</span>
          {onConvertToTask && (convertedNotes[note.id] ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400" title="از این یادداشت فعالیت ساخته شده است">
              <CheckSquare className="w-3.5 h-3.5" /> به فعالیت تبدیل شد
            </span>
          ) : (
            <button type="button" onClick={() => onConvertToTask(note.title, note.content || '', (taskId) => markConverted(note.id, taskId))}
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer" title="ساختن فعالیت از این یادداشت">
              <CheckSquare className="w-3.5 h-3.5" /> تبدیل به فعالیت
            </button>
          ))}
          <span className="flex-1" />
          <div className="flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button type="button" onClick={() => handleCopyNote(note)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="رونوشت متن" aria-label="رونوشت متن">
              {copiedNoteId === note.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => handleOpenEdit(note)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="ویرایش" aria-label="ویرایش">
              <Edit2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => handleDeleteNote(note.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" title="حذف" aria-label="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>
    );
  }
};
