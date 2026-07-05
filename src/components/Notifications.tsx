/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Send, 
  Trash2, 
  Check, 
  CheckCheck, 
  User, 
  MessageSquare,
  AlertCircle,
  Megaphone,
  Phone,
  Video,
  MoreVertical,
  Search,
  Smile,
  Paperclip,
  Mic,
  ArrowRight,
  PhoneOff,
  Volume2,
  VolumeX,
  MicOff,
  Info,
  Lock,
  Camera,
  Shield,
  ShieldCheck,
  Fingerprint,
  Key,
  Cpu,
  Layers,
  Sparkles,
  ChevronLeft,
  X,
  CheckSquare,
  Eye,
  Wifi,
  Globe,
  Radio,
  Settings,
  Sliders,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Play,
  Pause,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification, User as UserType } from '../types';

function VoiceMessagePlayer({ url, duration }: { url: string; duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [url]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error("Error playing audio", err));
    }
  };

  const formatDuration = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const totalDuration = duration || (audioRef.current?.duration) || 0;
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-black/5 rounded-xl p-2.5 min-w-[210px] text-right" style={{ direction: 'rtl' }}>
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 active:scale-95"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white translate-x-[1px]" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-600 font-bold mb-1 flex justify-between items-center px-0.5">
          <span>رسالة صوتية</span>
          <span>{formatDuration(currentTime)} / {formatDuration(totalDuration || 0)}</span>
        </div>
        <div className="h-1.5 bg-slate-300/60 rounded-full overflow-hidden relative">
          <div 
            className="h-full bg-emerald-600 rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface NotificationsProps {
  currentUser: UserType;
  usersList: UserType[];
  notifications: Notification[];
  onUpdateNotifications: (notifications: Notification[]) => void;
}

interface ChatListItem {
  id: string; // 'all-users', 'all-admins', or specific userId
  name: string;
  subtitle: string;
  role: string;
  isGroup: boolean;
  avatarColor: string;
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount: number;
}

