
import { Message, ChatGroup, CRMUser } from '../types';
import { supabase } from './supabaseClient';

const isConnected = () => {
  if (!supabase) {
    console.warn("Supabase ulanmagan. Ma'lumotlar saqlanmaydi.");
    return false;
  }
  return true;
};

export const saveMessage = async (message: Message) => {
  if (!isConnected()) return;
  const { error } = await supabase!.from('messages').upsert({
    id: message.id,
    chatId: message.chatId,
    from_data: message.from,
    text: message.text,
    timestamp: message.timestamp,
    isReply: message.isReply || false,
    replyToId: message.replyToId,
    type: message.type,
    fileId: message.fileId,
    fileUrl: message.fileUrl
  });

  if (error) console.error("Supabase Save Message Error:", error);
};

export const getAllMessages = async (): Promise<Message[]> => {
  if (!isConnected()) return [];
  const { data, error } = await supabase!
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: true });

  if (error) {
    console.error("Supabase Get Messages Error:", error);
    return [];
  }

  return data.map(m => ({
    id: m.id,
    chatId: m.chatId,
    from: m.from_data,
    text: m.text,
    timestamp: m.timestamp,
    isReply: m.isReply,
    replyToId: m.replyToId,
    type: m.type,
    fileId: m.fileId,
    fileUrl: m.fileUrl
  }));
};

export const saveGroup = async (group: ChatGroup) => {
  if (!isConnected()) return;
  const { error } = await supabase!.from('groups').upsert({
    id: group.id,
    title: group.title,
    type: group.type,
    memberCount: group.memberCount,
    lastMessage: group.lastMessage,
    lastMessageTimestamp: group.lastMessageTimestamp,
    unreadCount: group.unreadCount,
    announceGroup: group.announceGroup ?? true,
    announceSender: group.announceSender ?? true,
    readContent: group.readContent ?? false,
    isActive: group.isActive ?? true
  });

  if (error) console.error("Supabase Save Group Error:", error);
};

export const getAllGroups = async (): Promise<ChatGroup[]> => {
  if (!isConnected()) return [];
  const { data, error } = await supabase!.from('groups').select('*');
  if (error) {
    console.error("Supabase Get Groups Error:", error);
    return [];
  }
  return data;
};

export const saveUser = async (user: CRMUser) => {
  if (!isConnected()) return;
  const { error } = await supabase!.from('users').upsert(user);
  if (error) console.error("Supabase Save User Error:", error);
};

export const getAllUsers = async (): Promise<CRMUser[]> => {
  if (!isConnected()) return [];
  const { data, error } = await supabase!.from('users').select('*');
  if (error) {
    console.error("Supabase Get Users Error:", error);
    return [];
  }
  return data;
};

export const deleteUserFromDB = async (userId: string) => {
  if (!isConnected()) return;
  const { error } = await supabase!.from('users').delete().eq('id', userId);
  if (error) console.error("Supabase Delete User Error:", error);
};

export const saveBotToken = async (token: string) => {
  if (!isConnected()) return;
  // We use a 'settings' table. If it doesn't exist, this will fail.
  // Ideally, create a table: create table settings (key text primary key, value text);
  const { error } = await supabase!.from('settings').upsert({
    key: 'bot_token',
    value: token
  });
  if (error) console.error("Supabase Save Token Error:", error);
};

export const getBotToken = async (): Promise<string | null> => {
  if (!isConnected()) return null;
  const { data, error } = await supabase!
    .from('settings')
    .select('value')
    .eq('key', 'bot_token')
    .single();

  if (error) {
    // Silent fail as table might not exist
    return null;
  }
  return data?.value || null;
};

export const clearDatabase = async () => {
  const botToken = localStorage.getItem('crm_bot_token');
  const theme = localStorage.getItem('crm_theme');

  if (isConnected()) {
    try {
      await supabase!.from('messages').delete().neq('id', '0');
      await supabase!.from('groups').delete().neq('id', '0');
      await supabase!.from('users').delete().neq('id', 'super-root');
      // Optional: don't clear settings
    } catch (e) {
      console.error("Clear database failed:", e);
    }
  }

  localStorage.clear();

  if (botToken) localStorage.setItem('crm_bot_token', botToken);
  if (theme) localStorage.setItem('crm_theme', theme);
};
