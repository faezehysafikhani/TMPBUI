import React, { useState, useEffect } from 'react';
import { User, WorkTeam, WorkTeamMember } from '../types';
import { fetchAllUsersPB, fetchUserTeamsAsyncPB, saveUserTeamsPB } from '../services/pocketbase';
import {
  Users,
  UserPlus,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus
} from 'lucide-react';

interface WorkTeamManagementProps {
  currentUser: User;
  onTeamsUpdated?: (updatedTeams: WorkTeam[]) => void;
}

export const WorkTeamManagement: React.FC<WorkTeamManagementProps> = ({ currentUser, onTeamsUpdated }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [isCreatingTeam, setIsCreatingTeam] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load users and teams
  const loadData = async () => {
    setLoading(true);
    try {
      const usersList = await fetchAllUsersPB();
      setAllUsers(usersList);

      const existingTeams = await fetchUserTeamsAsyncPB(currentUser.id);
      if (existingTeams.length === 0) {
        // Create default team for current user if none exists
        const defaultTeam: WorkTeam = {
          id: 'team_' + Date.now(),
          name: 'تیم کاری اصلی',
          ownerId: currentUser.id,
          members: [
            {
              userId: currentUser.id,
              name: currentUser.name || currentUser.username,
              username: currentUser.username,
              avatar: currentUser.avatar,
              role: 'مدیر تیم',
            },
          ],
          createdAt: new Date().toISOString(),
        };
        await saveUserTeamsPB(currentUser.id, [defaultTeam]);
        setTeams([defaultTeam]);
        setActiveTeamId(defaultTeam.id);
      } else {
        setTeams(existingTeams);
        setActiveTeamId(existingTeams[0].id);
      }
    } catch (err) {
      console.error('Error loading team management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeam: WorkTeam = {
      id: 'team_' + Date.now(),
      name: newTeamName.trim(),
      ownerId: currentUser.id,
      members: [
        {
          userId: currentUser.id,
          name: currentUser.name || currentUser.username,
          username: currentUser.username,
          avatar: currentUser.avatar,
          role: 'مدیر تیم',
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const updatedTeams = [...teams, newTeam];
    setTeams(updatedTeams);
    setActiveTeamId(newTeam.id);
    await saveUserTeamsPB(currentUser.id, updatedTeams);
    onTeamsUpdated?.(updatedTeams);
    setNewTeamName('');
    setIsCreatingTeam(false);
    setActionMsg({ type: 'success', text: `تیم کاری جدید «${newTeam.name}» با موفقیت ایجاد گردید 🎉` });
  };

  const handleAddMember = async (userToAdd: User) => {
    if (!activeTeam) return;

    // Check if user is already in active team
    if (activeTeam.members.some((m) => m.userId === userToAdd.id)) {
      setActionMsg({ type: 'error', text: 'این کاربر قبلاً در تیم قرار دارد.' });
      return;
    }

    const newMember: WorkTeamMember = {
      userId: userToAdd.id,
      name: userToAdd.name || userToAdd.username,
      username: userToAdd.username,
      avatar: userToAdd.avatar,
      role: 'عضو تیم',
    };

    const updatedTeams = teams.map((t) => {
      if (t.id === activeTeam.id) {
        return {
          ...t,
          members: [...t.members, newMember],
        };
      }
      return t;
    });

    setTeams(updatedTeams);
    await saveUserTeamsPB(currentUser.id, updatedTeams);
    onTeamsUpdated?.(updatedTeams);
    setActionMsg({
      type: 'success',
      text: `کاربر «${userToAdd.name || userToAdd.username}» به تیم ${activeTeam.name} اضافه شد.`,
    });
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!activeTeam) return;

    if (memberUserId === currentUser.id) {
      setActionMsg({ type: 'error', text: 'امکان حذف سازنده تیم وجود ندارد.' });
      return;
    }

    const updatedTeams = teams.map((t) => {
      if (t.id === activeTeam.id) {
        return {
          ...t,
          members: t.members.filter((m) => m.userId !== memberUserId),
        };
      }
      return t;
    });

    setTeams(updatedTeams);
    await saveUserTeamsPB(currentUser.id, updatedTeams);
    onTeamsUpdated?.(updatedTeams);
    setActionMsg({ type: 'success', text: 'عضو موردنظر از تیم حذف گردید.' });
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (teams.length <= 1) {
      setActionMsg({ type: 'error', text: 'حداقل یک تیم کاری باید وجود داشته باشد.' });
      return;
    }

    const targetTeam = teams.find((t) => t.id === teamId);
    if (!window.confirm(`آیا از حذف تیم کاری «${targetTeam?.name}» اطمینان دارید؟`)) return;

    const updatedTeams = teams.filter((t) => t.id !== teamId);
    setTeams(updatedTeams);
    setActiveTeamId(updatedTeams[0].id);
    await saveUserTeamsPB(currentUser.id, updatedTeams);
    onTeamsUpdated?.(updatedTeams);
    setActionMsg({ type: 'success', text: 'تیم کاری حذف گردید.' });
  };

  // Filter users for search results (exclude members already in active team)
  const availableUsersToSearch = allUsers.filter(
    (u) =>
      u.id !== currentUser.id &&
      ((u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {actionMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Team Tabs & Create Team Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setActiveTeamId(team.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTeam?.id === team.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{team.name}</span>
              <span className="text-[10px] opacity-80">({team.members.length})</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingTeam(!isCreatingTeam)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ساخت تیم کاری جدید</span>
        </button>
      </div>

      {/* Form to Create New Team */}
      {isCreatingTeam && (
        <form
          onSubmit={handleCreateTeam}
          className="p-3 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-2 animate-in fade-in duration-200"
        >
          <input
            type="text"
            required
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="نام تیم کاری (مثلاً: تیم پروژه طراحی UI)"
            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shrink-0"
          >
            ایجاد تیم
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingTeam(false)}
            className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-xs">در حال بارگذاری اعضا و تیم‌های کاری...</span>
        </div>
      ) : activeTeam ? (
        <div className="space-y-4">
          
          {/* Active Team Header Info & Search Members Section */}
          <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
              <div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>تیم کاری: {activeTeam.name}</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  تعداد اعضا: {activeTeam.members.length} نفر
                </p>
              </div>

              {teams.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteTeam(activeTeam.id)}
                  title="حذف این تیم"
                  className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف تیم</span>
                </button>
              )}
            </div>

            {/* Search for users to add */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                جستجو و اضافه کردن کاربر به {activeTeam.name}:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="نام یا نام کاربری همکار خود را جستجو کنید..."
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Instant Search Results Dropdown List */}
              {searchTerm.trim().length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 animate-in fade-in duration-150">
                  {availableUsersToSearch.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      کاربری با این مشخصات پیدا نشد یا قبلاً عضو تیم شده است.
                    </div>
                  ) : (
                    availableUsersToSearch.map((user) => {
                      const isAlreadyInTeam = activeTeam.members.some((m) => m.userId === user.id);
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {user.name || user.username}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                @{user.username} {user.email ? `(${user.email})` : ''}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAlreadyInTeam}
                            onClick={() => handleAddMember(user)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              isAlreadyInTeam
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{isAlreadyInTeam ? 'عضو تیم' : 'افزودن به تیم'}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Current Team Members List */}
          <div className="space-y-2">
            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>لیست اعضای فعلی {activeTeam.name}:</span>
              <span className="text-[10px] font-normal text-slate-500">
                {activeTeam.members.length} عضو
              </span>
            </h5>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeTeam.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80"
                >
                  <div className="flex items-center gap-3">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {member.name ? member.name.charAt(0).toUpperCase() : member.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {member.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                            member.role === 'مدیر تیم'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}
                        >
                          {member.role || 'عضو تیم'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        @{member.username}
                      </span>
                    </div>
                  </div>

                  {member.userId !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      title="حذف از تیم"
                      className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">حذف</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};
