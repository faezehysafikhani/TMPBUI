import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { Task, PRIORITIES, Priority, STATUSES, User } from '../types';
import { toPersianDigits, isOverdue, formatToJalali, getDaysDiff } from '../utils/helpers';
import {
  Clock,
  X,
  MessageSquare,
  Edit2,
  Trash2,
  AlertCircle,
  Calendar,
  Users,
  User as UserIcon
} from 'lucide-react';

interface DashboardChartsProps {
  tasks: Task[];
  currentUser?: User | null;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onViewDetails?: (task: Task) => void;
}

export interface ChartModalItem {
  id: string;
  title: string;
  dueDate: string;
  priority: Priority;
  parentTask: Task;
  isSubTask: boolean;
  subTaskId?: string;
  statusTitle?: string;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  tasks,
  currentUser,
  onEditTask,
  onDeleteTask,
  onViewDetails,
}) => {
  const totalTasks = tasks.length;
  const [assigneeScope, setAssigneeScope] = useState<'all' | 'active'>('active');
  const [activeModalData, setActiveModalData] = useState<{
    title: string;
    items: ChartModalItem[];
  } | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Active tasks count for toggle button
  const activeTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && t.status !== 'paused').length;
  }, [tasks]);

  // Helper to check current user's task permissions
  const checkTaskPermissions = (task: Task) => {
    const isAdmin = !!(
      currentUser &&
      (currentUser.isAdmin ||
        currentUser.role === 'admin' ||
        currentUser.username?.toLowerCase() === 'admin' ||
        currentUser.email?.toLowerCase().startsWith('admin@'))
    );

    const isAssignee = !!(
      currentUser &&
      ((task.assignedUserId && task.assignedUserId === currentUser.id) ||
        (task.assignedUserName &&
          (task.assignedUserName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
            task.assignedUserName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase())))
    );

    const isTeamMember = !!(
      currentUser &&
      ((task.teamMemberIds && task.teamMemberIds.includes(currentUser.id)) ||
        (task.assignedTeamId && currentUser.teams?.some((t) => t.id === task.assignedTeamId)))
    );

    const isTaskCreator = !!(currentUser && task.user && task.user === currentUser.id);

    const isOwnerByDetails = !!(
      currentUser &&
      task.ownerName &&
      (task.ownerName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
        task.ownerName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase() ||
        task.ownerName.trim().toLowerCase() === (currentUser.email || '').trim().toLowerCase()) &&
      !isAssignee
    );

    const canEditTask = isAdmin || isTaskCreator || isAssignee || isTeamMember || isOwnerByDetails;
    const canDeleteTask = isAdmin || isTaskCreator || isOwnerByDetails;

    return { canEditTask, canDeleteTask };
  };

  // 1. Helper to test if a task belongs to current user
  const isTaskForCurrentUser = (t: Task): boolean => {
    if (!currentUser) return true;

    const cName = (currentUser.name || '').trim().toLowerCase();
    const cUsername = (currentUser.username || '').trim().toLowerCase();
    const cId = currentUser.id;

    const isAssigned =
      (t.assignedUserId && t.assignedUserId === cId) ||
      (t.assignedUserName &&
        (t.assignedUserName.trim().toLowerCase() === cName ||
          t.assignedUserName.trim().toLowerCase() === cUsername));

    const isOwner =
      (t.user && t.user === cId) ||
      (t.ownerName &&
        (t.ownerName.trim().toLowerCase() === cName ||
          t.ownerName.trim().toLowerCase() === cUsername));

    const isTeam = t.teamMemberIds && t.teamMemberIds.includes(cId);

    return isAssigned || isOwner || isTeam;
  };

  // 2. Extract active user items & calculate Pie Data (شروع‌نشده و درحال‌اجرا)
  const { activeUserTasksCount, delayedTasksCount, delayedItems, onTimeItems } = useMemo(() => {
    let activeCount = 0;
    let delayedCount = 0;
    const delayedList: ChartModalItem[] = [];
    const onTimeList: ChartModalItem[] = [];

    tasks.forEach((t) => {
      if (!isTaskForCurrentUser(t)) return;

      // Group Activity check: If task has subtasks, evaluate subtasks
      if (t.projectSubTasks && t.projectSubTasks.length > 0) {
        t.projectSubTasks.forEach((st) => {
          const stStatus = st.completed ? 'completed' : t.status;
          if (stStatus === 'todo' || stStatus === 'in_progress') {
            activeCount++;
            const stDueDate = st.endDate || st.startDate || t.dueDate;
            const item: ChartModalItem = {
              id: `${t.id}_${st.id}`,
              title: t.isRecurring ? `${t.title} (${st.title})` : `${t.title} > ${st.title}`,
              dueDate: stDueDate,
              priority: (st.importance as Priority) || t.priority,
              parentTask: t,
              isSubTask: true,
              subTaskId: st.id,
              statusTitle: stStatus === 'todo' ? 'شروع‌نشده' : 'درحال‌اجرا',
            };

            if (isOverdue(stDueDate, stStatus)) {
              delayedCount++;
              delayedList.push(item);
            } else {
              onTimeList.push(item);
            }
          }
        });
      } else {
        if (t.status === 'todo' || t.status === 'in_progress') {
          activeCount++;
          const item: ChartModalItem = {
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            parentTask: t,
            isSubTask: false,
            statusTitle: t.status === 'todo' ? 'شروع‌نشده' : 'درحال‌اجرا',
          };

          if (isOverdue(t.dueDate, t.status)) {
            delayedCount++;
            delayedList.push(item);
          } else {
            onTimeList.push(item);
          }
        }
      }
    });

    return {
      activeUserTasksCount: activeCount,
      delayedTasksCount: delayedCount,
      delayedItems: delayedList,
      onTimeItems: onTimeList,
    };
  }, [tasks, currentUser]);

  const onTimeTasksCount = activeUserTasksCount - delayedTasksCount;

  const delayStatusData = [
    {
      id: 'delayed',
      name: 'دارای تاخیر',
      value: delayedTasksCount,
      percentage: activeUserTasksCount > 0 ? Math.round((delayedTasksCount / activeUserTasksCount) * 100) : 0,
      color: '#ef4444', // Red / Rose
      items: delayedItems,
    },
    {
      id: 'on_time',
      name: 'فاقد تاخیر',
      value: onTimeTasksCount,
      percentage: activeUserTasksCount > 0 ? Math.round((onTimeTasksCount / activeUserTasksCount) * 100) : 0,
      color: '#10b981', // Green / Emerald
      items: onTimeItems,
    },
  ];

  // 3. Bar Data based on Assignee (تعداد فعالیت‌ها بر اساس مسئول انجام)
  const assigneeBarData = useMemo(() => {
    const ASSIGNEE_PALETTE = [
      '#6366f1', // Indigo
      '#0ea5e9', // Sky
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316', // Orange
      '#3b82f6', // Blue
      '#06b6d4', // Cyan
    ];

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        fullTitle: string;
        count: number;
        items: ChartModalItem[];
      }
    >();

    tasks.forEach((t) => {
      if (assigneeScope === 'active' && (t.status === 'completed' || t.status === 'paused')) {
        return;
      }

      // Check if task is explicitly assigned to current user
      const isAssignedToCurrentUser = !!(
        currentUser &&
        ((t.assignedUserId && t.assignedUserId === currentUser.id) ||
          (t.assignedUserName &&
            (t.assignedUserName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
              t.assignedUserName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase())))
      );

      // Determine assignee label: unassigned or current user is labeled as "خودم"
      let name = 'خودم';
      let id = 'myself';

      if (isAssignedToCurrentUser) {
        name = 'خودم';
        id = 'myself';
      } else if (t.assignedUserName && t.assignedUserName.trim()) {
        name = t.assignedUserName.trim();
        id = t.assignedUserId || name;
      } else if (t.assignedTeamName && t.assignedTeamName.trim()) {
        name = `تیم ${t.assignedTeamName.trim()}`;
        id = t.assignedTeamId || name;
      } else {
        name = 'خودم';
        id = 'myself';
      }

      if (!map.has(id)) {
        map.set(id, {
          id,
          name,
          fullTitle: id === 'myself' ? 'فعالیت‌های من (خودم)' : `فعالیت‌های واگذار شده به ${name}`,
          count: 0,
          items: [],
        });
      }

      const entry = map.get(id)!;
      entry.count += 1;
      entry.items.push({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority || 'medium',
        parentTask: t,
        isSubTask: false,
        statusTitle: STATUSES[t.status]?.title || t.status,
      });
    });

    const list = Array.from(map.values()).sort((a, b) => {
      // Put 'myself' / 'خودم' first
      if (a.id === 'myself') return -1;
      if (b.id === 'myself') return 1;
      // Then sort by count descending
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'fa');
    });

    return list.map((item, idx) => ({
      ...item,
      color: item.id === 'myself' ? '#6366f1' : ASSIGNEE_PALETTE[idx % ASSIGNEE_PALETTE.length],
    }));
  }, [tasks, assigneeScope, currentUser]);

  // Click Handlers for Charts
  const handlePieClick = (entry: any) => {
    if (!entry || !entry.items || entry.items.length === 0) return;
    setActiveModalData({
      title: `فعالیت‌های جاری کاربر (${entry.name})`,
      items: entry.items,
    });
  };

  const handleBarClick = (entry: any) => {
    if (!entry || !entry.items || entry.items.length === 0) return;
    setActiveModalData({
      title: entry.fullTitle || `فعالیت‌های مسئول ${entry.name}`,
      items: entry.items,
    });
  };

  // Sort modal items by createdAt descending
  const sortedModalItems = useMemo(() => {
    if (!activeModalData) return [];
    return [...activeModalData.items].sort((a, b) => {
      const timeA = new Date(a.parentTask.createdAt || a.parentTask.updatedAt || a.parentTask.dueDate || 0).getTime();
      const timeB = new Date(b.parentTask.createdAt || b.parentTask.updatedAt || b.parentTask.dueDate || 0).getTime();
      return timeB - timeA;
    });
  }, [activeModalData]);

  // Custom Tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.color }} />
            {data.name}
          </p>
          <p className="text-slate-300">
            تعداد: <span className="font-bold text-white">{toPersianDigits(data.value)}</span> فعالیت
          </p>
          <p className="text-slate-300">
            درصد: <span className="font-bold text-indigo-300">٪{toPersianDigits(data.percentage)}</span>
          </p>
          <p className="text-[10px] text-amber-300 pt-0.5 border-t border-slate-800">
            💡 جهت مشاهده موارد کلیک کنید
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Bar Chart (تعداد بر اساس مسئول انجام)
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1 max-w-xs">
          <p className="font-bold flex items-center gap-1.5 line-clamp-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color }} />
            <span>{data.id === 'myself' ? 'خودم' : (data.fullTitle || data.name)}</span>
          </p>
          <p className="text-slate-300">
            تعداد فعالیت‌ها: <span className="font-bold text-emerald-300">{toPersianDigits(data.count)}</span>
          </p>
          <p className="text-[10px] text-amber-300 pt-0.5 border-t border-slate-800">
            💡 جهت مشاهده لیست فعالیت‌ها کلیک کنید
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Bar Label: Name of the person INSIDE the bar if it fits, else VERTICAL ABOVE the bar
  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, value, index } = props;
    const item = assigneeBarData[index];
    if (!item) return null;

    const rawName = item.id === 'myself' ? 'خودم' : item.name;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Minimum height needed for the vertical name to comfortably fit inside the bar with padding
    const namePixelHeight = rawName.length * 7.2 + 14;
    const fitsInside = height >= namePixelHeight && height >= 44;

    const maxCharsInside = Math.max(3, Math.floor((height - 12) / 7));
    const displayNameInside =
      rawName.length > maxCharsInside ? `${rawName.slice(0, Math.max(2, maxCharsInside - 1))}…` : rawName;

    // When above the bar: name is also vertical, with count number above it
    const displayNameAbove =
      rawName.length > 14 ? `${rawName.slice(0, 12)}…` : rawName;
    const textPixelLenAbove = Math.max(18, displayNameAbove.length * 6.8);
    const targetYAbove = y - 6 - textPixelLenAbove / 2;
    const countYAbove = y - 6 - textPixelLenAbove - 6;

    return (
      <g onClick={() => handleBarClick(item)} className="cursor-pointer">
        {fitsInside ? (
          <>
            {/* Count number right above the bar */}
            <text
              x={cx}
              y={y - 6}
              textAnchor="middle"
              className="text-[11px] font-black fill-slate-700 dark:fill-slate-200 select-none"
            >
              {toPersianDigits(value)}
            </text>

            {/* Person's name INSIDE the bar (vertical, white font) */}
            <g transform={`translate(${cx}, ${cy})`}>
              <text
                transform="rotate(-90)"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                dir="rtl"
                className="text-[11px] font-bold select-none"
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))',
                  fontFamily: "'Vazirmatn', system-ui, -apple-system, sans-serif",
                }}
              >
                <title>{rawName}</title>
                {displayNameInside}
              </text>
            </g>
          </>
        ) : (
          <>
            {/* Count number placed above the vertical name */}
            <text
              x={cx}
              y={countYAbove}
              textAnchor="middle"
              className="text-[11px] font-black fill-slate-700 dark:fill-slate-200 select-none"
            >
              {toPersianDigits(value)}
            </text>

            {/* Person's name ABOVE the bar (vertical, dark/high-contrast font) */}
            <g transform={`translate(${cx}, ${targetYAbove})`}>
              <text
                transform="rotate(-90)"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1e293b"
                dir="rtl"
                className="text-[11px] font-extrabold fill-slate-800 dark:fill-slate-100 select-none"
                style={{
                  fontFamily: "'Vazirmatn', system-ui, -apple-system, sans-serif",
                }}
              >
                <title>{rawName}</title>
                {displayNameAbove}
              </text>
            </g>
          </>
        )}
      </g>
    );
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <span>آمار و تحلیل وضعیت فعالیت‌ها</span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
            مجموع {toPersianDigits(totalTasks)} فعالیت
          </span>
        </h3>
      </div>

      {/* 2 Charts Side-by-Side Grid: Desktop gives less width to delay pie and more width to assignee bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Chart 1: Pie Chart (وضعیت تاخیر فعالیت‌های کاربر - شروع نشده و در حال اجرا) */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between md:col-span-5 lg:col-span-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  وضعیت تاخیر فعالیت‌های جاری کاربر
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  شروع‌نشده و درحال‌اجرا ({toPersianDigits(activeUserTasksCount)} مورد - قابل کلیک)
                </p>
              </div>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full relative my-auto">
            {activeUserTasksCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={delayStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {delayStatusData.map((entry) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.color}
                        stroke="none"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handlePieClick(entry)}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium ml-2 cursor-pointer">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium text-center px-4">
                هیچ فعالیت جاری (شروع‌نشده یا در حال اجرا) برای کاربر یافت نشد
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Bar Chart (تعداد بر اساس مسئول انجام) - Takes wider space on desktop */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between md:col-span-7 lg:col-span-8">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تعداد فعالیت‌ها بر اساس مسئول انجام
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  تفکیک فعالیت‌ها به ازای هر مسئول (قابل کلیک جهت مشاهده موارد)
                </p>
              </div>
            </div>

            {/* Scope Toggle: Active (default) vs All */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px] font-bold border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAssigneeScope('active')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  assigneeScope === 'active'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                جاری ({toPersianDigits(activeTasksCount)})
              </button>
              <button
                type="button"
                onClick={() => setAssigneeScope('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  assigneeScope === 'all'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                همه ({toPersianDigits(tasks.length)})
              </button>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full relative my-auto">
            {assigneeBarData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assigneeBarData} margin={{ top: 36, right: 15, left: -20, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={12}
                    axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                    tickLine={false}
                    tick={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(dataMax + 1.2, 3.5)]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                    tickLine={false}
                    tickFormatter={(val) => toPersianDigits(val)}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={46}
                    minPointSize={22}
                    label={renderCustomBarLabel}
                    isAnimationActive={false}
                  >
                    {assigneeBarData.map((entry) => (
                      <Cell
                        key={`bar-${entry.id}`}
                        fill={entry.color}
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={() => handleBarClick(entry)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                هیچ فعالیتی جهت نمایش یافت نشد
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Pop-up Modal for Chart Click Details */}
      {activeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/80 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeModalData.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    نمایش لیست موارد مربوط به بخش انتخاب‌شده در نمودار
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-900">
                  {toPersianDigits(sortedModalItems.length)} مورد
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModalData(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Items List */}
            <div className="p-5 overflow-y-auto space-y-3">
              {sortedModalItems.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {sortedModalItems.map((item, idx) => {
                    const parent = item.parentTask;
                    const priorityCfg = PRIORITIES[item.priority] || PRIORITIES.medium;
                    const commentCount = parent.comments?.length || 0;
                    const { canEditTask, canDeleteTask } = checkTaskPermissions(parent);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (onViewDetails) {
                            onViewDetails(parent);
                          } else if (onEditTask) {
                            onEditTask(parent);
                          }
                          setActiveModalData(null);
                        }}
                        className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        {/* Index */}
                        <div className="col-span-1 text-center font-bold text-xs text-slate-400 dark:text-slate-500">
                          {toPersianDigits(idx + 1)}
                        </div>

                        {/* Title & Tag Details */}
                        <div className="col-span-8 flex flex-col gap-1 pr-1">
                          <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {item.title}
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            {item.statusTitle && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                وضعیت: {item.statusTitle}
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                              <UserIcon className="w-3 h-3 text-indigo-500" />
                              <span>مسئول: {parent.assignedUserName ? parent.assignedUserName : 'خودم'}</span>
                            </span>

                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                              style={{
                                color: priorityCfg.color,
                                backgroundColor: priorityCfg.bg,
                                borderColor: priorityCfg.border,
                              }}
                            >
                              اهمیت: {priorityCfg.title}
                            </span>

                            {item.dueDate && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                <Calendar className="w-3 h-3" />
                                <span>{getDaysDiff(item.dueDate).text || formatToJalali(item.dueDate)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3 Action Icons based on Permissions */}
                        <div className="col-span-3 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* 1. View Details / Comments */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewDetails) onViewDetails(parent);
                              else if (onEditTask) onEditTask(parent);
                              setActiveModalData(null);
                            }}
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                            title="مشاهده جزئیات و مکاتبات"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {commentCount > 0 && <span>({toPersianDigits(commentCount)})</span>}
                          </button>

                          {/* 2. Edit (strictly if allowed) */}
                          {canEditTask && onEditTask && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditTask(parent);
                                setActiveModalData(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
                              title="ویرایش فعالیت"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* 3. Delete (strictly if allowed) */}
                          {canDeleteTask && onDeleteTask && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingTaskId(parent.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
                              title="حذف فعالیت"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                  هیچ موردی در این بخش وجود ندارد
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModalData(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/80 rounded-2xl border border-rose-100 dark:border-rose-900">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">تایید حذف فعالیت</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">این عملیات غیرقابل بازگشت است.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از حذف این فعالیت و تمام اطلاعات مربوط به آن اطمینان کامل دارید؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTask) onDeleteTask(deletingTaskId);
                  setDeletingTaskId(null);
                  setActiveModalData(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                حذف نهایی
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
