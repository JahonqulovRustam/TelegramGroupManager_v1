
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import StatsPanel from './components/StatsPanel.tsx';
import GlobalSearch from './components/GlobalSearch.tsx';
import Login from './components/Login.tsx';
import { ChatGroup, Message, AppState, CRMUser, Theme } from './types.ts';
import { Bell, Volume2, VolumeX, LogOut, Sun, Moon, MessageSquare, ShieldCheck, ExternalLink, Activity, Box, ShieldAlert, Copy, CheckCircle, Database, AlertTriangle } from 'lucide-react';
import { getTelegramUpdates, parseTelegramUpdate, sendTelegramReply, sendTelegramSticker, sendTelegramAnimation } from './services/telegramService.ts';
import { speakText, initAudioContext } from './services/geminiService.ts';
import { getAllMessages, getAllGroups, saveMessage, saveGroup, clearDatabase } from './services/dbService.ts';
import { supabase } from './services/supabaseClient.ts';

const SAVED_MESSAGES_GROUP: ChatGroup = {
  id: 0,
  title: "Saqlanganlar",
  type: "SAVED",
  memberCount: 0,
  unreadCount: 0,
  lastMessageTimestamp: Date.now() + 1000000,
  isActive: true
};

const ExternalAppLauncher: React.FC<{ title: string, url: string, icon: React.ReactNode, color: string, description: string }> = ({ title, url, icon, color, description }) => {
  const [copied, setCopied] = useState(false);
  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.openLink) tg.openLink(cleanUrl, { try_instant_view: false });
    else window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 md:p-10 bg-[#0b141a] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className={`w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8 shadow-2xl animate-bounce-slow ${color} text-white`}>{icon}</div>
      <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight text-center">{title}</h2>
      <p className="text-slate-500 max-w-md text-center mb-8 md:mb-10 leading-relaxed font-medium text-xs md:text-sm px-4">{description}</p>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button onClick={handleOpen} className={`flex items-center justify-center gap-3 py-4 md:py-5 px-8 md:px-10 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95 ${color}`}><ExternalLink className="w-5 h-5" /> Tizimga Kirish</button>
        <button onClick={handleCopy} className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-slate-800/30 hover:bg-slate-800 text-slate-400 font-bold text-[10px] uppercase tracking-widest border border-white/5 transition-all">{copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} {copied ? "Nusxalandi" : "Havolani nusxalash"}</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(() => {
    const saved = localStorage.getItem('crm_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [botToken, setBotToken] = useState<string>(localStorage.getItem('crm_bot_token') || '');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [lastUpdateId, setLastUpdateId] = useState<number>(0);
  const [state, setState] = useState<AppState>({
    groups: [SAVED_MESSAGES_GROUP],
    messages: [],
    activeChatId: null,
    isLoading: true,
    theme: (localStorage.getItem('crm_theme') as Theme) || 'dark',
    currentPath: 'CRM'
  });
  const [notifications, setNotifications] = useState<{ id: string, text: string }[]>([]);
  const processedIdsRef = useRef(new Set<string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.documentElement.className = state.theme;
    localStorage.setItem('crm_theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audioRef.current.volume = 0.4;
  }, []);

  useEffect(() => {
    const loadFromDB = async () => {
      // 1. Try to get token from DB (Source of Truth)
      try {
        const dbToken = await import('./services/dbService.ts').then(m => m.getBotToken());
        if (dbToken && dbToken !== botToken) {
          setBotToken(dbToken);
          localStorage.setItem('crm_bot_token', dbToken);
        } else {
          // Fallback to local
          const currentToken = localStorage.getItem('crm_bot_token') || '';
          if (currentToken !== botToken && !dbToken) setBotToken(currentToken);
        }
      } catch (e) {
        console.warn("Could not fetch token from DB", e);
      }

      const currentToken = localStorage.getItem('crm_bot_token') || '';
      // We already handled setting it above, but ensure redundancy

      if (currentUser) {
        try {
          const [dbGroups, dbMessages] = await Promise.all([getAllGroups(), getAllMessages()]);
          dbMessages.forEach(m => processedIdsRef.current.add(m.id));
          const uniqueGroups = Array.from(new Map(dbGroups.map(g => [g.id, g])).values());
          const sortedGroups = [SAVED_MESSAGES_GROUP, ...uniqueGroups].sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
          setState(prev => ({ ...prev, groups: sortedGroups, messages: dbMessages, isLoading: false }));
        } catch (err) { setState(prev => ({ ...prev, isLoading: false })); }
      } else setState(prev => ({ ...prev, isLoading: false }));
    };
    loadFromDB();
  }, [currentUser]); // Removed botToken dependency to avoid loops, we set it inside

  useEffect(() => {
    if (!botToken || !currentUser || state.isLoading) return;
    let active = true;
    const poll = async () => {
      if (!active || !currentUser) return;
      try {
        const updates = await getTelegramUpdates(botToken, lastUpdateId + 1);
        if (active && updates && updates.length > 0) {
          let maxId = lastUpdateId;
          for (const update of updates) {
            if (update.update_id > maxId) maxId = update.update_id;
            const parsed = parseTelegramUpdate(update);
            if (parsed) await handleNewUpdate(parsed.message, parsed.chat);
          }
          setLastUpdateId(maxId);
        }
      } catch (err) { }
      if (active) setTimeout(poll, 3000);
    };
    poll();
    return () => { active = false; };
  }, [lastUpdateId, botToken, currentUser, state.isLoading]);

  const handleNewUpdate = async (msg: Message, chat: ChatGroup) => {
    if (processedIdsRef.current.has(msg.id)) return;
    processedIdsRef.current.add(msg.id);
    const isBotSelf = msg.from.id === parseInt(botToken.split(':')[0]);
    await saveMessage({ ...msg, isReply: isBotSelf });
    setState(prev => {
      const existingGroup = prev.groups.find(g => g.id === chat.id);
      let updatedGroup: ChatGroup = existingGroup
        ? { ...existingGroup, lastMessage: msg.text, lastMessageTimestamp: msg.timestamp, unreadCount: (prev.activeChatId === chat.id || isBotSelf) ? 0 : (existingGroup.unreadCount || 0) + 1 }
        : { ...chat, isActive: true, unreadCount: 1, announceGroup: true, announceSender: true, readContent: false, lastMessageTimestamp: msg.timestamp };
      saveGroup(updatedGroup);
      const sorted = [...prev.groups.filter(g => g.id !== chat.id), updatedGroup].sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      if (!isBotSelf && isAudioEnabled) {
        const settings = updatedGroup;
        if (settings.announceGroup || settings.announceSender || settings.readContent) {
          let speech = "";
          if (settings.announceSender && settings.announceGroup) speech = `${msg.from.first_name} ${settings.title} guruhiga yozdi`;
          else if (settings.announceSender) speech = `${msg.from.first_name} yozdi`;
          else if (settings.announceGroup) speech = `${settings.title} guruhida yangi xabar`;
          if (settings.readContent && msg.text) speech += `. Matn: ${msg.text}`;
          if (speech) speakText(speech);
        } else audioRef.current?.play().catch(() => { });
        if (prev.activeChatId !== chat.id) addNotification(`${msg.from.first_name}: ${msg.text.substring(0, 30)}`);
      }
      return { ...prev, groups: sorted, messages: [...prev.messages, { ...msg, isReply: isBotSelf }] };
    });
  };

  const addNotification = (text: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem('crm_current_user');
    setCurrentUser(null);
    window.location.reload();
  };

  const selectGroup = (id: number) => {
    setState(prev => ({ ...prev, activeChatId: id, groups: prev.groups.map(g => g.id === id ? { ...g, unreadCount: 0 } : g) }));
    const group = state.groups.find(g => g.id === id);
    if (group && group.id !== 0) saveGroup({ ...group, unreadCount: 0 });
  };

  if (!currentUser) return <Login onLogin={(user, token) => { setCurrentUser(user); setBotToken(token); }} />;

  const canAdmin = currentUser.role === 'SUPERADMIN' || currentUser.role === 'ADMIN';

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors ${state.theme === 'dark' ? 'bg-[#0b141a] text-slate-100' : 'bg-slate-50 text-slate-900'}`} onPointerDown={() => initAudioContext()}>
      <nav className="w-16 md:w-20 bg-slate-950 border-r border-white/5 flex flex-col items-center py-8 gap-6 z-[100] shadow-2xl shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4"><ShieldCheck className="w-6 h-6 text-white" /></div>
        <button onClick={() => setState(p => ({ ...p, currentPath: 'CRM' }))} className={`p-3 rounded-2xl transition-all group relative ${state.currentPath === 'CRM' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-900'}`}><MessageSquare className="w-6 h-6" /><span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-[110]">CRM</span></button>
        <button onClick={() => setState(p => ({ ...p, currentPath: 'MEDDATA' }))} className={`p-3 rounded-2xl transition-all group relative ${state.currentPath === 'MEDDATA' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-900'}`}><Activity className="w-6 h-6" /><span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-[110]">103</span></button>
        <button onClick={() => setState(p => ({ ...p, currentPath: 'OPTX' }))} className={`p-3 rounded-2xl transition-all group relative ${state.currentPath === 'OPTX' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-900'}`}><Box className="w-6 h-6" /><span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-[110]">DIS</span></button>
        <div className="mt-auto flex flex-col gap-4">
          <button onClick={() => setState(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))} className="p-3 text-slate-600 hover:text-white transition-colors">{state.theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}</button>
          <button onClick={handleLogout} className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all group relative"><LogOut className="w-6 h-6" /><span className="absolute left-full ml-4 px-2 py-1 bg-red-600 text-[8px] font-black uppercase tracking-widest text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-[110]">Chiqish</span></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {state.currentPath === 'CRM' && (
          <div className="flex h-full w-full overflow-hidden">
            <Sidebar
              groups={state.groups.filter(g => g.id !== 0)}
              activeChatId={state.activeChatId}
              onSelectGroup={selectGroup}
              onUpdateGroupSettings={(id, s) => {
                setState(prev => {
                  const updated = prev.groups.map(g => g.id === id ? { ...g, ...s } : g);
                  const group = updated.find(g => g.id === id);
                  if (group && group.id !== 0) saveGroup(group);
                  return { ...prev, groups: updated };
                });
              }}
              isAdmin={canAdmin}
              onOpenAdmin={() => setShowAdminPanel(true)}
              onOpenStats={() => setShowStatsPanel(true)}
              onOpenGlobalSearch={() => setShowGlobalSearch(true)}
            />
            <ChatWindow
              activeGroup={state.groups.find(g => g.id === state.activeChatId) || null}
              messages={state.messages.filter(m => m.chatId === state.activeChatId)}
              availableGroups={state.groups.filter(g => g.id !== 0)}
              onBroadcast={async (t, ids) => {
                for (const gid of ids) {
                  const res = await sendTelegramReply(botToken, gid, `${currentUser.fullName}: ${t}`);
                  if (res?.ok) {
                    const m: Message = { id: res.result.message_id.toString(), chatId: gid, from: { id: 0, first_name: currentUser.fullName }, text: t, timestamp: Date.now(), isReply: true };
                    processedIdsRef.current.add(m.id); await saveMessage(m);
                    setState(p => ({ ...p, messages: [...p.messages, m] }));
                  }
                }
              }}
              onSendMedia={async (type, data, r) => {
                if (state.activeChatId === null || state.activeChatId === 0) return;
                let res = type === 'sticker' ? await sendTelegramSticker(botToken, state.activeChatId, data, r) : await sendTelegramAnimation(botToken, state.activeChatId, data, `${currentUser.fullName}: GIF`, r);
                if (res?.ok) {
                  const m: Message = { id: res.result.message_id.toString(), chatId: state.activeChatId, from: { id: 0, first_name: currentUser.fullName }, text: type === 'sticker' ? '[Stiker]' : '[GIF]', timestamp: Date.now(), isReply: true, type, fileUrl: data, replyToId: r };
                  processedIdsRef.current.add(m.id); await saveMessage(m);
                  setState(p => ({ ...p, messages: [...p.messages, m] }));
                }
              }}
              onSendMessage={async (t, r) => {
                if (state.activeChatId === null) return;
                if (state.activeChatId === 0) {
                  const m: Message = { id: Date.now().toString(), chatId: 0, from: { id: 0, first_name: currentUser.fullName }, text: t, timestamp: Date.now(), isReply: true };
                  processedIdsRef.current.add(m.id); await saveMessage(m);
                  setState(p => ({ ...p, messages: [...p.messages, m] }));
                  return;
                }
                const res = await sendTelegramReply(botToken, state.activeChatId, `${currentUser.fullName}: ${t}`, r);
                if (res?.ok) {
                  const m: Message = { id: res.result.message_id.toString(), chatId: state.activeChatId, from: { id: 0, first_name: currentUser.fullName }, text: t, timestamp: Date.now(), isReply: true, replyToId: r };
                  processedIdsRef.current.add(m.id); await saveMessage(m);
                  setState(p => ({ ...p, messages: [...p.messages, m] }));
                }
              }}
            />
          </div>
        )}
        {state.currentPath === 'MEDDATA' && <ExternalAppLauncher title="MedData Auth" url="https://103-auth.meddata.uz/Account/Login" icon={<Activity className="w-16 h-16" />} color="bg-blue-600" description="Tez yordam monitoring tizimi" />}
        {state.currentPath === 'OPTX' && <ExternalAppLauncher title="Optx DIS" url="https://dis-auth.optx.uz/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fresponse_type%3Dcode%26client_id%3Duds_front%26state%3DSU0wam9ZV0szWEFZcUY2Vk1RS2J-QWhmamFMcnpBTE9VVFlZLWRIRWhaYWVj;%25252F%26redirect_uri%3Dhttps%253A%252F%252Fdis.optx.uz%252F%26scope%3Dopenid%2520profile%2520offline_access%26code_challenge%3Drp8r7OqSZcDObN2mk0udUH8J1QW-qEkuqVBQLrHYAs0%26code_challenge_method%3DS256%26nonce%3DSU0wam9ZV0szWEFZcUY2Vk1RS2J-QWhmamFMcnpBTE9VVFlZLWRIRWhaYWVj" icon={<Box className="w-16 h-16" />} color="bg-purple-600" description="Analitika va tahlil platformasi" />}

        {showAdminPanel && canAdmin && <AdminPanel currentUser={currentUser} onClose={() => setShowAdminPanel(false)} botToken={botToken} setBotToken={setBotToken} onGroupsUpdated={async () => {
          const dbGroups = await getAllGroups();
          setState(p => ({ ...p, groups: [SAVED_MESSAGES_GROUP, ...dbGroups].sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0)) }));
        }} />}
        {showStatsPanel && <StatsPanel onClose={() => setShowStatsPanel(false)} groups={state.groups} messages={state.messages} />}
        {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} messages={state.messages} groups={state.groups} onSelectResult={selectGroup} />}

        <div className="fixed top-4 right-6 z-40 flex items-center gap-3">
          {!supabase && (
            <div className="bg-amber-600/90 backdrop-blur-md px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-xl border border-amber-500/20 group">
              <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-white uppercase tracking-wider">Baza Sozlanmagan</span>
                <span className="text-[7px] text-amber-200 font-bold uppercase">Ma'lumotlar saqlanmaydi</span>
              </div>
            </div>
          )}
          <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={`p-3 rounded-2xl transition-all backdrop-blur-md border border-white/5 ${isAudioEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
          <div className="bg-slate-900/90 px-5 py-2.5 rounded-2xl border border-white/5 flex items-center gap-4 backdrop-blur-xl shadow-2xl">
            <div className="text-right">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-0.5">{currentUser.role}</p>
              <p className="text-sm font-black text-indigo-400 leading-tight">{currentUser.fullName}</p>
            </div>
          </div>
        </div>

        <div className="fixed bottom-10 right-10 z-[120] space-y-3 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className="bg-slate-900/95 border border-indigo-500/30 p-5 rounded-3xl shadow-2xl flex items-center gap-4 animate-slide-in backdrop-blur-2xl min-w-[320px]">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30"><Bell className="w-5 h-5 text-white" /></div>
              <div><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Xabar</p><p className="text-xs font-bold text-slate-200 line-clamp-2">{n.text}</p></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;

