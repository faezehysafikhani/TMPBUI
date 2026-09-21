import React, { useState, useEffect } from 'react';
import { Priority, TaskStatus, PRIORITIES, STATUSES, User } from '../types';
import {
  Search,
  ChevronDown,
  Check,
  AlertTriangle,
  Layers,
  X,
  UserCheck,
  Tag,
  Bookmark,
  BookmarkPlus,
  Trash2,
} from 'lucide-react';

export interface SavedFilter {
  id: string;
  name: string;
  searchQuery: string;
  statusFilter: TaskStatus | 'all';
  priorityFilter: Priority | 'all';
  assigneeFilter: string;
  tagFilter: string;
  createdAt: string;
  isCustom?: boolean;
}

const DEFAULT_PRESETS: SavedFilter[] = [
  {
    id: 'preset_high_priority',
    name: '⭐ کارهای با اهمیت زیاد',
    searchQuery: '',
    statusFilter: 'all',
    priorityFilter: 'high',
    assigneeFilter: 'all',
    tagFilter: 'all',
    createdAt: new Date().toISOString(),
    isCustom: false,
  },
  {
    id: 'preset_in_progress',
    name: '🚀 کارهای در حال اجرا',
    searchQuery: '',
    statusFilter: 'in_progress',
    priorityFilter: 'all',
    assigneeFilter: 'all',
    tagFilter: 'all',
    createdAt: new Date().toISOString(),
    isCustom: false,
  },
  {
    id: 'preset_projects',
    name: '📁 پروژه‌ها و زیرفعالیت‌ها',
    searchQuery: '',
    statusFilter: 'all',
    priorityFilter: 'all',
    assigneeFilter: 'all',
    tagFilter: '__is_project',
    createdAt: new Date().toISOString(),
    isCustom: false,
  },
];

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: TaskStatus | 'all';
  setStatusFilter: (status: TaskStatus | 'all') => void;
  priorityFilter: Priority | 'all';
  setPriorityFilter: (priority: Priority | 'all') => void;
  assigneeFilter: string;
  setAssigneeFilter: (assignee: string) => void;
  tagFilter: string;
  setTagFilter: (tag: string) => void;
  teamMembers: { id: string; name: string }[];
  availableTags: string[];
  currentUser?: User | null;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  assigneeFilter,
  setAssigneeFilter,
  tagFilter,
  setTagFilter,
  teamMembers,
  availableTags,
  currentUser,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<
    'status' | 'priority' | 'assignee' | 'tag' | 'saved' | null
  >(null);

  const [isSavingNewFilter, setIsSavingNewFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const userStorageKey = `saved_filters_${currentUser?.id || 'guest'}`;

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const saved = localStorage.getItem(userStorageKey);
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch (e) {
      return DEFAULT_PRESETS;
    }
  });

  // Load saved filters whenever user context changes
  useEffect(() => {
    try {
      const key = `saved_filters_${currentUser?.id || 'guest'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      } else {
        setSavedFilters(DEFAULT_PRESETS);
      }
    } catch (e) {
      setSavedFilters(DEFAULT_PRESETS);
    }
  }, [currentUser?.id]);

  const toggleDropdown = (
    name: 'status' | 'priority' | 'assignee' | 'tag' | 'saved'
  ) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const closeDropdowns = () => {
    setActiveDropdown(null);
    setIsSavingNewFilter(false);
    setNewFilterName('');
  };

  const handleApplySavedFilter = (sf: SavedFilter) => {
    setSearchQuery(sf.searchQuery || '');
    setStatusFilter(sf.statusFilter || 'all');
    setPriorityFilter(sf.priorityFilter || 'all');
    setAssigneeFilter(sf.assigneeFilter || 'all');
    setTagFilter(sf.tagFilter || 'all');
    closeDropdowns();
  };

  const handleSaveCurrentFilter = () => {
    if (!newFilterName.trim()) return;

    const newFilterObj: SavedFilter = {
      id: `custom_${Date.now()}`,
      name: newFilterName.trim(),
      searchQuery,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      tagFilter,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    const updated = [newFilterObj, ...savedFilters];
    setSavedFilters(updated);
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save custom filter:', e);
    }

    setNewFilterName('');
    setIsSavingNewFilter(false);
  };

  const handleDeleteSavedFilter = (e: React.MouseEvent, filterId: string) => {
    e.stopPropagation();
    const updated = savedFilters.filter((sf) => sf.id !== filterId);
    setSavedFilters(updated);
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not delete saved filter:', e);
    }
  };

  const currentStatusTitle =
    statusFilter === 'all' ? 'وضعیت' : STATUSES[statusFilter]?.title || 'وضعیت';

  const currentPriorityTitle =
    priorityFilter === 'all'
      ? 'اهمیت'
      : PRIORITIES[priorityFilter]?.title || 'اهمیت';

  const selectedMemberName =
    assigneeFilter === 'all'
      ? 'مسئول اجرا'
      : assigneeFilter === 'unassigned'
      ? 'بدون مسئول'
      : teamMembers.find((m) => m.id === assigneeFilter)?.name || 'مسئول اجرا';

  const selectedTagTitle =
    tagFilter === 'all'
      ? 'برچسب کاری'
      : tagFilter === '__is_project'
      ? '📁 نوع پروژه'
      : tagFilter === '__is_recurring'
      ? '🔄 فعالیت تکرارشونده'
      : `#${tagFilter}`;

  const isFiltered =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    tagFilter !== 'all' ||
    searchQuery !== '';

  return (
    <div className="bg-white dark:bg-slate-800/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Controls Row - 1 Search input + 4 Icon Dropdowns + 1 Saved Filters Dropdown */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-2 flex-1 min-w-0">
          
          {/* 1. Title / Search Input */}
          <div className="relative col-span-2 sm:col-span-1 min-w-0">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو..."
              className="w-full pr-8 pl-7 sm:pr-9 sm:pl-8 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Status Filter Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => toggleDropdown('status')}
              className="w-full flex items-center justify-between gap-1 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 active:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">
                  <strong className={statusFilter === 'all' ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-indigo-600 dark:text-indigo-400 font-bold'}>
                    {currentStatusTitle}
                  </strong>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {activeDropdown === 'status' && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeDropdowns} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs overflow-hidden animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>همه وضعیت‌ها</span>
                    {statusFilter === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  {(Object.keys(STATUSES) as TaskStatus[]).map((st) => {
                    const cfg = STATUSES[st];
                    const isSelected = statusFilter === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setStatusFilter(st);
                          closeDropdowns();
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{cfg.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 3. Priority Filter Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => toggleDropdown('priority')}
              className="w-full flex items-center justify-between gap-1 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 active:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">
                  <strong className={priorityFilter === 'all' ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                    {currentPriorityTitle}
                  </strong>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {activeDropdown === 'priority' && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeDropdowns} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs overflow-hidden animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter('all');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      priorityFilter === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>همه اولویت‌ها</span>
                    {priorityFilter === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  {(Object.keys(PRIORITIES) as Priority[]).map((pr) => {
                    const cfg = PRIORITIES[pr];
                    const isSelected = priorityFilter === pr;
                    return (
                      <button
                        key={pr}
                        type="button"
                        onClick={() => {
                          setPriorityFilter(pr);
                          closeDropdowns();
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                          isSelected
                            ? `${cfg.bgColor} ${cfg.textColor} font-bold`
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>اولویت {cfg.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 4. Assignee Filter Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => toggleDropdown('assignee')}
              className="w-full flex items-center justify-between gap-1 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 active:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  <strong className={assigneeFilter === 'all' ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-amber-700 dark:text-amber-400 font-bold'}>
                    {selectedMemberName}
                  </strong>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {activeDropdown === 'assignee' && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeDropdowns} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs overflow-hidden animate-in fade-in zoom-in-95 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeFilter('all');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      assigneeFilter === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>همه مسئولین</span>
                    {assigneeFilter === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeFilter('unassigned');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      assigneeFilter === 'unassigned'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>بدون مسئول</span>
                    {assigneeFilter === 'unassigned' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  {teamMembers.map((member) => {
                    const isSelected = assigneeFilter === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setAssigneeFilter(member.id);
                          closeDropdowns();
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="truncate">{member.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 5. Tag Filter Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => toggleDropdown('tag')}
              className="w-full flex items-center justify-between gap-1 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 active:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  <strong className={tagFilter === 'all' ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                    {selectedTagTitle}
                  </strong>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {activeDropdown === 'tag' && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeDropdowns} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs overflow-hidden animate-in fade-in zoom-in-95 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTagFilter('all');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      tagFilter === 'all'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>همه برچسب‌ها</span>
                    {tagFilter === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  {/* Special Filter Options: Project Type & Recurring Tasks */}
                  <button
                    type="button"
                    onClick={() => {
                      setTagFilter('__is_project');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      tagFilter === '__is_project'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>📁 نوع پروژه (پروژه‌ها)</span>
                    {tagFilter === '__is_project' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTagFilter('__is_recurring');
                      closeDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                      tagFilter === '__is_recurring'
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>🔄 فعالیت تکرارشونده</span>
                    {tagFilter === '__is_recurring' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

                  {availableTags.length === 0 ? (
                    <div className="px-3.5 py-2 text-slate-400 text-[11px] text-center">
                      هیچ برچسبی یافت نشد
                    </div>
                  ) : (
                    availableTags.map((t) => {
                      const isSelected = tagFilter === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTagFilter(t);
                            closeDropdowns();
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-right transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="truncate">#{t}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* 6. Custom Saved Filters Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => toggleDropdown('saved')}
              className="w-full flex items-center justify-between gap-1 px-2.5 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl border border-purple-200 dark:border-purple-800/60 shadow-2xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Bookmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 fill-purple-600/20" />
                <span className="truncate">
                  <strong>فیلترهای سفارشی</strong>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            </button>

            {activeDropdown === 'saved' && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeDropdowns} />
                <div className="absolute left-0 sm:left-auto right-0 top-full mt-1.5 z-30 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs overflow-hidden animate-in fade-in zoom-in-95 max-h-80 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                      <Bookmark className="w-3.5 h-3.5 text-purple-500" />
                      <span>فیلترهای ذخیره‌شده کاربر</span>
                    </span>
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-bold">
                      {savedFilters.length} مورد
                    </span>
                  </div>

                  {/* Save current filter button / form */}
                  {isFiltered && (
                    <div className="p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 space-y-2">
                      {!isSavingNewFilter ? (
                        <button
                          type="button"
                          onClick={() => setIsSavingNewFilter(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs transition-all cursor-pointer shadow-xs"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>ذخیره ترکیب فیلتر فعلی</span>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-200">
                            نام برای فیلتر ترکیبی:
                          </label>
                          <input
                            type="text"
                            value={newFilterName}
                            onChange={(e) => setNewFilterName(e.target.value)}
                            placeholder="مثلاً: کارهای فوری من..."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={handleSaveCurrentFilter}
                              disabled={!newFilterName.trim()}
                              className="px-2.5 py-1 bg-purple-600 disabled:opacity-50 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold transition-all cursor-pointer"
                            >
                              ذخیره
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSavingNewFilter(false);
                                setNewFilterName('');
                              }}
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-[11px] transition-all cursor-pointer"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* List of Saved Filters */}
                  <div className="space-y-1 pt-1">
                    {savedFilters.map((sf) => {
                      // Check if matches active filters
                      const isActiveMatch =
                        searchQuery === sf.searchQuery &&
                        statusFilter === sf.statusFilter &&
                        priorityFilter === sf.priorityFilter &&
                        assigneeFilter === sf.assigneeFilter &&
                        tagFilter === sf.tagFilter;

                      // Criteria chips
                      const criteria: string[] = [];
                      if (sf.searchQuery) criteria.push(`جستجو: "${sf.searchQuery}"`);
                      if (sf.statusFilter !== 'all')
                        criteria.push(`وضعیت: ${STATUSES[sf.statusFilter]?.title || sf.statusFilter}`);
                      if (sf.priorityFilter !== 'all')
                        criteria.push(`اهمیت: ${PRIORITIES[sf.priorityFilter]?.title || sf.priorityFilter}`);
                      if (sf.assigneeFilter !== 'all') {
                        const mName =
                          sf.assigneeFilter === 'unassigned'
                            ? 'بدون مسئول'
                            : teamMembers.find((m) => m.id === sf.assigneeFilter)?.name || 'مسئول';
                        criteria.push(`مسئول: ${mName}`);
                      }
                      if (sf.tagFilter !== 'all') {
                        const tTitle =
                          sf.tagFilter === '__is_project'
                            ? 'پروژه‌ها'
                            : sf.tagFilter === '__is_recurring'
                            ? 'تکرارشونده'
                            : `#${sf.tagFilter}`;
                        criteria.push(tTitle);
                      }

                      return (
                        <div
                          key={sf.id}
                          onClick={() => handleApplySavedFilter(sf)}
                          className={`group p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                            isActiveMatch
                              ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 shadow-xs'
                              : 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              {isActiveMatch && (
                                <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                              )}
                              <span>{sf.name}</span>
                            </span>

                            {sf.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSavedFilter(e, sf.id)}
                                className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="حذف فیلتر سفارشی"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Criteria Summary Pills */}
                          {criteria.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {criteria.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[9px] bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded-md"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400">همه موارد</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Clear Filters Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setAssigneeFilter('all');
              setTagFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline px-2 py-1 self-end lg:self-center shrink-0 cursor-pointer"
          >
            حذف فیلترها
          </button>
        )}

      </div>
    </div>
  );
};
