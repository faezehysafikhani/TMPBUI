import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  User as UserIcon,
  Search,
  Paperclip,
  CheckCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  Users,
  X,
  FileText,
  UserX,
  Globe,
  CheckSquare,
  Pencil,
  Trash2,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { User, WorkTeam, DirectMessage, AppColorPalette, Task, TaskStatus, STATUSES, PRIORITIES } from '../types';
import { toPersianDigits, formatTime24h, formatToJalali } from '../utils/helpers';
import { COLOR_PALETTES } from '../utils/theme';
import {
  fetchDirectMessagesPB,
  sendDirectMessagePB,
  markDirectMessagesAsReadPB,
  fetchUnreadMessageCountsPB,
  fetchAllUsersPB,
  updateDirectMessagePB,
  deleteDirectMessagePB,
} from '../services/dataService';

interface TeamChatViewProps {
  currentUser: User | null;
  teams: WorkTeam[];
  appColorPalette?: AppColorPalette;
  onConvertToTask?: (title: string, description?: string) => void;
  tasks?: Task[];
  onViewTaskDetails?: (task: Task) => void;
}

export interface ChatContact {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
  role?: string;
  isExternal: boolean;
}

export const TeamChatView: React.FC<TeamChatViewProps> = ({
  currentUser,
  teams,
  appColorPalette = 'indigo',
  onConvertToTask,
  tasks = [],
  onViewTaskDetails,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  // Selected Team or 'external_all'
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    teams.length > 0 ? teams[0].id : 'external_all'
  );

  // All system users fetched from database
  const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);

  // Selected Chat Partner ID
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  // Messages in active conversation
  const [messages, setMessages] = useState<DirectMessage[]>([]);

  // Input message text
  const [inputMessage, setInputMessage] = useState<string>('');

  // Task & Activity Description Drawer states
  const [showTaskDrawer, setShowTaskDrawer] = useState<boolean>(false);
  const [taskFilterScope, setTaskFilterScope] = useState<'partner' | 'team' | 'all'>('partner');
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Unread badge counts per member: { memberUserId: count }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Search filter for member list
  const [memberSearch, setMemberSearch] = useState<string>('');

  // Attached file payload
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string } | null>(null);

  // Loading state
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Message Editing State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const handleStartEdit = (msg: DirectMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text || '');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== currentUser?.id) return;
    if (!editingText.trim()) return;
    const newText = editingText.trim();
    await updateDirectMessagePB(messageId, newText);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, text: newText } : m))
    );
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleDeleteMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== currentUser?.id) return;
    if (!window.confirm('آیا از حذف این پیام اطمینان دارید؟')) return;
    await deleteDirectMessagePB(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all system users with cache-first approach
  useEffect(() => {
    let isMounted = true;

    // Load from local cache instantly to speed up initial rendering
    try {
      const raw = localStorage.getItem('parstask_managed_users_v2');
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllSystemUsers(cached);
        }
      }
    } catch (e) {
      console.warn('Failed to parse local users cache in chat view:', e);
    }

    fetchAllUsersPB().then((users) => {
      if (isMounted) {
        setAllSystemUsers(users);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Find active team
  const activeTeam = teams.find((t) => t.id === selectedTeamId) || (teams.length > 0 ? teams[0] : null);

  // Team member user IDs
  const teamUserIds = useMemo(() => {
    if (!activeTeam) return new Set<string>();
    return new Set(activeTeam.members.map((m) => m.userId));
  }, [activeTeam]);

  // Team Contacts
  const teamContacts: ChatContact[] = useMemo(() => {
    if (!activeTeam) return [];
    return activeTeam.members
      .filter((m) => m.userId !== currentUser?.id)
      .map((m) => ({
        userId: m.userId,
        name: m.name,
        username: m.username,
        avatar: m.avatar,
        role: m.role || 'عضو تیم',
        isExternal: false,
      }));
  }, [activeTeam, currentUser]);

  // External Contacts (Users outside current team)
  const externalContacts: ChatContact[] = useMemo(() => {
    const extMap = new Map<string, ChatContact>();

    allSystemUsers.forEach((u) => {
      if (u.id !== currentUser?.id && !teamUserIds.has(u.id)) {
        extMap.set(u.id, {
          userId: u.id,
          name: u.name || u.username,
          username: u.username,
          avatar: u.avatar,
          role: u.role || 'فرد خارج از تیم',
          isExternal: true,
        });
      }
    });

    // Also include senders of unread messages even if not in allSystemUsers
    Object.keys(unreadCounts).forEach((senderId) => {
      if (
        senderId !== currentUser?.id &&
        !teamUserIds.has(senderId) &&
        !extMap.has(senderId)
      ) {
        extMap.set(senderId, {
          userId: senderId,
          name: 'کاربر خارج از تیم',
          username: 'user_' + senderId.slice(-4),
          role: 'فرد خارج از تیم',
          isExternal: true,
        });
      }
    });

    return Array.from(extMap.values());
  }, [allSystemUsers, currentUser, teamUserIds, unreadCounts]);

  // Filtered members by search
  const filteredTeamMembers = useMemo(() => {
    return teamContacts.filter(
      (m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.username.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [teamContacts, memberSearch]);

  const filteredExternalMembers = useMemo(() => {
    return externalContacts.filter(
      (m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.username.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [externalContacts, memberSearch]);

  // External members with unread messages or recent chat
  const externalMembersWithUnread = useMemo(() => {
    return filteredExternalMembers.filter(
      (m) => (unreadCounts[m.userId] || 0) > 0 || m.userId === activePartnerId
    );
  }, [filteredExternalMembers, unreadCounts, activePartnerId]);

  // Active partner contact details
  const activePartner: ChatContact | null = useMemo(() => {
    if (!activePartnerId) return null;
    const inTeam = teamContacts.find((c) => c.userId === activePartnerId);
    if (inTeam) return inTeam;
    const inExt = externalContacts.find((c) => c.userId === activePartnerId);
    if (inExt) return inExt;
    return {
      userId: activePartnerId,
      name: 'کاربر خارج از تیم',
      username: 'user_' + activePartnerId.slice(-4),
      role: 'فرد خارج از تیم',
      isExternal: true,
    };
  }, [activePartnerId, teamContacts, externalContacts]);

  // Calculate relevant tasks for active partner and current team
  const relevantTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    return tasks.filter((t) => {
      // Status filter
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) {
        return false;
      }

      // Search filter on title and description
      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.trim().toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Scope filter
      if (taskFilterScope === 'partner' && activePartnerId) {
        return (
          t.assignedUserId === activePartnerId ||
          t.user === activePartnerId ||
          (t.teamMemberIds && t.teamMemberIds.includes(activePartnerId))
        );
      }

      if (taskFilterScope === 'team' && selectedTeamId !== 'external_all') {
        const teamObj = teams.find((tm) => tm.id === selectedTeamId);
        const isAssignedToTeam = t.assignedTeamId === selectedTeamId;
        const isAssignedToMember = teamObj?.members.some((m) => m.userId === t.assignedUserId);
        return isAssignedToTeam || isAssignedToMember;
      }

      // Default or 'all'
      return true;
    });
  }, [tasks, activePartnerId, selectedTeamId, taskFilterScope, taskSearchQuery, taskStatusFilter, teams]);

  // Total count of tasks related to active partner
  const partnerTasksCount = useMemo(() => {
    if (!tasks || !activePartnerId) return 0;
    return tasks.filter(
      (t) =>
        t.assignedUserId === activePartnerId ||
        t.user === activePartnerId ||
        (t.teamMemberIds && t.teamMemberIds.includes(activePartnerId))
    ).length;
  }, [tasks, activePartnerId]);

  // Insert task title and description directly into the chat input
  const handleInsertTaskIntoChat = (task: Task) => {
    const descText = task.description && task.description.trim() ? task.description.trim() : 'بدون توضیحات';
    const quote = `📌 [فعالیت: ${task.title}]\n📝 توضیحات: ${descText}\n`;
    setInputMessage((prev) => (prev.trim() ? `${prev}\n\n${quote}` : quote));
  };

  // Copy task description to clipboard
  const handleCopyTaskDescription = (task: Task) => {
    const textToCopy = task.description && task.description.trim()
      ? `فعالیت: ${task.title}\nتوضیحات:\n${task.description}`
      : `فعالیت: ${task.title}\n(بدون توضیحات ثبت‌شده)`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTaskId(task.id);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Initial & Recurring Load for Unread Counts (Cache-First)
  useEffect(() => {
    if (!currentUser) return;

    const cacheKey = `parstask_unread_counts_${currentUser.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setUnreadCounts(JSON.parse(cached));
      }
    } catch (err) {}

    const loadUnread = async () => {
      const counts = await fetchUnreadMessageCountsPB(currentUser.id);
      setUnreadCounts(counts);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(counts));
      } catch (err) {}
    };

    loadUnread();
    const interval = setInterval(loadUnread, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // 2. Load Messages when Active Partner Changes (Cache-First)
  useEffect(() => {
    if (!currentUser || !activePartnerId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const cacheKey = `parstask_chat_${currentUser.id}_${activePartnerId}`;
    let hasCache = false;

    // Load from local storage cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setMessages(JSON.parse(cached));
        hasCache = true;
        setTimeout(scrollToBottom, 50);
      }
    } catch (err) {
      console.warn('Failed to parse cached chat messages', err);
    }

    const loadChat = async () => {
      if (isMounted && !hasCache) setIsLoadingMessages(true);
      const data = await fetchDirectMessagesPB(currentUser.id, activePartnerId);
      if (isMounted) {
        setMessages(data);
        setIsLoadingMessages(false);
        setTimeout(scrollToBottom, 100);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (err) {}
      }

      // Mark messages as read
      await markDirectMessagesAsReadPB(activePartnerId, currentUser.id);
      setUnreadCounts((prev) => ({ ...prev, [activePartnerId]: 0 }));
    };

    loadChat();

    // Polling interval for live chat updates
    const chatInterval = setInterval(async () => {
      const data = await fetchDirectMessagesPB(currentUser.id, activePartnerId);
      if (isMounted) {
        setMessages((prev) => {
          if (prev.length !== data.length || (data.length > 0 && data[data.length - 1].id !== prev[prev.length - 1]?.id)) {
            setTimeout(scrollToBottom, 100);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data));
            } catch (err) {}
            return data;
          }
          return prev;
        });
      }
      await markDirectMessagesAsReadPB(activePartnerId, currentUser.id);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(chatInterval);
    };
  }, [currentUser, activePartnerId]);

  // Handle File Upload Attachment
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('حداکثر حجم فایل پیوست ۵ مگابایت می‌باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        url: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachedFile) || !currentUser || !activePartnerId) return;

    const textToSend = inputMessage.trim();
    const fileToSend = attachedFile;

    setInputMessage('');
    setAttachedFile(null);

    const sent = await sendDirectMessagePB({
      senderId: currentUser.id,
      senderName: currentUser.name || currentUser.username,
      senderAvatar: currentUser.avatar,
      receiverId: activePartnerId,
      text: textToSend,
      attachmentUrl: fileToSend?.url,
      attachmentName: fileToSend?.name,
    });

    setMessages((prev) => [...prev, sent]);
    setTimeout(scrollToBottom, 100);
  };

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-sm my-auto">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">جهت استفاده از گفتگوهای تیمی وارد حساب کاربری خود شوید</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">با ورود به سیستم می‌توانید با سایر اعضای تیم خود به صورت مستقیم گفتگو کنید.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden flex flex-col md:flex-row h-[75vh] min-h-[500px] relative">
      
      {/* RIGHT SIDEBAR (RTL): Team Selector & Contacts List */}
      <div
        className={`w-full md:w-80 lg:w-88 border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-700/80 flex flex-col bg-slate-50/60 dark:bg-slate-900/60 ${
          activePartnerId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Team Selector & Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 space-y-3 bg-white dark:bg-slate-800/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">گفتگوی مستقیم</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTaskDrawer(!showTaskDrawer)}
                className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  showTaskDrawer
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                }`}
                title="مشاهده توضیحات و مشخصات فعالیت‌ها"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold hidden sm:inline">فعالیت‌ها</span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                {selectedTeamId === 'external_all'
                  ? `${toPersianDigits(externalContacts.length)} کاربر`
                  : `${toPersianDigits(filteredTeamMembers.length)} هم‌تیمی`}
              </span>
            </div>
          </div>

          {/* Team Switcher Dropdown with External Users Option */}
          <div className="relative">
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setActivePartnerId(null);
              }}
              className="w-full bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  تیم: {t.name}
                </option>
              ))}
              <option value="external_all">🌐 افراد خارج از تیم / پیام‌های عمومی</option>
            </select>
          </div>

          {/* Member Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="جستجوی هم‌تیمی یا کاربر..."
              className="w-full pr-9 pl-3 py-1.5 bg-slate-100 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700/80 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Member Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {selectedTeamId === 'external_all' ? (
            /* Display all external contacts */
            filteredExternalMembers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <Globe className="w-8 h-8 mx-auto opacity-50 text-indigo-500" />
                <p className="text-xs">هیچ کاربری خارج از تیم یافت نشد.</p>
              </div>
            ) : (
              filteredExternalMembers.map((contact) => (
                <ContactRowItem
                  key={contact.userId}
                  contact={contact}
                  isSelected={contact.userId === activePartnerId}
                  unreadCount={unreadCounts[contact.userId] || 0}
                  onClick={() => setActivePartnerId(contact.userId)}
                />
              ))
            )
          ) : (
            /* Selected Team Mode */
            <>
              {/* Team Members List */}
              {filteredTeamMembers.length > 0 && (
                <div>
                  <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-slate-900/40 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>اعضای تیم ({toPersianDigits(filteredTeamMembers.length)})</span>
                  </div>
                  {filteredTeamMembers.map((contact) => (
                    <ContactRowItem
                      key={contact.userId}
                      contact={contact}
                      isSelected={contact.userId === activePartnerId}
                      unreadCount={unreadCounts[contact.userId] || 0}
                      onClick={() => setActivePartnerId(contact.userId)}
                    />
                  ))}
                </div>
              )}

              {/* Messages received from users OUTSIDE the team */}
              {externalMembersWithUnread.length > 0 && (
                <div>
                  <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border-y border-amber-200/60 dark:border-amber-900/50 text-[10px] font-extrabold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserX className="w-3 h-3 text-amber-600" />
                      <span>پیام‌های افراد خارج از تیم ({toPersianDigits(externalMembersWithUnread.length)})</span>
                    </span>
                  </div>
                  {externalMembersWithUnread.map((contact) => (
                    <ContactRowItem
                      key={contact.userId}
                      contact={contact}
                      isSelected={contact.userId === activePartnerId}
                      unreadCount={unreadCounts[contact.userId] || 0}
                      onClick={() => setActivePartnerId(contact.userId)}
                    />
                  ))}
                </div>
              )}

              {filteredTeamMembers.length === 0 && externalMembersWithUnread.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-xs">هیچ عضوی در این تیم یا با این عنوان یافت نشد.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* LEFT CHAT AREA: Conversation View */}
      <div
        className={`flex-1 flex flex-col bg-white dark:bg-slate-800/90 ${
          !activePartnerId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activePartner ? (
          <>
            {/* Active Partner Top Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setActivePartnerId(null)}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  title="بازگشت به لیست مخاطبین"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {activePartner.avatar ? (
                  <img
                    src={activePartner.avatar}
                    alt={activePartner.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
                    {activePartner.name.charAt(0)}
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                      {activePartner.name}
                    </h3>
                    {activePartner.isExternal ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 rounded-full shrink-0">
                        فرد خارج از تیم
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 rounded-full shrink-0">
                        عضو تیم
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    آنلاین در سیستم
                  </span>
                </div>
              </div>

              {/* Activity & Description Toggle Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskDrawer(!showTaskDrawer)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    showTaskDrawer
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                  title="مشاهده توضیحات و مشخصات فعالیت‌ها"
                >
                  <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="hidden sm:inline">توضیحات فعالیت‌ها</span>
                  <span className="sm:hidden">فعالیت‌ها</span>
                  {partnerTasksCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        showTaskDrawer
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {toPersianDigits(partnerTasksCount)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Message History List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/30">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  در حال دریافت پیام‌ها...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2 my-auto">
                  <MessageSquare className="w-10 h-10 opacity-40" />
                  <p className="text-xs font-semibold">
                    هنوز پیامی بین شما و {activePartner.name} رد و بدل نشده است.
                  </p>
                  <p className="text-[11px] text-slate-400">نخستین پیام خود را ارسال نمایید!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id;
                  const timeStr = formatTime24h(msg.createdAt);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs space-y-2 ${
                          isMine
                            ? `${palette.accentBg} text-white rounded-br-xs`
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-xs'
                        }`}
                      >
                        {/* Sender Label if message received from external user */}
                        {!isMine && activePartner.isExternal && (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 pb-1 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                            <span>{msg.senderName || activePartner.name}</span>
                            <span className="text-[9px] font-semibold text-slate-400">خارج از تیم</span>
                          </div>
                        )}

                        {/* Message Content or Inline Edit Form */}
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2 py-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className={`w-full p-2 text-xs sm:text-sm rounded-xl border focus:outline-none resize-none ${
                                isMine
                                  ? 'bg-white/20 text-white border-white/40 placeholder:text-white/60 focus:ring-1 focus:ring-white'
                                  : 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500'
                              }`}
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(msg.id)}
                                className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                                title="ذخیره تغییرات"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isMine
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                                title="انصراف"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}

                        {/* File Attachment */}
                        {msg.attachmentUrl && (
                          <div
                            className={`p-2 rounded-xl flex items-center gap-2 border ${
                              isMine
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-xs truncate max-w-[180px] hover:opacity-80"
                            >
                              {msg.attachmentName || 'فایل پیوست'}
                            </a>
                          </div>
                        )}

                        {/* Footer Time, Status & Action Icons */}
                        <div
                          className={`flex items-center justify-between gap-2 text-[10px] mt-1 pt-1 border-t ${
                            isMine
                              ? 'border-white/10 text-white/80'
                              : 'border-slate-100 dark:border-slate-700/60 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {/* Convert to Task Icon */}
                            {onConvertToTask && (
                              <button
                                type="button"
                                onClick={() => {
                                  const title = msg.text
                                    ? msg.text.length > 50
                                      ? msg.text.substring(0, 50) + '...'
                                      : msg.text
                                    : 'وظیفه جدید از پیام چت';
                                  const desc = `برگرفته از پیام گفتگو با ${activePartner ? activePartner.name : 'کاربر'}:\n${msg.text || ''}`;
                                  onConvertToTask(title, desc);
                                }}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  isMine
                                    ? 'hover:bg-white/20 text-white/90 hover:text-white'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'
                                }`}
                                title="تبدیل این پیام به یک وظیفه جدید"
                              >
                                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}

                            {/* Edit Message Icon - Only for owner */}
                            {isMine && editingMessageId !== msg.id && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(msg)}
                                className="p-1 rounded-md transition-colors cursor-pointer hover:bg-white/20 text-white/90 hover:text-white"
                                title="ویرایش پیام"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}

                            {/* Delete Message Icon - Only for owner */}
                            {isMine && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 rounded-md transition-colors cursor-pointer hover:bg-white/20 text-white/90 hover:text-rose-200"
                                title="حذف پیام"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mr-auto">
                            <span>{timeStr}</span>
                            {isMine && <CheckCircle className="w-3 h-3 stroke-[2.5]" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview Bar */}
            {attachedFile && (
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/80 border-t border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">پیوست: {attachedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Form Footer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 flex items-center gap-2"
            >
              <label
                title="افزودن فایل پیوست"
                className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl cursor-pointer transition-colors shrink-0"
              >
                <Paperclip className="w-5 h-5" />
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>

              <button
                type="button"
                onClick={() => setShowTaskDrawer(!showTaskDrawer)}
                title="مشاهده و درج توضیحات فعالیت در گفتگو"
                className={`p-2.5 rounded-xl cursor-pointer transition-colors shrink-0 ${
                  showTaskDrawer
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70'
                    : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <FileText className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`پیام به ${activePartner.name}...`}
                className="flex-1 bg-slate-100 dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() && !attachedFile}
                className={`p-2.5 ${palette.accentBg} ${palette.accentHover} disabled:opacity-40 text-white rounded-2xl shadow-sm transition-all cursor-pointer shrink-0`}
                title="ارسال پیام"
              >
                <Send className="w-5 h-5 rotate-180" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 space-y-3 my-auto">
            <MessageSquare className="w-14 h-14 text-indigo-400/40" />
            <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">
              مخاطبی انتخاب نشده است
            </h3>
            <p className="text-xs max-w-xs leading-relaxed">
              از لیست سمت راست، هم‌تیمی خود یا فرد خارج از تیم را انتخاب نمایید تا گفتگو آغاز شود.
            </p>
          </div>
        )}
      </div>

      {/* ACTIVITY DESCRIPTIONS DRAWER / SIDE-PANEL (مشاهده توضیحات فعالیت) */}
      {showTaskDrawer && (
        <div className="w-full md:w-96 lg:w-[420px] border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 flex flex-col h-full shadow-xl md:shadow-none z-30 absolute md:static inset-0 transition-all">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  توضیحات و جزئیات فعالیت‌ها
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {toPersianDigits(relevantTasks.length)} فعالیت یافت شد
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTaskDrawer(false)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="بستن پنل توضیحات"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Filters */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700/80 space-y-2.5 bg-white dark:bg-slate-800/60">
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold">
              {activePartner && (
                <button
                  type="button"
                  onClick={() => setTaskFilterScope('partner')}
                  className={`py-1.5 px-2 rounded-lg text-center truncate transition-colors cursor-pointer ${
                    taskFilterScope === 'partner'
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title={activePartner.name}
                >
                  هم‌تیمی
                </button>
              )}
              <button
                type="button"
                onClick={() => setTaskFilterScope('team')}
                className={`py-1.5 px-2 rounded-lg text-center truncate transition-colors cursor-pointer ${
                  taskFilterScope === 'team'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                تیم جاری
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterScope('all')}
                className={`py-1.5 px-2 rounded-lg text-center truncate transition-colors cursor-pointer ${
                  taskFilterScope === 'all'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                همه فعالیت‌ها
              </button>
            </div>

            {/* Search within Tasks and Descriptions */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="جستجو در عنوان یا متن توضیحات..."
                className="w-full pr-8 pl-3 py-1.5 bg-slate-100 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
              />
              {taskSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTaskSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              <button
                type="button"
                onClick={() => setTaskStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer ${
                  taskStatusFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                همه ({toPersianDigits(tasks.length)})
              </button>
              {(Object.keys(STATUSES) as TaskStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTaskStatusFilter(st)}
                  className={`px-2 py-0.5 rounded-lg font-medium shrink-0 transition-colors cursor-pointer text-[10px] ${
                    taskStatusFilter === st
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {STATUSES[st].title}
                </button>
              ))}
            </div>
          </div>

          {/* Task List with Full Descriptions */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
            {relevantTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2 my-auto">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  فعالیتی یافت نشد
                </p>
                <p className="text-[11px] max-w-xs mx-auto">
                  با تغییر فیلتر جستجو یا انتخاب دامنه دیگر می‌توانید فعالیت‌ها را مشاهده کنید.
                </p>
              </div>
            ) : (
              relevantTasks.map((t) => {
                const statusInfo = STATUSES[t.status];
                const priorityInfo = PRIORITIES[t.priority];
                const hasDesc = t.description && t.description.trim().length > 0;

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    {/* Header: Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {t.title}
                      </h4>
                      {statusInfo && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border shrink-0 ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.borderColor}`}
                        >
                          {statusInfo.title}
                        </span>
                      )}
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>موعد: {formatToJalali(t.dueDate)}</span>
                        </span>
                      )}
                      {t.assignedUserName && (
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <UserIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{t.assignedUserName}</span>
                        </span>
                      )}
                      {priorityInfo && (
                        <span className={`text-[10px] font-bold ${priorityInfo.color}`}>
                          • اولویت {priorityInfo.title}
                        </span>
                      )}
                    </div>

                    {/* Activity Description Box (توضیحات فعالیت) */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>توضیحات فعالیت:</span>
                      </div>
                      {hasDesc ? (
                        <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 max-h-48 overflow-y-auto select-text font-normal">
                          {t.description}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/60 dark:bg-slate-900/40 p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                          توضیحاتی برای این فعالیت ثبت نشده است.
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-1.5">
                        {/* Insert into chat input */}
                        {activePartner && (
                          <button
                            type="button"
                            onClick={() => handleInsertTaskIntoChat(t)}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="درج عنوان و توضیحات فعالیت در پیام گفتگو"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>درج در گفتگو</span>
                          </button>
                        )}

                        {/* Copy description */}
                        <button
                          type="button"
                          onClick={() => handleCopyTaskDescription(t)}
                          className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer border border-slate-200/70 dark:border-slate-700"
                          title="کپی متن توضیحات فعالیت"
                        >
                          {copiedTaskId === t.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 text-[10px] font-bold">کپی شد</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">کپی</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* View Full Task Details modal */}
                      {onViewTaskDetails && (
                        <button
                          type="button"
                          onClick={() => onViewTaskDetails(t)}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-1"
                        >
                          <span>جزئیات کامل</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent for Contact Row
const ContactRowItem: React.FC<{
  contact: ChatContact;
  isSelected: boolean;
  unreadCount: number;
  onClick: () => void;
}> = ({ contact, isSelected, unreadCount, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3.5 transition-colors cursor-pointer text-right ${
        isSelected
          ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-r-4 border-indigo-600 dark:border-indigo-400'
          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="relative shrink-0">
          {contact.avatar ? (
            <img
              src={contact.avatar}
              alt={contact.name}
              className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                contact.isExternal
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                  : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
              }`}
            >
              {contact.name ? contact.name.charAt(0) : <UserIcon className="w-5 h-5" />}
            </div>
          )}
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 left-0 border-2 border-white dark:border-slate-800" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
              {contact.name}
            </span>
            {contact.isExternal && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] font-bold shrink-0">
                خارج تیم
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            @{contact.username} {contact.role ? `• ${contact.role}` : ''}
          </div>
        </div>
      </div>

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] animate-pulse shadow-xs">
          {toPersianDigits(unreadCount)}
        </span>
      )}
    </button>
  );
};