export default function Notifications({
  currentUser,
  usersList,
  notifications,
  onUpdateNotifications,
}: NotificationsProps) {
  // Chat list state
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  
  // Message input state
  const [inputMessage, setInputMessage] = useState('');
  
  // Mobile responsive view toggle
  const [showChatPaneMobile, setShowChatPaneMobile] = useState(false);

  // Calling simulator state
  const [activeCall, setActiveCall] = useState<{
    type: 'audio' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    chatName: string;
    chatId: string;
    duration: number;
  } | null>(null);
  
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(true);
  const [connectionMode, setConnectionMode] = useState<'internet' | 'hotspot' | 'wifidirect'>('internet');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Encryption states
  const [showEncryptionVerifyModal, setShowEncryptionVerifyModal] = useState(false);
  const [selectedEncryptionAlgorithm, setSelectedEncryptionAlgorithm] = useState<'AES-GCM-256' | 'ChaCha20-Poly1305'>('AES-GCM-256');

  // Encryption Fingerprint Generator helper
  const getEncryptionFingerprint = (chatId: string) => {
    let hash = 0;
    for (let i = 0; i < chatId.length; i++) {
      hash = (hash << 5) - hash + chatId.charCodeAt(i);
      hash |= 0;
    }
    const blocks = [];
    for (let b = 0; b < 12; b++) {
      const val = Math.abs((hash ^ (b * 93821 + 7731)) % 100000);
      blocks.push(val.toString().padStart(5, '0'));
    }
    return blocks.join(' ');
  };

  // Attachment states
  const [selectedAttachment, setSelectedAttachment] = useState<{
    type: 'image' | 'file';
    url: string;
    name: string;
    size: string;
  } | null>(null);

  // Audio Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start recording voice
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          // We capture current recording time via a local copy or the state
          sendVoiceMessage(base64Audio, recordingTime || 1);
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      setRecordingTime(0);
      setIsRecording(true);
      mediaRecorder.start();

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("تعذر الوصول إلى الميكروفون. يرجى التحقق من صلاحيات المتصفح.");
    }
  };

  // Stop recording and save/send
  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (shouldSend) {
      mediaRecorderRef.current.stop();
    } else {
      // Cancel recording - override onstop to discard
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
  };

  // Helper to send the voice message
  const sendVoiceMessage = (base64Audio: string, duration: number) => {
    if (!activeChat) return;
    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      receiverId: activeChat.id,
      title: activeChat.isGroup ? `رسالة صوتية في ${activeChat.name}` : `رسالة صوتية من ${currentUser.name}`,
      message: '🎙️ رسالة صوتية',
      date: new Date().toISOString(),
      read: false,
      communicationMethod: connectionMode,
      attachmentType: 'audio',
      attachmentUrl: base64Audio,
      audioDuration: duration
    };
    onUpdateNotifications([newNotif, ...notifications]);
  };

  // Handle files & images selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size under 5MB for localStorage
    if (file.size > 5 * 1024 * 1024) {
      alert("حجم الملف كبير جداً. يرجى اختيار ملف أقل من 5 ميجابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
      setSelectedAttachment({
        type,
        url: base64Data,
        name: file.name,
        size: sizeStr
      });
    };
    reader.readAsDataURL(file);
    // Reset input value so same file can be chosen again
    e.target.value = '';
  };

  // Clean recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Toast settings state
  const [showToastSettingsModal, setShowToastSettingsModal] = useState(false);
  const [showUrgentAlertModal, setShowUrgentAlertModal] = useState(false);
  const [urgentAlertRecipient, setUrgentAlertRecipient] = useState('all-users');
  const [urgentAlertMessage, setUrgentAlertMessage] = useState('');
  const [toastSettings, setToastSettings] = useState({
    allowOverdueDebts: true,
    allowSystemAdmin: true,
    allowDirectMessages: true,
    allowGroupChats: true,
  });

  // Load saved toast settings
  useEffect(() => {
    const saved = localStorage.getItem('toast_notification_settings');
    if (saved) {
      try {
        setToastSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading toast settings', e);
      }
    }
  }, []);

  // Sync toast settings with localStorage
  const handleSaveToastSettings = (newSettings: typeof toastSettings) => {
    setToastSettings(newSettings);
    localStorage.setItem('toast_notification_settings', JSON.stringify(newSettings));
  };

  // Clear selection when active chat changes
  useEffect(() => {
    setSelectedMessageIds([]);
  }, [selectedChatId]);

  // Call timer ref
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notifications, selectedChatId, showChatPaneMobile]);

  // Handle call timer
  useEffect(() => {
    if (activeCall && activeCall.status === 'connected') {
      callTimerRef.current = setInterval(() => {
        setActiveCall(prev => {
          if (prev && prev.status === 'connected') {
            return { ...prev, duration: prev.duration + 1 };
          }
          return prev;
        });
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [activeCall?.status]);

  // Generate selectable list of chats (both group rooms and private users)
  const getChatList = (): ChatListItem[] => {
    const list: ChatListItem[] = [];

    // Colors list for avatars
    const colors = [
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-rose-500 to-orange-500',
      'from-amber-500 to-yellow-600',
      'from-sky-500 to-blue-600'
    ];

    // 1. Group Chat: Broadcast to all users (accessible to everyone)
    const allUsersMsgs = notifications.filter(n => n.receiverId === 'all-users');
    const lastAllUsersMsg = allUsersMsgs[0]; // notifications are pre-sorted desc in storage
    const unreadAllUsersCount = allUsersMsgs.filter(n => n.senderId !== currentUser.id && !n.read).length;

    list.push({
      id: 'all-users',
      name: 'مجموعة الموظفين والمشغلين',
      subtitle: 'مجموعة عامة لكافة مستخدمي النظام',
      role: 'group',
      isGroup: true,
      avatarColor: 'from-emerald-500 to-green-600',
      lastMessage: lastAllUsersMsg ? lastAllUsersMsg.message : 'أهلاً بكم في دردشة النظام العامة',
      lastMessageDate: lastAllUsersMsg ? lastAllUsersMsg.date : undefined,
      unreadCount: unreadAllUsersCount
    });

    // 2. Group Chat: Broadcast to all admins (accessible if admin or operator)
    if (currentUser.role === 'admin' || currentUser.role === 'operator') {
      const allAdminsMsgs = notifications.filter(n => n.receiverId === 'all-admins');
      const lastAllAdminsMsg = allAdminsMsgs[0];
      const unreadAllAdminsCount = allAdminsMsgs.filter(n => n.senderId !== currentUser.id && !n.read).length;

      list.push({
        id: 'all-admins',
        name: 'غرفة إدارة النظام 🛡️',
        subtitle: 'مجموعة تواصل للمدراء والمشرفين فقط',
        role: 'group',
        isGroup: true,
        avatarColor: 'from-rose-500 to-red-600',
        lastMessage: lastAllAdminsMsg ? lastAllAdminsMsg.message : 'نقاشات إدارية وتنسيق عام بين المدراء',
        lastMessageDate: lastAllAdminsMsg ? lastAllAdminsMsg.date : undefined,
        unreadCount: unreadAllAdminsCount
      });
    }

    // 3. Private users
    usersList.forEach((user, index) => {
      if (user.id === currentUser.id) return; // omit self

      // Check if current user is allowed to talk to this user:
      // Admins can talk to everyone.
      // Non-admins can only talk to admins.
      const canTalk = currentUser.role === 'admin' || user.role === 'admin';
      if (!canTalk) return;

      // Filter messages between current user and this specific user
      const conversationMsgs = notifications.filter(n => 
        (n.senderId === currentUser.id && n.receiverId === user.id) ||
        (n.senderId === user.id && n.receiverId === currentUser.id)
      );

      const lastMsg = conversationMsgs[0];
      const unreadCount = conversationMsgs.filter(n => n.senderId === user.id && !n.read).length;

      list.push({
        id: user.id,
        name: user.name,
        subtitle: user.role === 'admin' ? 'مدير نظام' : user.role === 'operator' ? 'مشغل / محاسب' : 'مشاهد فقط',
        role: user.role,
        isGroup: false,
        avatarColor: colors[index % colors.length],
        lastMessage: lastMsg ? lastMsg.message : 'لا توجد رسائل سابقة. ابدأ المحادثة الآن!',
        lastMessageDate: lastMsg ? lastMsg.date : undefined,
        unreadCount: unreadCount
      });
    });

    // 4. Guest / External Subscriber (Only visible to admin)
    if (currentUser.role === 'admin') {
      const guestConversationMsgs = notifications.filter(n => 
        (n.senderId === currentUser.id && n.receiverId === 'guest') ||
        (n.senderId === 'guest' && n.receiverId === currentUser.id)
      );

      const lastGuestMsg = guestConversationMsgs[0];
      const unreadGuestCount = guestConversationMsgs.filter(n => n.senderId === 'guest' && !n.read).length;

      list.push({
        id: 'guest',
        name: 'زائر / مشترك خارجي 💬',
        subtitle: 'مراسلة مباشرة من بوابة تسجيل الدخول',
        role: 'viewer',
        isGroup: false,
        avatarColor: 'from-blue-600 to-indigo-600',
        lastMessage: lastGuestMsg ? lastGuestMsg.message : 'لا توجد رسائل سابقة. ابدأ المحادثة الآن!',
        lastMessageDate: lastGuestMsg ? lastGuestMsg.date : undefined,
        unreadCount: unreadGuestCount
      });
    }

    // Apply searches & filters
    return list.filter(item => {
      // Filter query matching
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.lastMessage && item.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Tab/Category Filter
      if (filterType === 'unread') return item.unreadCount > 0;
      if (filterType === 'groups') return item.isGroup;
      if (filterType === 'direct') return !item.isGroup;

      return true;
    }).sort((a, b) => {
      // Sort by last message date if available, else push to bottom
      if (!a.lastMessageDate) return 1;
      if (!b.lastMessageDate) return -1;
      return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
    });
  };

  const chats = getChatList();

  // Set default selected chat if none selected
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Get active selected chat details
  const activeChat = chats.find(c => c.id === selectedChatId) || chats[0];

  // Messages in the active chat
  const getActiveChatMessages = () => {
    if (!activeChat) return [];

    if (activeChat.isGroup) {
      // Group messages
      return notifications
        .filter(n => n.receiverId === activeChat.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      // Private messages between active user and current user
      return notifications
        .filter(n => 
          (n.senderId === currentUser.id && n.receiverId === activeChat.id) ||
          (n.senderId === activeChat.id && n.receiverId === currentUser.id)
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  };

  const activeMessages = getActiveChatMessages();

  // Handle Send Message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !selectedAttachment) return;
    if (!activeChat) return;

    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      receiverId: activeChat.id,
      title: activeChat.isGroup ? `رسالة في ${activeChat.name}` : `رسالة مباشرة من ${currentUser.name}`,
      message: inputMessage.trim() || (selectedAttachment?.type === 'image' ? '📷 صورة مرفقة' : `📁 ملف مرفق: ${selectedAttachment?.name}`),
      date: new Date().toISOString(),
      read: false,
      communicationMethod: connectionMode,
      ...(selectedAttachment && {
        attachmentType: selectedAttachment.type,
        attachmentUrl: selectedAttachment.url,
        attachmentName: selectedAttachment.name,
        attachmentSize: selectedAttachment.size
      })
    };

    onUpdateNotifications([newNotif, ...notifications]);
    setInputMessage('');
    setSelectedAttachment(null);
  };

  // Mark all visible messages in the active chat as read
  useEffect(() => {
    if (!activeChat) return;
    
    // Find unread messages from other senders in this chat
    const hasUnread = notifications.some(n => {
      const isFromOther = n.senderId !== currentUser.id;
      const isForMe = activeChat.isGroup 
        ? n.receiverId === activeChat.id
        : (n.senderId === activeChat.id && n.receiverId === currentUser.id);
      return isFromOther && isForMe && !n.read;
    });

    if (hasUnread) {
      const updated = notifications.map(n => {
        const isFromOther = n.senderId !== currentUser.id;
        const isForMe = activeChat.isGroup 
          ? n.receiverId === activeChat.id
          : (n.senderId === activeChat.id && n.receiverId === currentUser.id);
        
        if (isFromOther && isForMe && !n.read) {
          return { ...n, read: true, readAt: new Date().toISOString() };
        }
        return n;
      });
      onUpdateNotifications(updated);
    }
  }, [selectedChatId, notifications.length]);

  // Calling simulators trigger
  const triggerCall = (type: 'audio' | 'video') => {
    if (!activeChat) return;
    setActiveCall({
      type,
      status: 'ringing',
      chatName: activeChat.name,
      chatId: activeChat.id,
      duration: 0
    });

    // Ring for 2 seconds, then connect
    setTimeout(() => {
      setActiveCall(prev => {
        if (prev && prev.status === 'ringing') {
          return { ...prev, status: 'connected' };
        }
        return prev;
      });
    }, 2000);
  };

  const endCall = () => {
    if (!activeCall) return;

    // Log call as a special notification item in history to represent a real app call!
    const callMinutes = Math.floor(activeCall.duration / 60);
    const callSeconds = activeCall.duration % 60;
    const durationStr = callMinutes > 0 
      ? `${callMinutes} دقيقة و ${callSeconds} ثانية` 
      : `${callSeconds} ثانية`;

    const callRecordMessage = activeCall.type === 'audio'
      ? `📞 مكالمة صوتية صادرة (${activeCall.duration > 0 ? `استمرت لـ ${durationStr}` : 'لم يتم الرد'})`
      : `📹 مكالمة فيديو صادرة (${activeCall.duration > 0 ? `استمرت لـ ${durationStr}` : 'لم يتم الرد'})`;

    const callNotif: Notification = {
      id: `call-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      receiverId: activeCall.chatId,
      title: activeCall.type === 'audio' ? 'مكالمة صوتية' : 'مكالمة فيديو',
      message: callRecordMessage,
      date: new Date().toISOString(),
      read: true
    };

    onUpdateNotifications([callNotif, ...notifications]);
    setActiveCall(null);
    setCallMuted(false);
  };

  // Delete message handler
  const handleDeleteMessage = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    onUpdateNotifications(updated);
  };

  // Toggle single message selection
  const toggleMessageSelection = (id: string) => {
    setSelectedMessageIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(mId => mId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Delete all selected messages for everyone (sender & receiver)
  const handleBulkDeleteMessages = () => {
    if (selectedMessageIds.length === 0) return;
    const updated = notifications.filter(n => !selectedMessageIds.includes(n.id));
    onUpdateNotifications(updated);
    setSelectedMessageIds([]);
    setShowBulkDeleteConfirm(false);
  };

  // Clear chat messages for the active chat
  const handleClearChat = () => {
    if (!activeChat) return;
    
    // Filter out notifications/messages that belong to this chat
    const updated = notifications.filter(n => {
      if (activeChat.isGroup) {
        return n.receiverId !== activeChat.id;
      } else {
        const isFromOtherToMe = (n.senderId === activeChat.id && n.receiverId === currentUser.id);
        const isFromMeToOther = (n.senderId === currentUser.id && n.receiverId === activeChat.id);
        return !(isFromOtherToMe || isFromMeToOther);
      }
    });
    
    onUpdateNotifications(updated);
    setShowClearConfirm(false);
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : '💬';
  };

  // Helper for formatting time
  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, numberingSystem: 'latn' });
    } catch {
      return '';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (d.toDateString() === today.toDateString()) {
        return 'اليوم';
      } else if (d.toDateString() === yesterday.toDateString()) {
        return 'أمس';
      } else {
        return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn' });
      }
    } catch {
      return '';
    }
  };

  return (
    <div id="whatsapp-module" className="relative h-[680px] bg-slate-100/40 rounded-3xl overflow-hidden border border-slate-200/60 shadow-xl flex flex-col font-sans" style={{ direction: 'rtl' }}>
      
      {/* 1. Main Outer Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* RIGHT SIDEBAR: Chat lists */}
        <div className={`w-full md:w-[350px] bg-white border-l border-slate-200 flex flex-col transition-all duration-300 shrink-0 ${
          showChatPaneMobile ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Sidebar Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-600/10">
                {getInitials(currentUser.name)}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">{currentUser.name}</h3>
                <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  متصل الآن
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowToastSettingsModal(true)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-blue-600 transition-all cursor-pointer flex items-center justify-center relative"
                title="تخصيص تنبيهات الإشعارات (Toast)"
              >
                <Sliders className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
              </button>
              <span className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-all cursor-pointer" title="دردشات مشفرة">
                <Lock className="w-4 h-4" />
              </span>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-black border border-emerald-100">
                مراسلة فورية
              </span>
            </div>
          </div>

          {/* Connection Channel Selector */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/60 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-black text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                طريقة الإرسال والاتصال النشطة:
              </span>
              <span className="text-[9.5px] bg-emerald-50 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200/55">
                توجيه فوري
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setConnectionMode('internet')}
                className={`py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  connectionMode === 'internet'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="الاتصال ونقل البيانات عبر شبكة الإنترنت السحابية"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span>الإنترنت</span>
              </button>
              <button
                onClick={() => setConnectionMode('hotspot')}
                className={`py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  connectionMode === 'hotspot'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="الاتصال عبر نقطة اتصال الهواتف المحلية (بدون إنترنت)"
              >
                <Radio className="w-3 h-3 shrink-0" />
                <span>نقطة اتصال</span>
              </button>
              <button
                onClick={() => setConnectionMode('wifidirect')}
                className={`py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  connectionMode === 'wifidirect'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="الاتصال ونقل البيانات عبر WiFi Direct المباشر"
              >
                <Wifi className="w-3 h-3 shrink-0" />
                <span>WiFi Direct</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="p-3 bg-white border-b border-slate-100">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن مستخدم أو كلمة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute top-2.5 right-3.5" />
            </div>
          </div>

          {/* Admin Broadcast Alert Button */}
          {currentUser.role === 'admin' && (
            <div className="p-3 bg-rose-50 border-b border-rose-100 flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setShowUrgentAlertModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-tr from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95"
              >
                <Megaphone className="w-4 h-4" />
                <span>بث تنبيه عاجل للجميع أو لمستخدَم 📢</span>
              </button>
            </div>
          )}

          {/* Chat Category Filters (WhatsApp style) */}
          <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                  : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'unread'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                  : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
              }`}
            >
              غير مقروء
              {notifications.filter(n => n.senderId !== currentUser.id && !n.read).length > 0 && (
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setFilterType('groups')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                filterType === 'groups'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                  : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
              }`}
            >
              المجموعات
            </button>
            <button
              onClick={() => setFilterType('direct')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                filterType === 'direct'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                  : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الخاصة
            </button>
          </div>

          {/* Chat List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {chats.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-black">لا توجد جهات اتصال مطابقة</p>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setShowChatPaneMobile(true);
                  }}
                  className={`w-full p-3.5 flex items-start gap-3 text-right hover:bg-slate-50 transition-all border-r-4 ${
                    selectedChatId === chat.id 
                      ? 'bg-slate-50 border-emerald-500' 
                      : 'border-transparent'
                  }`}
                >
                  {/* Chat Avatar */}
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${chat.avatarColor} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm relative`}>
                    {getInitials(chat.name)}
                    {chat.role === 'admin' && !chat.isGroup && (
                      <span className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-0.5 rounded-full border border-white" title="مدير">
                        🛡️
                      </span>
                    )}
                  </div>

                  {/* Chat Metadata */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate">{chat.name}</h4>
                      {chat.lastMessageDate && (
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">
                          {formatTime(chat.lastMessageDate)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-slate-400 font-bold">{chat.subtitle}</p>
                    
                    <p className={`text-xs truncate font-medium ${chat.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      {chat.lastMessage}
                    </p>
                  </div>

                  {/* Unread & Status Bubble */}
                  {chat.unreadCount > 0 && (
                    <div className="self-center shrink-0 flex items-center justify-center">
                      <span className="px-2 py-0.5 text-[10px] bg-emerald-500 text-white font-black rounded-full shadow-sm shadow-emerald-500/20">
                        {chat.unreadCount}
                      </span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* LEFT CHAT PANEL: Message viewport */}
        <div className={`flex-1 flex flex-col bg-[#efeae2] relative ${
          showChatPaneMobile ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Overlay WhatsApp Background Texture Pattern */}
          <div className="absolute inset-0 opacity-4 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] mix-blend-overlay" />

          {activeChat ? (
            <>
              {/* Chat View Header */}
              <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between z-10 shrink-0 relative shadow-sm">
                
                {/* Contact name & avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setShowChatPaneMobile(false)}
                    className="p-1.5 md:hidden hover:bg-slate-200 rounded-lg text-slate-500 transition-all cursor-pointer ml-1"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeChat.avatarColor} text-white flex items-center justify-center font-black text-sm shadow-sm`}>
                    {getInitials(activeChat.name)}
                  </div>
                  
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-800 truncate flex items-center gap-1.5">
                      {activeChat.name}
                      {activeChat.isGroup && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] rounded-md font-extrabold border border-emerald-100">مجموعة</span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-extrabold truncate flex items-center gap-1.5 flex-wrap">
                      <span>{activeChat.isGroup ? 'مجموعة تواصل مفتوحة' : 'نشط الآن في نظام المراسلة'}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-black flex items-center gap-0.5 ${
                        connectionMode === 'internet' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40' 
                          : connectionMode === 'hotspot'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/40'
                            : 'bg-blue-50 text-blue-700 border border-blue-200/40'
                      }`}>
                        {connectionMode === 'internet' ? (
                          <>
                            <Globe className="w-2.5 h-2.5" />
                            <span>إنترنت</span>
                          </>
                        ) : connectionMode === 'hotspot' ? (
                          <>
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            <span>نقطة اتصال</span>
                          </>
                        ) : (
                          <>
                            <Wifi className="w-2.5 h-2.5 animate-pulse" />
                            <span>WiFi Direct</span>
                          </>
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Calling Controls & Header Options */}
                <div className="flex items-center gap-1.5">
                  {!activeChat.isGroup && (
                    <>
                      {/* Audio Call */}
                      <button
                        onClick={() => triggerCall('audio')}
                        className="p-2 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-xl transition-all cursor-pointer"
                        title="مكالمة صوتية"
                      >
                        <Phone className="w-4 h-4 sm:w-5 h-5" />
                      </button>

                      {/* Video Call */}
                      <button
                        onClick={() => triggerCall('video')}
                        className="p-2 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-xl transition-all cursor-pointer"
                        title="مكالمة فيديو مرئية"
                      >
                        <Video className="w-4 h-4 sm:w-5 h-5" />
                      </button>
                    </>
                  )}

                  <span className="h-6 w-px bg-slate-200 mx-1" />

                  {/* Clear Chat Button */}
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 sm:p-2 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs font-black border border-transparent hover:border-rose-200"
                    title="مسح محتوى هذه الدردشة بالكامل"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="hidden sm:inline">مسح الدردشة</span>
                  </button>

                  <span className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                  {/* Security/Encryption Fingerprint Verification */}
                  <button
                    type="button"
                    onClick={() => setShowEncryptionVerifyModal(true)}
                    className="p-1.5 sm:p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[11px] sm:text-xs font-black border border-transparent hover:border-emerald-200"
                    title="التحقق من التشفير التام ومطابقة المفاتيح الأمنية"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">مشفر بالكامل (E2EE)</span>
                  </button>
                </div>
              </div>

              {/* Chat Thread / Messages View */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 flex flex-col">
                
                {/* Secure Notice */}
                <div className="mx-auto my-2 max-w-sm text-center">
                  <div className="bg-amber-50/90 backdrop-blur-sm text-[10px] sm:text-xs text-amber-800 border border-amber-100 p-2.5 rounded-xl shadow-sm inline-flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>الرسائل والمكالمات في هذه الدردشة مشفرة ومحفوظة محلياً على هذا النظام.</span>
                  </div>
                </div>

                {activeMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 my-12">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-3 text-slate-300">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-black text-slate-600">ابدأ المحادثة الآن مع {activeChat.name}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-1">اكتب رسالتك بالأسفل واضغط إرسال</p>
                  </div>
                ) : (
                  activeMessages.map((msg, index) => {
                    const isOwn = msg.senderId === currentUser.id;
                    
                    // Group messages can show the sender's name above the bubble if it's not own
                    const showSenderName = activeChat.isGroup && !isOwn;
                    
                    // Show date separator if date changed
                    const showDateSeparator = index === 0 || 
                      new Date(activeMessages[index - 1].date).toDateString() !== new Date(msg.date).toDateString();

                    // Detect if this is a logged call record
                    const isCallRecord = msg.message.includes('📞') || msg.message.includes('📹');

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSeparator && (
                          <div className="mx-auto my-3">
                            <span className="bg-slate-200/85 backdrop-blur-sm text-slate-600 text-[10px] sm:text-xs font-black px-3.5 py-1 rounded-full shadow-sm">
                              {formatDateLabel(msg.date)}
                            </span>
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                          isOwn ? 'self-start mr-auto' : 'self-end ml-auto'
                        }`}>
                          {/* Chat bubble body */}
                          <div 
                            onClick={() => toggleMessageSelection(msg.id)}
                            className={`group p-3 rounded-2xl shadow-sm relative border cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 select-none ${
                              selectedMessageIds.includes(msg.id)
                                ? 'ring-2 ring-blue-500 bg-blue-50/80 border-blue-300 shadow-blue-100/30 text-slate-800'
                                : isOwn 
                                  ? 'bg-[#d9fdd3] border-[#c0ebd0] rounded-tr-none text-slate-800 hover:bg-[#cfe8c9]' 
                                  : isCallRecord
                                    ? 'bg-amber-50/90 border-amber-200/60 rounded-tl-none text-amber-900 hover:bg-amber-100/60'
                                    : 'bg-white border-slate-200/40 rounded-tl-none text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {/* Checkbox indicator */}
                            {selectedMessageIds.includes(msg.id) ? (
                              <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white rounded-full p-0.5 shadow-md border border-white z-20 animate-bounce">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="absolute -top-1.5 -right-1.5 bg-slate-100 text-slate-400 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity border border-slate-200 shadow-sm z-20">
                                <div className="w-3 h-3 rounded-full border border-slate-300" />
                              </div>
                            )}
                            
                            {/* Group sender name */}
                            {showSenderName && (
                              <p className="text-[11px] font-black text-emerald-600 mb-1">
                                {msg.senderName} ({msg.senderRole === 'admin' ? 'مدير' : 'مشغل'})
                              </p>
                            )}

                            {/* Message text content */}
                            <div className="text-xs sm:text-sm font-semibold leading-relaxed whitespace-pre-wrap pb-2">
                              {msg.attachmentType === 'image' && msg.attachmentUrl && (
                                <div className="mb-2 max-w-xs overflow-hidden rounded-xl border border-slate-200/50 relative group/img bg-slate-50">
                                  <img
                                    src={msg.attachmentUrl}
                                    alt={msg.attachmentName || "صورة مرفقة"}
                                    className="max-h-52 w-full object-cover hover:scale-105 transition-all duration-300 rounded-xl"
                                    referrerPolicy="no-referrer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImageUrl(msg.attachmentUrl || null);
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-black">
                                    انقر للتكبير 🔍
                                  </div>
                                </div>
                              )}

                              {msg.attachmentType === 'audio' && msg.attachmentUrl && (
                                <div className="mb-2">
                                  <VoiceMessagePlayer url={msg.attachmentUrl} duration={msg.audioDuration} />
                                </div>
                              )}

                              {msg.attachmentType === 'file' && msg.attachmentUrl && (
                                <div className="mb-2 p-2.5 bg-slate-100/90 rounded-xl border border-slate-200/40 flex items-center justify-between gap-3 max-w-[280px]">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                      <FileIcon className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="text-right min-w-0">
                                      <p className="text-xs font-black text-slate-800 truncate" title={msg.attachmentName}>
                                        {msg.attachmentName}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5">
                                        {msg.attachmentSize || 'ملف'}
                                      </p>
                                    </div>
                                  </div>
                                  <a
                                    href={msg.attachmentUrl}
                                    download={msg.attachmentName || "file"}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 flex items-center justify-center transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                                    title="تحميل الملف"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              )}

                              {/* Only render text if it is not the default fallback when we have attachments */}
                              {!(msg.attachmentType === 'image' && msg.message === '📷 صورة مرفقة') && 
                               !(msg.attachmentType === 'file' && msg.message.startsWith('📁 ملف مرفق:')) && (
                                <div>{msg.message}</div>
                              )}
                            </div>

                             {/* Footer time & delivery ticks */}
                            <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 font-bold mt-1">
                              {msg.communicationMethod ? (
                                <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[8px] font-black ${
                                  msg.communicationMethod === 'internet' 
                                    ? 'bg-emerald-50 text-emerald-700/80' 
                                    : msg.communicationMethod === 'hotspot'
                                      ? 'bg-amber-50 text-amber-700/80'
                                      : 'bg-blue-50 text-blue-700/80'
                                }`}>
                                  {msg.communicationMethod === 'internet' ? (
                                    <>
                                      <Globe className="w-2.5 h-2.5" />
                                      <span>إنترنت</span>
                                    </>
                                  ) : msg.communicationMethod === 'hotspot' ? (
                                    <>
                                      <Radio className="w-2.5 h-2.5" />
                                      <span>نقطة اتصال</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wifi className="w-2.5 h-2.5 animate-pulse" />
                                      <span>WiFi Direct</span>
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[8px] font-black bg-emerald-50 text-emerald-700/80">
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>إنترنت</span>
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                {isOwn && msg.read && (
                                  <span 
                                    className="text-[8px] text-blue-600 font-black bg-blue-50/80 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-all duration-300"
                                    title={`تمت القراءة في: ${msg.readAt ? formatDateLabel(msg.readAt) + ' ' + formatTime(msg.readAt) : ''}`}
                                  >
                                    <span>قُرئت</span>
                                    <span>{formatTime(msg.readAt || msg.date)}</span>
                                  </span>
                                )}
                                <span>{formatTime(msg.date)}</span>
                                {isOwn && (
                                  msg.read ? (
                                    <CheckCheck 
                                      className="w-3.5 h-3.5 text-blue-500" 
                                      title={`تمت القراءة في: ${msg.readAt ? formatDateLabel(msg.readAt) + ' ' + formatTime(msg.readAt) : ''}`} 
                                    />
                                  ) : (
                                    <Check 
                                      className="w-3.5 h-3.5 text-slate-400" 
                                      title="تم الإرسال (لم تُقرأ بعد)" 
                                    />
                                  )
                                )}
                              </div>
                            </div>

                             {/* Delete single message option (Sender-restricted, deletes for everyone) */}
                            {(isOwn || currentUser.role === 'admin') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMessageIdToDelete(msg.id);
                                }}
                                className="absolute top-1.5 left-1.5 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-30 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer focus:opacity-100 duration-200 z-10"
                                title="حذف الرسالة لدى الجميع (كأنها لم تُرسل)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Floating selection bar */}
              <AnimatePresence>
                {selectedMessageIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="absolute bottom-[72px] left-4 right-4 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-4 z-40 border border-slate-800"
                    style={{ direction: 'rtl' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/25 text-blue-400 flex items-center justify-center font-black text-sm">
                        {selectedMessageIds.length}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-white">الرسائل المحددة</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-0.5">سيتم حذف الرسائل المحددة من جهازك وجهاز الطرف الآخر.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف المحدّد</span>
                      </button>
                      <button
                        onClick={() => setSelectedMessageIds([])}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat Send Input Box */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 z-10 shrink-0 relative flex flex-col gap-2">
                {/* Hidden File Inputs */}
                <input 
                  type="file" 
                  ref={imageInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, 'image')} 
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="*" 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, 'file')} 
                />

                {/* Attachment Preview Panel */}
                <AnimatePresence>
                  {selectedAttachment && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-4 shadow-sm"
                      style={{ direction: 'rtl' }}
                    >
                      <div className="flex items-center gap-3">
                        {selectedAttachment.type === 'image' ? (
                          <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 relative bg-slate-50">
                            <img 
                              src={selectedAttachment.url} 
                              alt="preview" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <FileIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-800 max-w-[200px] truncate">{selectedAttachment.name}</p>
                          <p className="text-[10px] text-slate-500 font-extrabold mt-0.5">{selectedAttachment.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAttachment(null)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer active:scale-90"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Main Send Form / Recording Controls */}
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    /* Active Audio Recording UI */
                    <div 
                      className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2 shadow-inner"
                      style={{ direction: 'rtl' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                        </span>
                        <span className="text-xs font-black text-rose-800">جاري تسجيل مقطع صوتي...</span>
                        <span className="text-xs font-mono font-bold text-rose-600">
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60) < 10 ? '0' : ''}{recordingTime % 60}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Cancel Recording */}
                        <button
                          type="button"
                          onClick={() => stopRecording(false)}
                          className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>إلغاء</span>
                        </button>
                        
                        {/* Save and Send Recording */}
                        <button
                          type="button"
                          onClick={() => stopRecording(true)}
                          className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md shadow-emerald-600/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>إرسال</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Send Input Form */
                    <>
                      <form 
                        onSubmit={handleSendMessage}
                        className="flex-1 flex items-center bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-inner gap-2"
                      >
                        {/* Emoji / Flowers menu */}
                        <button
                          type="button"
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all shrink-0 cursor-pointer"
                          onClick={() => setInputMessage(prev => prev + '🌹 ')}
                          title="أرسل زهرة ترحيب"
                        >
                          <Smile className="w-5 h-5" />
                        </button>

                        {/* Attach Image button */}
                        <button
                          type="button"
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all shrink-0 cursor-pointer"
                          onClick={() => imageInputRef.current?.click()}
                          title="إرفاق صورة"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>

                        {/* Attach File button */}
                        <button
                          type="button"
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all shrink-0 cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                          title="إرفاق ملف"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>

                        {/* Input box */}
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder="اكتب رسالتك للمستخدم هنا..."
                          className="flex-1 px-2 py-1 text-xs sm:text-sm font-semibold text-slate-700 bg-transparent focus:outline-none placeholder:text-slate-400"
                        />

                        {/* Mic Record Button */}
                        <button
                          type="button"
                          className="p-1.5 hover:bg-blue-50 text-blue-500 hover:text-blue-700 rounded-full transition-all shrink-0 cursor-pointer"
                          onClick={startRecording}
                          title="تسجيل رسالة صوتية فورا"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      </form>

                      {/* Send Button */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={!inputMessage.trim() && !selectedAttachment}
                        className={`w-11 h-11 rounded-full text-white flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0 cursor-pointer ${
                          inputMessage.trim() || selectedAttachment
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                            : 'bg-slate-300 text-slate-100 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-5 h-5 rotate-180" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* WhatsApp Welcome Layout (When no active chat is selected) */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f0f2f5]/60 z-10">
              <div className="max-w-md space-y-6">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md border border-emerald-100">
                  <Bell className="w-12 h-12 animate-bounce" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800">تطبيق مراسلة نظام العدادات الرئيسي</h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-semibold leading-relaxed">
                    أرسل واستقبل الرسائل والتعميمات والإشعارات بشكل فوري وشخصي. يمكنك أيضاً إجراء مكالمات تجريبية وتوجيه فريق العمل مباشرة.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/50 shadow-sm flex items-center gap-3 text-right">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-700">تشفير وحفظ البيانات محلياً</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      يتم تخزين كافة سجلات المحادثة بأمان تام على متصفحك لضمان سرعة الوصول والخصوصية.
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-extrabold flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  اختر أي محادثة أو مجموعة من القائمة الجانبية لبدء التواصل الفوري
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- CALL INTERFACE OVERLAY SIMULATOR --- */}
      <AnimatePresence>
        {activeCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-between p-8 text-white font-sans"
            style={{ direction: 'rtl' }}
          >
            {/* Call Header */}
            <div className="text-center space-y-1 flex flex-col items-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-black mb-1 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{activeCall.type === 'audio' ? 'مكالمة صوتية مشفرة (E2EE)' : 'مكالمة فيديو مشفرة (E2EE)'}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/5 text-slate-300 rounded-lg text-[10px] font-bold mb-3 border border-white/5">
                {connectionMode === 'internet' ? <Globe className="w-3 h-3 text-emerald-400 shrink-0" /> : connectionMode === 'hotspot' ? <Radio className="w-3 h-3 text-amber-400 shrink-0" /> : <Wifi className="w-3 h-3 text-blue-400 shrink-0" />}
                <span>عبر: {connectionMode === 'internet' ? 'الإنترنت السحابي' : connectionMode === 'hotspot' ? 'نقطة الاتصال (Hotspot)' : 'WiFi Direct لاسلكي'}</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-black">{activeCall.chatName}</h2>
              <p className="text-xs sm:text-sm text-slate-400 font-extrabold flex items-center gap-1.5 justify-center">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                {activeCall.status === 'ringing' ? 'جاري الاتصال وإنشاء قناة مشفرة...' : 'اتصال آمن ومُشفّر بنجاح'}
              </p>
            </div>

            {/* Calling Body: Pulsing circle/avatar/camera preview */}
            <div className="flex-1 flex flex-col items-center justify-center relative w-full max-w-sm">
              {activeCall.type === 'video' && activeCall.status === 'connected' ? (
                /* Video call mockup */
                <div className="w-full h-64 bg-slate-800 rounded-2xl overflow-hidden relative border border-white/10 flex items-center justify-center shadow-2xl">
                  {/* Camera view container */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-emerald-950 flex flex-col items-center justify-center gap-3">
                    <Camera className="w-12 h-12 text-emerald-400 animate-pulse" />
                    <span className="text-xs text-slate-300 font-bold">جاري بث فيديو مُؤمن ومُشفّر...</span>
                  </div>
                  
                  {/* Miniature local preview window */}
                  <div className="absolute bottom-3 left-3 w-20 h-28 bg-slate-950 border border-white/20 rounded-lg flex items-center justify-center overflow-hidden">
                    <User className="w-6 h-6 text-slate-600" />
                  </div>
                </div>
              ) : (
                /* Audio call pulsing avatar */
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <div className="absolute -inset-4 rounded-full bg-emerald-500/10 animate-pulse" />
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center font-black text-2xl relative border-4 border-white/10 shadow-2xl">
                    {getInitials(activeCall.chatName)}
                  </div>
                </div>
              )}

              {/* Connected timer counter */}
              {activeCall.status === 'connected' && (
                <p className="text-base font-mono font-black tracking-widest text-emerald-400 mt-6">
                  {Math.floor(activeCall.duration / 60).toString().padStart(2, '0')}:
                  {(activeCall.duration % 60).toString().padStart(2, '0')}
                </p>
              )}

              {/* Dynamic encryption status specs */}
              <div className="mt-6 bg-white/5 border border-white/10 p-4 rounded-2xl w-full text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-extrabold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تشفير تام بين الطرفين (End-to-End Encrypted)</span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  خوارزمية الحماية: <span className="font-mono text-white">{selectedEncryptionAlgorithm}</span> • تبادل المفاتيح: <span className="font-mono text-white">Curve25519 (ECDH)</span>
                </p>
                <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold bg-black/40 px-2.5 py-1 rounded-lg">
                    <Key className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>مفتاح الجلسة النشط:</span>
                    <span className="font-mono text-emerald-400/90 select-all tracking-wider text-[8px] sm:text-[9px]">
                      {getEncryptionFingerprint(activeCall.chatId).substring(0, 29)}...
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Action Panel */}
            <div className="w-full max-w-sm flex items-center justify-around gap-4 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
              {/* Mute button */}
              <button
                onClick={() => setCallMuted(!callMuted)}
                className={`p-4 rounded-2xl transition-all cursor-pointer ${
                  callMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={callMuted ? 'إلغاء كتم الصوت' : 'كتم الميكروفون'}
              >
                <MicOff className="w-5 h-5" />
              </button>

              {/* Hangup Red button */}
              <button
                onClick={endCall}
                className="w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-rose-600/30 active:scale-90 cursor-pointer"
                title="إنهاء المكالمة"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              {/* Speaker / Volume toggle */}
              <button
                onClick={() => setCallSpeaker(!callSpeaker)}
                className={`p-4 rounded-2xl transition-all cursor-pointer ${
                  !callSpeaker ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="مستوى الصوت ومكبر الصوت"
              >
                {callSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4"
              style={{ direction: 'rtl' }}
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-800">مسح محتوى الدردشة؟</h3>
                <p className="text-xs text-slate-500 font-extrabold leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف كافة الرسائل وسجل المحادثة مع <span className="text-slate-800 font-black">{activeChat?.name}</span>؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearChat}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95"
                >
                  نعم، امسح كل شيء
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Encryption Key & Fingerprint Verification Modal */}
      <AnimatePresence>
        {showEncryptionVerifyModal && activeChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-100 shadow-2xl space-y-6"
              style={{ direction: 'rtl' }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">مطابقة رمز الأمان المشفر</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bold">تشفير تام من الطرف الأول للطرف الثاني (E2EE)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEncryptionVerifyModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QR Code and fingerprint */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Styled SVG QR Code Mockup representing secure key */}
                <div className="w-32 h-32 bg-slate-50 border border-slate-200/60 rounded-2xl p-2.5 flex flex-col items-center justify-center shrink-0 relative group">
                  <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                  <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="5" y="5" width="25" height="25" />
                    <rect x="10" y="10" width="15" height="15" fill="white" />
                    <rect x="13" y="13" width="9" height="9" />

                    <rect x="70" y="5" width="25" height="25" />
                    <rect x="75" y="10" width="15" height="15" fill="white" />
                    <rect x="78" y="13" width="9" height="9" />

                    <rect x="5" y="70" width="25" height="25" />
                    <rect x="10" y="75" width="15" height="15" fill="white" />
                    <rect x="13" y="78" width="9" height="9" />

                    <rect x="40" y="10" width="10" height="5" />
                    <rect x="45" y="20" width="5" height="15" />
                    <rect x="55" y="15" width="10" height="5" />
                    <rect x="35" y="35" width="15" height="5" />
                    <rect x="55" y="30" width="10" height="15" />
                    <rect x="40" y="50" width="20" height="5" />
                    <rect x="35" y="60" width="5" height="20" />
                    <rect x="45" y="65" width="15" height="5" />
                    <rect x="70" y="45" width="10" height="10" />
                    <rect x="85" y="40" width="10" height="5" />
                    <rect x="80" y="55" width="5" height="15" />
                    <rect x="70" y="75" width="15" height="5" />
                    <rect x="75" y="85" width="15" height="10" />
                    <rect x="45" y="80" width="10" height="10" />
                  </svg>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full shadow border border-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex-1 space-y-3 text-right">
                  <h4 className="text-xs font-black text-slate-700">رقم البصمة الأمنية المتبادل</h4>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                    قارن الأرقام الظاهرة في الأسفل أو امسح الرمز مع <span className="font-black text-slate-800">{activeChat.name}</span> للتأكد من أن الرسائل والمكالمات (الصوتية والمرئية) مشفرة ومؤمنة بالكامل ببروتوكول <span className="font-mono text-emerald-600 font-extrabold">{selectedEncryptionAlgorithm}</span>.
                  </p>
                  
                  {/* Select algorithm */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-extrabold">بروتوكول التشفير المعتمد:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedEncryptionAlgorithm('AES-GCM-256')}
                      className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                        selectedEncryptionAlgorithm === 'AES-GCM-256'
                          ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      AES-GCM-256
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEncryptionAlgorithm('ChaCha20-Poly1305')}
                      className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                        selectedEncryptionAlgorithm === 'ChaCha20-Poly1305'
                          ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      ChaCha20
                    </button>
                  </div>
                </div>
              </div>

              {/* Fingerprint block groups */}
              <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl relative">
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/80 border border-slate-200/50 px-2 py-0.5 rounded text-[9px] text-slate-400 font-mono">
                  <Cpu className="w-3 h-3 text-slate-500" />
                  <span>ECDH_Curve25519</span>
                </div>
                <p className="text-xs text-slate-400 font-bold mb-3 block">بصمة التشفير الثنائية الفريدة:</p>
                
                {/* Grid of the 12 fingerprint numbers */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs sm:text-sm font-extrabold text-slate-700 tracking-wider">
                  {getEncryptionFingerprint(activeChat.id).split(' ').map((block, idx) => (
                    <div key={idx} className="bg-white border border-slate-200/40 py-2 rounded-xl shadow-sm hover:border-emerald-200 hover:bg-emerald-50/10 transition-all select-all">
                      {block}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold flex items-start gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100/60 leading-relaxed">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  نظام التشفير التام يضمن عدم مقدرة أي طرف ثالث، بما في ذلك خوادم الاستضافة أو مزودي الشبكة، على اعتراض أو قراءة رسائلكم النصية، ملفاتكم المرفقة، أو التنصت على المكالمات الصوتية والمرئية الجارية.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowEncryptionVerifyModal(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-md shadow-emerald-600/10 active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4.5 h-4.5" />
                <span>تم تأكيد ومطابقة المفتاح الأمني</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Single Message Confirmation Modal (Sender & Receiver) */}
      <AnimatePresence>
        {messageIdToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4"
              style={{ direction: 'rtl' }}
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-800">حذف الرسالة للجميع؟</h3>
                <p className="text-xs text-slate-500 font-extrabold leading-relaxed">
                  هل ترغب في حذف هذه الرسالة من <span className="text-slate-800 font-black">جهازك وجهاز المستقبل</span> كأنها لم تُرسل أبداً؟
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleDeleteMessage(messageIdToDelete);
                    setMessageIdToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95"
                >
                  حذف للجميع
                </button>
                <button
                  onClick={() => setMessageIdToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Multiple Messages Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4"
              style={{ direction: 'rtl' }}
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-800">حذف الرسائل المحددة؟</h3>
                <p className="text-xs text-slate-500 font-extrabold leading-relaxed">
                  هل ترغب بالتأكيد في حذف عدد <span className="text-rose-600 font-black">({selectedMessageIds.length})</span> من الرسائل المحددة من <span className="text-slate-800 font-black">جهازك وجهاز الطرف الآخر</span> نهائياً؟
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkDeleteMessages}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95"
                >
                  نعم، احذف للجميع
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification Settings Modal */}
      <AnimatePresence>
        {showToastSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-6"
              style={{ direction: 'rtl' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 text-right">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">تخصيص تنبيهات الـ Toast</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">تحكم بالإشعارات المنبثقة التي تظهر فوراً</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowToastSettingsModal(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Settings Controls */}
              <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                {/* 1. Overdue debts */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-800">تنبيهات الديون المتأخرة والذمم</p>
                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5 leading-relaxed">
                        فواتير معلقة، مبالغ متأخرة السداد، ومطالبات التحصيل المالي.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveToastSettings({
                      ...toastSettings,
                      allowOverdueDebts: !toastSettings.allowOverdueDebts
                    })}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative shrink-0 ${
                      toastSettings.allowOverdueDebts ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      toastSettings.allowOverdueDebts ? 'translate-x-[-20px]' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* 2. System and Admin */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-800">التنبيهات الإدارية وتحديثات النظام</p>
                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5 leading-relaxed">
                        الدردشة الإدارية، تحديث صلاحيات المستخدمين، والنسخ الاحتياطي.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveToastSettings({
                      ...toastSettings,
                      allowSystemAdmin: !toastSettings.allowSystemAdmin
                    })}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative shrink-0 ${
                      toastSettings.allowSystemAdmin ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      toastSettings.allowSystemAdmin ? 'translate-x-[-20px]' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* 3. Direct messages */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-800">المراسلات والرسائل المباشرة</p>
                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5 leading-relaxed">
                        الرسائل الخاصة والدردشة الثنائية المباشرة بينك وبين الزملاء.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveToastSettings({
                      ...toastSettings,
                      allowDirectMessages: !toastSettings.allowDirectMessages
                    })}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative shrink-0 ${
                      toastSettings.allowDirectMessages ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      toastSettings.allowDirectMessages ? 'translate-x-[-20px]' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* 4. Group chats */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-800">محادثات الغرف والمجموعات</p>
                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5 leading-relaxed">
                        رسائل المجموعات العامة مثل مجموعة الموظفين والمشغلين.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveToastSettings({
                      ...toastSettings,
                      allowGroupChats: !toastSettings.allowGroupChats
                    })}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative shrink-0 ${
                      toastSettings.allowGroupChats ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      toastSettings.allowGroupChats ? 'translate-x-[-20px]' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Interactive Sandbox - Testing Alerts */}
              <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100/60 space-y-2.5 text-right">
                <div className="flex items-center gap-1.5 text-blue-800 font-black text-xs">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                  <span>محاكاة استقبال التنبيهات الفورية</span>
                </div>
                <p className="text-[10px] text-slate-500 font-extrabold leading-normal">
                  انقر لاختبار استقبال تنبيه فوري ومراقبة مدى فاعلية تصفية الفلتر (إذا عطلت نوعاً، فلن يظهر كتنبيه Toast).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const testId = `test-debt-${Date.now()}`;
                      const testNotif: Notification = {
                        id: testId,
                        senderId: 'system-bot',
                        senderName: 'نظام الذمم والديون 🪙',
                        senderRole: 'admin',
                        receiverId: currentUser.id,
                        title: 'تنبيه دين متأخر مستحق',
                        message: 'يرجى العلم بوجود ذمة مالية معلقة بقيمة 150$ تجاوزت تاريخ الاستحقاق الفعلي.',
                        date: new Date().toISOString(),
                        read: false
                      };
                      onUpdateNotifications([testNotif, ...notifications]);
                      setShowToastSettingsModal(false);
                    }}
                    className="py-1.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 text-center cursor-pointer"
                  >
                    🪙 تنبيه دين متأخر
                  </button>
                  <button
                    onClick={() => {
                      const testId = `test-admin-${Date.now()}`;
                      const testNotif: Notification = {
                        id: testId,
                        senderId: 'user-admin',
                        senderName: 'مدير النظام 🛡️',
                        senderRole: 'admin',
                        receiverId: currentUser.id,
                        title: 'تنبيه إداري: ترقية الصلاحيات',
                        message: 'لقد تم تحديث وتخصيص إعدادات تصفية إشعارات الـ Toast بنجاح في جهازك.',
                        date: new Date().toISOString(),
                        read: false
                      };
                      onUpdateNotifications([testNotif, ...notifications]);
                      setShowToastSettingsModal(false);
                    }}
                    className="py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-800 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 text-center cursor-pointer"
                  >
                    🛡️ تنبيه إداري للنظام
                  </button>
                  <button
                    onClick={() => {
                      const testId = `test-direct-${Date.now()}`;
                      const testNotif: Notification = {
                        id: testId,
                        senderId: 'user-operator',
                        senderName: 'المحاسب المالي 💬',
                        senderRole: 'operator',
                        receiverId: currentUser.id,
                        title: 'رسالة مباشرة من المحاسب المالي',
                        message: 'مرحباً، هل قمت بمراجعة العدادات الفرعية لشهر يونيو؟ أحتاج الكشف المحدث.',
                        date: new Date().toISOString(),
                        read: false
                      };
                      onUpdateNotifications([testNotif, ...notifications]);
                      setShowToastSettingsModal(false);
                    }}
                    className="py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 text-center cursor-pointer"
                  >
                    💬 رسالة خاصة ثنائية
                  </button>
                  <button
                    onClick={() => {
                      const testId = `test-group-${Date.now()}`;
                      const testNotif: Notification = {
                        id: testId,
                        senderId: 'user-operator',
                        senderName: 'غرفة النقاش العام 👥',
                        senderRole: 'operator',
                        receiverId: 'all-users',
                        title: 'رسالة في مجموعة الموظفين والمشغلين',
                        message: 'تم فتح باب الملاحظات على التقرير المالي الجديد للعداد الرئيسي.',
                        date: new Date().toISOString(),
                        read: false
                      };
                      onUpdateNotifications([testNotif, ...notifications]);
                      setShowToastSettingsModal(false);
                    }}
                    className="py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 text-center cursor-pointer"
                  >
                    👥 رسالة في مجموعة
                  </button>
                </div>
              </div>

              {/* Footer Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowToastSettingsModal(false)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  حفظ وتأكيد التغييرات
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Screen Image Preview Modal */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={previewImageUrl}
              alt="High resolution preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 text-white/70 text-xs font-semibold bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
              انقر في أي مكان خارج الصورة للإغلاق
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- URGENT ALERT BROADCAST MODAL --- */}
      <AnimatePresence>
        {showUrgentAlertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-5 text-right"
              style={{ direction: 'rtl' }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">بث وإرسال تنبيه عاجل</h3>
                    <p className="text-[10px] text-slate-400 font-bold">يرسل فوراً كشاشة منبثقة بتنبيه صوتي</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUrgentAlertModal(false)}
                  className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Recipient Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600">اختر المستلم المستهدف:</label>
                <select
                  value={urgentAlertRecipient}
                  onChange={(e) => setUrgentAlertRecipient(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-700 focus:outline-none focus:border-rose-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all-users">📢 الجميع (بث عام لكافة المستخدمين والمشتركين)</option>
                  <option value="guest">💬 زائر / مشترك خارجي (بوابة تسجيل الدخول)</option>
                  {usersList
                    .filter((u) => u.id !== currentUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        👤 {u.name} ({u.role === 'admin' ? 'مدير' : u.role === 'operator' ? 'مشغل/محاسب' : 'مشاهد'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Message text */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600">نص التنبيه والرسالة:</label>
                <textarea
                  value={urgentAlertMessage}
                  onChange={(e) => setUrgentAlertMessage(e.target.value)}
                  placeholder="اكتب التنبيه أو الرسالة هنا..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    if (!urgentAlertMessage.trim()) return;
                    
                    const newNotif: Notification = {
                      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      senderId: currentUser.id,
                      senderName: currentUser.name,
                      senderRole: currentUser.role,
                      receiverId: urgentAlertRecipient,
                      title: '📢 تنبيه عاجل من الإدارة',
                      message: urgentAlertMessage.trim(),
                      date: new Date().toISOString(),
                      read: false,
                      communicationMethod: 'internet'
                    };

                    onUpdateNotifications([newNotif, ...notifications]);
                    setUrgentAlertMessage('');
                    setShowUrgentAlertModal(false);
                  }}
                  disabled={!urgentAlertMessage.trim()}
                  className="flex-1 py-3 bg-gradient-to-tr from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  إرسال التنبيه الفوري 🚀
                </button>
                <button
                  onClick={() => setShowUrgentAlertModal(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
