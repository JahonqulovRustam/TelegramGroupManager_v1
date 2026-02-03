
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Trash2, ShieldCheck, Key, RefreshCcw, PlusSquare, Hash, Link as LinkIcon, Loader2, Search, AlertCircle, Briefcase, CheckCircle2, CloudOff } from 'lucide-react';
import { CRMUser, ChatGroup } from '../types';
import { clearDatabase, saveGroup, getAllGroups, getAllUsers, saveUser, deleteUserFromDB } from '../services/dbService';
import { getChatInfo, getBotInfo } from '../services/telegramService';

interface AdminPanelProps {
  onClose: () => void;
  botToken: string;
  setBotToken: (t: string) => void;
  onGroupsUpdated: () => void;
  currentUser: CRMUser;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, botToken, setBotToken, onGroupsUpdated, currentUser }) => {
  const [allUsers, setAllUsers] = useState<CRMUser[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'GROUPS' | 'BOT'>('GROUPS');
  const [isResolving, setIsResolving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<{ ok: boolean, name?: string } | null>(null);

  useEffect(() => {
    loadData();
    checkBotStatus();
    if (currentUser.role === 'SUPERADMIN') setActiveTab('USERS');
  }, []);

  const checkBotStatus = async () => {
    console.log("Checking Bot Status...", { botToken }); // DEBUG log
    if (!botToken) {
      console.warn("Bot token is missing!");
      return;
    }
    const res = await getBotInfo(botToken);
    console.log("Bot Info Response:", res); // DEBUG log
    if (res && res.ok) {
      setBotStatus({ ok: true, name: res.result.first_name });
    } else {
      setBotStatus({ ok: false });
    }
  };

  const loadData = async () => {
    const [dbGroups, dbUsers] = await Promise.all([
      getAllGroups(),
      getAllUsers()
    ]);
    setGroups(dbGroups);
    if (currentUser.role === 'SUPERADMIN') {
      setAllUsers(dbUsers.filter(u => u.role === 'ADMIN'));
    } else if (currentUser.role === 'ADMIN') {
      setAllUsers(dbUsers.filter(u => u.parentId === currentUser.id));
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'SUPERADMIN') return alert("Superadmin guruh qo'sha olmaydi.");

    setFormError(null);
    const form = e.target as HTMLFormElement;
    const inputVal = (form.elements.namedItem('chatInput') as HTMLInputElement).value;

    setIsResolving(true);
    try {
      const res = await getChatInfo(botToken, inputVal);
      if (res && res.ok) {
        const newGroup: ChatGroup = {
          id: res.result.id,
          title: res.result.title || "Noma'lum",
          type: res.result.type,
          memberCount: 0,
          unreadCount: 0,
          isActive: true,
          announceGroup: true,
          announceSender: true,
          readContent: false
        };
        await saveGroup(newGroup);
        await loadData();
        onGroupsUpdated();
        form.reset();
      } else {
        setFormError(res?.description || "Guruh topilmadi. Bot guruhda admin ekanligini tekshiring.");
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const role: CRMUser['role'] = currentUser.role === 'SUPERADMIN' ? 'ADMIN' : 'DISPATCHER';

    const newUser: CRMUser = {
      id: Date.now().toString(),
      fullName: (form.elements.namedItem('fullName') as HTMLInputElement).value,
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      role: role,
      parentId: currentUser.id
    };

    await saveUser(newUser);
    await loadData();
    form.reset();
  };

  const handleFullReset = async () => {
    if (window.confirm("DIQQAT: Barcha ma'lumotlar o'chadi! Davom etasizmi?")) {
      await clearDatabase();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 backdrop-blur-2xl flex items-center justify-center p-6">
      <div className="max-w-5xl w-full bg-slate-900 border border-white/5 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{currentUser.role === 'SUPERADMIN' ? 'Super Boshqaruv' : 'Tashkilot Paneli'}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{currentUser.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-800 rounded-2xl hover:bg-slate-700 transition-all"><X className="w-6 h-6 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10">
          <div className="flex flex-wrap gap-4 mb-10">
            {currentUser.role !== 'SUPERADMIN' && (
              <button onClick={() => setActiveTab('GROUPS')} className={`px-8 py-4 rounded-2xl font-bold transition-all ${activeTab === 'GROUPS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Guruhlar</button>
            )}
            <button onClick={() => setActiveTab('USERS')} className={`px-8 py-4 rounded-2xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>
              {currentUser.role === 'SUPERADMIN' ? 'Adminlar' : 'Dispetcherlar'}
            </button>
            {currentUser.role === 'SUPERADMIN' && (
              <button onClick={() => setActiveTab('BOT')} className={`px-8 py-4 rounded-2xl font-bold transition-all ${activeTab === 'BOT' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Tizim Sozlamalari</button>
            )}

            <div className="ml-auto flex items-center gap-3 bg-slate-800/50 px-5 py-3 rounded-2xl border border-white/5">
              {botStatus?.ok ? (
                <>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Bot Online: {botStatus.name}</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Bot Offline</span>
                </>
              )}
            </div>
          </div>

          {activeTab === 'USERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
              <div className="bg-slate-800/30 p-8 rounded-3xl border border-white/5 h-fit">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-indigo-400">
                  <UserPlus className="w-5 h-5" />
                  Qo'shish
                </h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <input name="fullName" placeholder="To'liq Ismi" required className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 text-white" />
                  <input name="username" placeholder="Login" required className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 text-white" />
                  <input name="password" type="password" placeholder="Parol" required className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 text-white" />
                  <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-all">Saqlash</button>
                </form>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-400"><Users className="w-5 h-5" /> Ro'yxat</h3>
                {allUsers.map(u => (
                  <div key={u.id} className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-white">{u.fullName}</p>
                      <p className="text-[10px] text-indigo-400 uppercase font-black">{u.username} • {u.role}</p>
                    </div>
                    <button onClick={async () => { if (window.confirm("O'chirilsinmi?")) { await deleteUserFromDB(u.id); loadData(); } }} className="p-2 text-slate-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'GROUPS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
              <div className="bg-slate-800/30 p-8 rounded-3xl border border-white/5 h-fit">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-emerald-400"><PlusSquare className="w-5 h-5" /> Guruh Boshqaruvi</h3>
                <form onSubmit={handleAddGroup} className="space-y-4">
                  <input name="chatInput" placeholder="Guruh ID (masalan: -100...)" required className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-emerald-500 text-white" />
                  {formError && <p className="text-[10px] text-red-500 font-bold uppercase p-2 bg-red-500/10 rounded-lg">{formError}</p>}
                  <button type="submit" disabled={isResolving} className="w-full bg-emerald-600 py-4 rounded-xl font-black uppercase text-white hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                    {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                    Guruhni Ulash
                  </button>
                </form>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold mb-6 text-slate-400">Ulangan Guruhlar</h3>
                {groups.map(g => (
                  <div key={g.id} className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-xs font-black text-white">{g.title.charAt(0)}</div>
                      <p className="font-bold text-sm text-white">{g.title}</p>
                    </div>
                    <button className="p-2 text-slate-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'BOT' && (
            <div className="max-w-md mx-auto py-10 space-y-8 animate-fade-in text-center">
              <div className="bg-slate-800/30 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <Key className="w-12 h-12 text-amber-500 mx-auto mb-6" />
                <h3 className="font-black text-lg mb-4 text-white uppercase tracking-widest">Bot Token</h3>

                <div className="flex flex-col gap-4 mb-6">
                  <input
                    value={botToken}
                    onChange={(e) => {
                      const newToken = e.target.value;
                      setBotToken(newToken);
                      localStorage.setItem('crm_bot_token', newToken);
                    }}
                    onBlur={() => {
                      // Save to DB when focus lost or explicitly
                      import('../services/dbService').then(m => m.saveBotToken(botToken));
                    }}
                    placeholder="Bot tokenini kiriting..."
                    className="bg-slate-950 p-4 rounded-2xl border border-white/5 text-xs text-slate-300 font-mono text-center outline-none focus:border-indigo-500 transition-colors"
                  />
                  <p className="text-[9px] text-slate-600 uppercase font-bold">Token Baza va LocalStorage da saqlanadi</p>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => {
                    import('../services/dbService').then(m => m.saveBotToken(botToken));
                    checkBotStatus();
                  }} className="bg-slate-800 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Qayta tekshirish (Save)</button>
                </div>
              </div>

              <div className="p-8 border border-red-500/20 rounded-[2.5rem] bg-red-500/5">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-4">Xavfli Hudud</p>
                <button onClick={handleFullReset} className="w-full bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl font-black uppercase text-[10px] transition-all border border-red-500/20">Master Reset</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
