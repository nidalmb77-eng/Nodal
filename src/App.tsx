/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Subscriber, Invoice, Payment, User, Notification, ActivityLog, BillCustomization } from './types';
import {
  getInitialSubscribers,
  getInitialInvoices,
  getInitialPayments,
  saveToLocalStorage,
  calculateSubscriberStats,
  getNotifications,
  saveNotifications,
  getInitialActivityLogs,
  logSystemActivity,
  uploadToGoogleDrive,
  exportDataAsJSON,
} from './utils/storage';
import NewInvoiceForm from './components/NewInvoiceForm';
import CompositeInvoiceForm from './components/CompositeInvoiceForm';
import SubscribersList from './components/SubscribersList';
import InvoicesHistory from './components/InvoicesHistory';
import BackupRestore from './components/BackupRestore';
import PaymentsList from './components/PaymentsList';
import Reports from './components/Reports';
import ExpenseManagement from './components/ExpenseManagement';
import GeneralSettings from './components/GeneralSettings';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import Notifications from './components/Notifications';
import GuestChat from './components/GuestChat';
import { getActiveCurrency, getActiveCurrencies, getActivePricePerKwh } from './utils/currency';
import {
  isFirebaseAvailable,
  uploadAllDataToFirebase,
  downloadAllDataFromFirebase
} from './lib/firebase';
import { Shield } from 'lucide-react';
import {
  Zap,
  Users,
  CreditCard,
  TrendingUp,
  Wallet,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  Calculator,
  UserPlus,
  FileSpreadsheet,
  FileText,
  Printer,
  Tags,
  LayoutDashboard,
  Database,
  Settings,
  Coins,
  FileBarChart2,
  Layers,
  Bell,
  Moon,
  Sun,
  MessageSquare,
  X,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_GROUPS = [
  'المجموعة الأولى',
  'المجموعة الثانية',
  'الدور الأرضي',
  'الدور الأول',
  'المحلات التجارية',
];

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin', role: 'admin', name: 'مدير النظام' },
  { id: 'u2', username: 'operator', password: 'operator', role: 'operator', name: 'المحاسب أحمد' },
  { id: 'u3', username: 'viewer', password: 'viewer', role: 'viewer', name: 'المراقب خالد' },
];

// Helper to classify notifications into categories: financial, system, or general
const getNotificationCategory = (n: any): 'financial' | 'general' | 'system' => {
  const title = (n.title || '').toLowerCase();
  const message = (n.message || '').toLowerCase();
  const senderName = (n.senderName || '').toLowerCase();

  // Financial checks: "دين", "مالي", "سداد", "ذمة", "قيمة", "دولار", "دينار", "ش.ج", "₪", "🪙", "دفعة"
  const financialKeywords = ['دين', 'مالي', 'سداد', 'ذمة', 'قيمة', 'دولار', 'دينار', 'ش.ج', '₪', '🪙', 'دفعة', 'فاتورة', 'المستحق'];
  const isFinancial = financialKeywords.some(kw => title.includes(kw) || message.includes(kw) || senderName.includes(kw));
  if (isFinancial) return 'financial';

  // System checks: "إداري", "ترقية", "صلاحيات", "نظام", "تحديث", "شاشة", "الإدارة", "بوابة", "مزامنة", "🛡️", "📢"
  const systemKeywords = ['إداري', 'ترقية', 'صلاحيات', 'نظام', 'تحديث', 'شاشة', 'الإدارة', 'بوابة', 'مزامنة', '🛡️', '📢', 'تنبيه عاجل'];
  const isSystem = systemKeywords.some(kw => title.includes(kw) || message.includes(kw) || senderName.includes(kw));
  if (isSystem) return 'system';

  // Fallback to general
  return 'general';
};

// Helper to play synthesized notification chime (Web Audio API)
const playNotificationSound = (category: 'financial' | 'general' | 'system' = 'general') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Get saved ringtone presets from localStorage
    const savedSettings = localStorage.getItem('notification_sound_settings');
    let soundPreset = 'arpeggio'; // default
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        soundPreset = parsed[category] || (category === 'financial' ? 'double-beep' : category === 'system' ? 'warning' : 'ping');
      } catch (e) {
        // fallback
        soundPreset = category === 'financial' ? 'double-beep' : category === 'system' ? 'warning' : 'ping';
      }
    } else {
      // default presets per category
      if (category === 'financial') soundPreset = 'double-beep';
      else if (category === 'system') soundPreset = 'warning';
      else soundPreset = 'ping';
    }
    
    // Play a delightful high-quality electronic chime
    const playTone = (freq: number, start: number, duration: number, vol: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
      gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    switch (soundPreset) {
      case 'arpeggio': // Quick sweet arpeggio
        playTone(523.25, 0, 0.4, 0.15);      // C5
        playTone(659.25, 0.1, 0.4, 0.15);    // E5
        playTone(783.99, 0.2, 0.5, 0.2);     // G5
        break;
      case 'double-beep': // Two quick coin/financial double chime
        playTone(880.00, 0, 0.12, 0.2);      // A5
        playTone(1046.50, 0.08, 0.22, 0.2);  // C6
        break;
      case 'ping': // Soft elegant single ping
        playTone(659.25, 0, 0.6, 0.2);       // E5
        break;
      case 'warning': // Serious system alert
        playTone(440.00, 0, 0.18, 0.22, 'triangle'); // A4
        playTone(440.00, 0.18, 0.35, 0.22, 'triangle'); // A4
        break;
      case 'melody': // Rising melody
        playTone(392.00, 0, 0.12, 0.12);     // G4
        playTone(440.00, 0.06, 0.12, 0.12);  // A4
        playTone(523.25, 0.12, 0.12, 0.12);  // C5
        playTone(587.33, 0.18, 0.3, 0.18);   // D5
        break;
      case 'sci-fi': { // High tech glide
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.25);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        break;
      }
      default:
        // fallback
        playTone(523.25, 0, 0.4, 0.15);
        playTone(659.25, 0.1, 0.4, 0.15);
        playTone(783.99, 0.2, 0.5, 0.2);
    }
  } catch (e) {
    console.warn('Could not synthesize sound:', e);
  }
};

export default function App() {
  // Dark mode theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('meter_app_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('meter_app_theme', theme);
  }, [theme]);

  // State
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [groupsList, setGroupsList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subscribers' | 'payments' | 'new-invoice' | 'composite-invoice' | 'invoices-history' | 'reports' | 'settings' | 'backup-settings' | 'users' | 'notifications'>('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toast, setToast] = useState<{ id: string; title: string; message: string; senderName: string } | null>(null);
  const seenNotificationIds = React.useRef<Set<string>>(new Set());
  const isInitialLoad = React.useRef(true);

  // Users and login state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guestChatActive, setGuestChatActive] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Global Sync & Online States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAppInitialized, setIsAppInitialized] = useState<boolean>(() => {
    return localStorage.getItem('meter_app_initialized') === 'true';
  });
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'offline-saved' | 'not-connected'>('not-connected');
  const [lastSyncedTime, setLastSyncedTime] = useState(() => {
    return localStorage.getItem('gdrive_last_synced_time') || '';
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('gdrive_auto_sync') === 'true';
  });

  // Currency and Price Settings States
  const [defaultCurrency, setDefaultCurrency] = useState<string>('ش.ج');
  const [currencies, setCurrencies] = useState<string[]>(['ش.ج', 'ر.س', 'دولار']);
  const [defaultPricePerKwh, setDefaultPricePerKwh] = useState<string>('0.5');

  // WhatsApp Reminder Settings States
  const [whatsappReminderEnabled, setWhatsappReminderEnabled] = useState<boolean>(() => {
    return localStorage.getItem('meter_whatsapp_reminder_enabled') === 'true';
  });
  const [whatsappReminderThreshold, setWhatsappReminderThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('meter_whatsapp_reminder_threshold');
    return saved ? parseFloat(saved) : 500;
  });
  const [whatsappReminderTemplate, setWhatsappReminderTemplate] = useState<string>(() => {
    return localStorage.getItem('meter_whatsapp_reminder_template') || 
      'السلام عليكم السيد {name}، نود تذكيركم بأن رصيدكم المستحق للدفع لقاء استهلاك الكهرباء هو {debt} {currency}. يرجى التكرم بالسداد في أقرب وقت. شكراً لكم.';
  });

  // Menu Dropdown states
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<string | null>(null);

  // Floating Action Button and Quick Modals states
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);
  const [quickPaySubId, setQuickPaySubId] = useState('');
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayNotes, setQuickPayNotes] = useState('');
  const [quickPaySearch, setQuickPaySearch] = useState('');
  const [quickPayError, setQuickPayError] = useState('');
  const [quickPaySuccess, setQuickPaySuccess] = useState('');

  // Load initial data on mount
  useEffect(() => {
    setSubscribers(getInitialSubscribers());
    setInvoices(getInitialInvoices());
    setPayments(getInitialPayments());
    
    // Load currency settings
    setDefaultCurrency(getActiveCurrency());
    setCurrencies(getActiveCurrencies());
    setDefaultPricePerKwh(getActivePricePerKwh());

    // Load groups
    const savedGroups = localStorage.getItem('meter_groups_list');
    if (savedGroups) {
      try {
        setGroupsList(JSON.parse(savedGroups));
      } catch (e) {
        setGroupsList(DEFAULT_GROUPS);
      }
    } else {
      setGroupsList(DEFAULT_GROUPS);
      localStorage.setItem('meter_groups_list', JSON.stringify(DEFAULT_GROUPS));
    }

    // Load users list
    const savedUsers = localStorage.getItem('meter_users_list');
    if (savedUsers) {
      try {
        setUsersList(JSON.parse(savedUsers));
      } catch (e) {
        setUsersList(DEFAULT_USERS);
      }
    } else {
      setUsersList(DEFAULT_USERS);
      localStorage.setItem('meter_users_list', JSON.stringify(DEFAULT_USERS));
    }

    // Load current user session
    const savedUser = localStorage.getItem('meter_current_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        setCurrentUser(null);
      }
    }

    // Load notifications
    setNotifications(getNotifications());

    // Load activity logs
    setActivityLogs(getInitialActivityLogs());
  }, []);

  // Asynchronous background trigger to sync all active lists to Firebase Firestore
  const triggerFirebaseSync = async () => {
    const isFirebaseAutoSync = localStorage.getItem('firebase_auto_sync') === 'true';
    if (!isFirebaseAutoSync || !navigator.onLine || !isFirebaseAvailable()) {
      return;
    }

    try {
      await uploadAllDataToFirebase(
        subscribers,
        invoices,
        payments,
        usersList,
        notifications,
        activityLogs,
        groupsList
      );
      const nowString = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
      localStorage.setItem('firebase_last_synced_time', nowString);
    } catch (err) {
      console.error('Firebase Background Auto-Sync failed:', err);
    }
  };

  // Load Firebase data if Firebase Auto-Sync is enabled on mount
  useEffect(() => {
    const loadFirebaseOnStartup = async () => {
      const isFirebaseAutoSync = localStorage.getItem('firebase_auto_sync') === 'true';
      if (isFirebaseAutoSync && navigator.onLine && isFirebaseAvailable()) {
        try {
          const res = await downloadAllDataFromFirebase();
          if (res.success && res.data) {
            const d = res.data;
            if (d.subscribers.length > 0) {
              setSubscribers(d.subscribers);
            }
            if (d.invoices.length > 0) {
              setInvoices(d.invoices);
            }
            if (d.payments.length > 0) {
              setPayments(d.payments);
            }
            if (d.users.length > 0) {
              setUsersList(d.users);
            }
            if (d.notifications.length > 0) {
              setNotifications(d.notifications);
            }
            if (d.activityLogs.length > 0) {
              setActivityLogs(d.activityLogs);
            }
            if (d.groups.length > 0) {
              setGroupsList(d.groups);
            }
            const nowStr = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
            localStorage.setItem('firebase_last_synced_time', nowStr);
          }
        } catch (err) {
          console.error('Firebase Startup Auto-Sync failed:', err);
        }
      }
    };

    loadFirebaseOnStartup();
  }, []);

  // Sync data to LocalStorage and trigger Auto Cloud Sync when states change
  useEffect(() => {
    if (subscribers.length > 0 || invoices.length > 0 || payments.length > 0) {
      saveToLocalStorage(subscribers, invoices, payments);
      
      // If not the very first load, mark as unsynced change and trigger sync
      if (!isInitialLoad.current) {
        localStorage.setItem('meter_unsynced_changes_exist', 'true');
        triggerAutoSync();
        triggerFirebaseSync();
      } else {
        isInitialLoad.current = false;
        // Initial state check for sync status
        updateInitialSyncStatus();
      }
    }
  }, [subscribers, invoices, payments]);

  // Handle first-run internet check on load
  useEffect(() => {
    if (!isAppInitialized && navigator.onLine) {
      localStorage.setItem('meter_app_initialized', 'true');
      setIsAppInitialized(true);
    }
  }, [isAppInitialized]);

  // Monitor network status globally
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);

      // If the app is not initialized, initialize it now!
      if (!isAppInitialized) {
        localStorage.setItem('meter_app_initialized', 'true');
        setIsAppInitialized(true);
        playNotificationSound('general');
      }

      // Automatically push pending offline updates upon reconnecting!
      if (localStorage.getItem('meter_unsynced_changes_exist') === 'true') {
        setToast({
          id: `sync-reconnect-${Date.now()}`,
          title: 'استعادة الاتصال بالإنترنت',
          message: 'تم استعادة الاتصال. جاري رفع التعديلات السابقة وتحديث السحاب تلقائياً...',
          senderName: 'مزامنة السحاب',
        });
        triggerAutoSync(true);
      } else {
        updateInitialSyncStatus();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline-saved');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [subscribers, invoices, payments, isAppInitialized]);

  // Intercept Google Drive Redirect Token (OAuth 2.0 Hash parsing)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('state=gdrive_sync')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');
      if (accessToken) {
        const expiryTime = Date.now() + parseInt(expiresIn || '3600', 10) * 1000;
        localStorage.setItem('gdrive_access_token', accessToken);
        localStorage.setItem('gdrive_token_expiry', expiryTime.toString());
        
        // Clean hash and redirect to BackupRestore tab
        window.history.replaceState(null, '', window.location.pathname);
        setActiveTab('backup-settings');

        setToast({
          id: `sync-connect-${Date.now()}`,
          title: 'بوابة Google Drive السحابية',
          message: 'تم ربط حسابك بنجاح! تم تفعيل الحفظ المزدوج والتزامن التلقائي عند الاتصال.',
          senderName: 'الربط السحابي',
        });

        // Trigger an immediate initial backup sync
        localStorage.setItem('meter_unsynced_changes_exist', 'true');
        setTimeout(() => triggerAutoSync(true), 1500);
      }
    } else {
      updateInitialSyncStatus();
    }
  }, []);

  // Update initial sync status check on load
  const updateInitialSyncStatus = () => {
    const token = localStorage.getItem('gdrive_access_token');
    const expiry = localStorage.getItem('gdrive_token_expiry');
    const isAutoSync = localStorage.getItem('gdrive_auto_sync') === 'true';
    const hasUnsynced = localStorage.getItem('meter_unsynced_changes_exist') === 'true';

    if (!navigator.onLine) {
      setSyncStatus('offline-saved');
    } else if (!token || !expiry || Date.now() >= parseInt(expiry, 10)) {
      setSyncStatus('not-connected');
    } else if (isAutoSync) {
      setSyncStatus(hasUnsynced ? 'pending' : 'synced');
    } else {
      setSyncStatus('synced'); // Connected but auto-sync is off (local-first mode)
    }
  };

  // Global Trigger Auto-Sync Function
  const triggerAutoSync = async (force: boolean = false) => {
    const isAutoSync = localStorage.getItem('gdrive_auto_sync') === 'true';
    const token = localStorage.getItem('gdrive_access_token');
    const expiry = localStorage.getItem('gdrive_token_expiry');
    const hasUnsynced = localStorage.getItem('meter_unsynced_changes_exist') === 'true';

    if (!navigator.onLine) {
      setSyncStatus('offline-saved');
      return;
    }

    if (!token || !expiry || Date.now() >= parseInt(expiry, 10)) {
      setSyncStatus('not-connected');
      return;
    }

    if (!isAutoSync && !force) {
      setSyncStatus('synced'); // Connected but local sync is active
      return;
    }

    if (!force && !hasUnsynced) {
      setSyncStatus('synced');
      return;
    }

    setIsBackgroundSyncing(true);
    setSyncStatus('syncing');

    try {
      // Get the current data from states directly
      const currentSubscribers = subscribers.length > 0 ? subscribers : getInitialSubscribers();
      const currentInvoices = invoices.length > 0 ? invoices : getInitialInvoices();
      const currentPayments = payments.length > 0 ? payments : getInitialPayments();

      const jsonString = exportDataAsJSON(currentSubscribers, currentInvoices, currentPayments);
      const fileName = `كهرباء_العداد_الرئيسي_مزامنة_تلقائية.json`;
      
      await uploadToGoogleDrive(token, jsonString, fileName);

      const nowString = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
      localStorage.setItem('gdrive_last_synced_time', nowString);
      localStorage.setItem('meter_unsynced_changes_exist', 'false');
      setLastSyncedTime(nowString);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Background Auto-Sync failed:', err);
      setSyncStatus('pending');
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  // Sync groups list to localStorage
  useEffect(() => {
    localStorage.setItem('meter_groups_list', JSON.stringify(groupsList));
    if (!isInitialLoad.current) {
      triggerFirebaseSync();
    }
  }, [groupsList]);

  // Sync users list to localStorage
  useEffect(() => {
    if (usersList.length > 0) {
      localStorage.setItem('meter_users_list', JSON.stringify(usersList));
      if (!isInitialLoad.current) {
        triggerFirebaseSync();
      }
    }
  }, [usersList]);

  // Handle detecting new incoming notifications for visual alerts
  useEffect(() => {
    if (notifications.length > 0) {
      if (isInitialLoad.current) {
        notifications.forEach(n => seenNotificationIds.current.add(n.id));
        isInitialLoad.current = false;
        return;
      }

      // Filter for notifications not yet marked seen in the current browser session
      const unseen = notifications.filter(n => !seenNotificationIds.current.has(n.id));
      if (unseen.length > 0) {
        // Mark them all as seen in session ref
        unseen.forEach(n => seenNotificationIds.current.add(n.id));

        // Let's gather unread notifications directed to our active user or active guest chat
        let myUnseenUnread: Notification[] = [];

        if (currentUser) {
          // Get saved toast settings
          const savedToastSettings = localStorage.getItem('toast_notification_settings');
          let toastSettings = {
            allowOverdueDebts: true,
            allowSystemAdmin: true,
            allowDirectMessages: true,
            allowGroupChats: true,
          };
          if (savedToastSettings) {
            try {
              toastSettings = JSON.parse(savedToastSettings);
            } catch (e) {
              console.error('Error loading toast settings in App', e);
            }
          }

          myUnseenUnread = unseen.filter(n => {
            if (n.senderId === currentUser.id) return false;
            if (n.receiverId === currentUser.id) return true;
            if (n.receiverId === 'all-users') return true;
            if (currentUser.role === 'admin' && n.receiverId === 'all-admins') return true;
            return false;
          }).filter(n => !n.read).filter(n => {
            // Apply Toast Notification Settings Filter
            const titleAndMsg = (n.title + ' ' + n.message).toLowerCase();
            
            const isOverdueDebt = 
              titleAndMsg.includes('دين') ||
              titleAndMsg.includes('ديون') ||
              titleAndMsg.includes('متأخر') ||
              titleAndMsg.includes('مستحق') ||
              titleAndMsg.includes('ذمم') ||
              titleAndMsg.includes('تحصيل') ||
              titleAndMsg.includes('فاتورة') ||
              titleAndMsg.includes('دفع') ||
              titleAndMsg.includes('سداد') ||
              titleAndMsg.includes('debt') ||
              titleAndMsg.includes('overdue') ||
              titleAndMsg.includes('unpaid') ||
              titleAndMsg.includes('invoice') ||
              titleAndMsg.includes('payment');

            const isSystemAdmin = 
              n.receiverId === 'all-admins' ||
              n.senderRole === 'admin' ||
              n.senderId === 'user-admin' ||
              titleAndMsg.includes('إدارية') ||
              titleAndMsg.includes('صلاحية') ||
              titleAndMsg.includes('النظام') ||
              titleAndMsg.includes('نسخ احتياطي') ||
              titleAndMsg.includes('admin') ||
              titleAndMsg.includes('system') ||
              titleAndMsg.includes('backup');

            const isGroup = n.receiverId === 'all-users' || n.receiverId === 'all-admins' || n.title.includes('مجموعة') || n.title.includes('غرفة');
            const isDirect = !isGroup;

            if (isOverdueDebt && !toastSettings.allowOverdueDebts) return false;
            if (isSystemAdmin && !toastSettings.allowSystemAdmin) return false;
            if (isDirect && !toastSettings.allowDirectMessages) return false;
            if (isGroup && !toastSettings.allowGroupChats) return false;

            return true;
          });
        } else if (guestChatActive) {
          // If guest chat is active, allow guest to receive urgent notifications/messages from admin
          myUnseenUnread = unseen.filter(n => {
            return (n.receiverId === 'guest' || n.receiverId === 'all-users') && n.senderId !== 'guest' && !n.read;
          });
        } else {
          // Even on the login screen, allow anyone to receive "all-users" broadcast alerts!
          myUnseenUnread = unseen.filter(n => {
            return n.receiverId === 'all-users' && n.senderId !== 'guest' && !n.read;
          });
        }

        if (myUnseenUnread.length > 0) {
          // Display a toast for the latest unseen unread notification
          const latest = myUnseenUnread[0];
          setToast({
            id: latest.id,
            title: latest.title,
            message: latest.message,
            senderName: latest.senderName
          });

          // Play synthesized sound alert based on the notification category!
          const category = getNotificationCategory(latest);
          playNotificationSound(category);

          // Auto dismiss toast after 5 seconds as requested by the user
          const timer = setTimeout(() => {
            setToast(null);
          }, 5000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [notifications, currentUser, guestChatActive]);

  const handleUpdateNotifications = (newNotifications: Notification[]) => {
    setNotifications(newNotifications);
    saveNotifications(newNotifications);
  };

  const unreadNotificationsCount = currentUser ? notifications.filter(n => {
    if (n.senderId === currentUser.id) return false;
    if (n.receiverId === currentUser.id) return true;
    if (n.receiverId === 'all-users') return true;
    if (currentUser.role === 'admin' && n.receiverId === 'all-admins') return true;
    return false;
  }).filter(n => !n.read).length : 0;

  // Filter data based on current user's assigned subscribers (only if role is not admin and assignedSubscriberIds is set)
  const isRestricted = !!(currentUser && currentUser.role !== 'admin' && currentUser.assignedSubscriberIds && currentUser.assignedSubscriberIds.length > 0);

  const filteredSubscribers = isRestricted 
    ? subscribers.filter(s => currentUser?.assignedSubscriberIds?.includes(s.id))
    : subscribers;

  const filteredInvoices = isRestricted
    ? invoices.filter(inv => inv.subscriberIds.some(id => currentUser?.assignedSubscriberIds?.includes(id)))
    : invoices;

  const filteredPayments = isRestricted
    ? payments.filter(p => currentUser?.assignedSubscriberIds?.includes(p.subscriberId))
    : payments;

  // Global Financial Statistics Calculations
  const totalSubscribersCount = filteredSubscribers.length;

  const totalBillingAmount = filteredInvoices.reduce((sum, inv) => {
    if (isRestricted) {
      const assignedCount = inv.subscriberIds.filter(id => currentUser?.assignedSubscriberIds?.includes(id)).length;
      return sum + (inv.sharePerSubscriber * assignedCount);
    }
    return sum + inv.totalCost;
  }, 0);

  const totalPaymentsAmount = filteredPayments.reduce((sum, pay) => sum + pay.amount, 0);

  // Calculate the total outstanding debt by summing each subscriber's remaining debt
  const totalOutstandingDebt = filteredSubscribers.reduce((sum, sub) => {
    const stats = calculateSubscriberStats(sub, invoices, payments);
    return sum + stats.remainingDebt;
  }, 0);

  // Calculate the average monthly consumption dynamically based on saved invoice data
  const averageMonthlyConsumptionStats = (() => {
    if (filteredInvoices.length === 0) {
      return { total: 0, perSubscriber: 0 };
    }

    // Group consumption by Year-Month ("YYYY-MM")
    const monthlyConsumptionMap: Record<string, number> = {};
    
    filteredInvoices.forEach(inv => {
      let dateObj: Date;
      try {
        dateObj = new Date(inv.date);
        if (isNaN(dateObj.getTime())) {
          dateObj = new Date();
        }
      } catch (e) {
        dateObj = new Date();
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yearMonthKey = `${year}-${month}`;

      let consumptionAmount = inv.consumption;
      if (isRestricted) {
        const assignedCount = inv.subscriberIds.filter(id => currentUser?.assignedSubscriberIds?.includes(id)).length;
        consumptionAmount = (inv.consumption / inv.subscriberIds.length) * assignedCount;
      }

      monthlyConsumptionMap[yearMonthKey] = (monthlyConsumptionMap[yearMonthKey] || 0) + consumptionAmount;
    });

    const uniqueMonthsCount = Object.keys(monthlyConsumptionMap).length;
    if (uniqueMonthsCount === 0) {
      return { total: 0, perSubscriber: 0 };
    }

    const totalAllMonthsConsumption = Object.values(monthlyConsumptionMap).reduce((sum, val) => sum + val, 0);
    const averageMonthly = totalAllMonthsConsumption / uniqueMonthsCount;
    const perSubscriberAvg = totalSubscribersCount > 0 ? averageMonthly / totalSubscribersCount : 0;

    return {
      total: averageMonthly,
      perSubscriber: perSubscriberAvg
    };
  })();

  // Actions / Handlers

  const logAction = (action: string, details: string) => {
    if (currentUser) {
      const updatedLogs = logSystemActivity(currentUser, action, details);
      setActivityLogs(updatedLogs);
    }
  };

  // Save a new computed invoice
  const handleSaveInvoice = (newInvData: Omit<Invoice, 'id' | 'date'>) => {
    const newInvoice: Invoice = {
      ...newInvData,
      id: `invoice-${Date.now()}`,
      date: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Log this action
    const subNames = subscribers
      .filter((s) => newInvoice.subscriberIds.includes(s.id))
      .map((s) => s.name)
      .join('، ');
    logAction(
      'إصدار فاتورة',
      `تم إصدار فاتورة جديدة بقيمة ${newInvoice.totalCost.toLocaleString('en-US')} ${defaultCurrency} للمشتركين: ${subNames || 'غير محدد'}.`
    );
  };

  // Save multiple invoices (used for composite electricity invoice)
  const handleSaveMultipleInvoices = (newInvoices: Invoice[]) => {
    setInvoices((prev) => [...newInvoices, ...prev]);

    // Log this action
    if (newInvoices.length > 0) {
      const totalAmount = newInvoices.reduce((sum, inv) => sum + inv.totalCost, 0);
      logAction(
        'إصدار فواتير مركبة',
        `تم إصدار ${newInvoices.length} فواتير كهرباء مركبة بقيمة إجمالية ${totalAmount.toLocaleString('en-US')} ${defaultCurrency}.`
      );
    }
  };

  // Add a new subscriber
  const handleAddSubscriber = (
    name: string,
    phone?: string,
    whatsapp?: string,
    openingBalance: number = 0,
    groups: string[] = [],
    createUserAccount?: boolean,
    userUsername?: string,
    userPassword?: string,
    userRole?: 'admin' | 'operator' | 'viewer'
  ) => {
    const maxSubNumber = subscribers.reduce((max, s) => {
      const num = typeof s.subNumber === 'number' ? s.subNumber : parseInt(s.id) || 1000;
      return num > max ? num : max;
    }, 1000);
    const subId = `subscriber-${Date.now()}`;
    const newSub: Subscriber = {
      id: subId,
      subNumber: maxSubNumber + 1,
      name,
      createdAt: new Date().toISOString(),
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      openingBalance,
      groups,
    };

    setSubscribers((prev) => [...prev, newSub]);

    // Log this action
    logAction(
      'إضافة مشترك',
      `تم تسجيل مشترك جديد: ${name} (رقم الاشتراك: ${newSub.subNumber}) برصيد افتتاحي ${openingBalance} ${defaultCurrency}.`
    );

    // Create linked user if requested
    if (createUserAccount && userUsername) {
      const newUser: User = {
        id: `user-${Date.now()}`,
        username: userUsername.trim(),
        password: userPassword || '123456',
        role: userRole || 'viewer',
        name: name,
        assignedSubscriberIds: [subId],
      };
      setUsersList((prev) => [...prev, newUser]);

      logAction(
        'إنشاء مستخدم مرتبط',
        `تم إنشاء حساب مستخدم مرتبط للمشترك الجديد: ${name} (@${newUser.username}) بمستوى صلاحية ${newUser.role === 'admin' ? 'مدير نظام' : newUser.role === 'operator' ? 'محاسب' : 'مشاهد فقط'}.`
      );
    }
  };

  // Delete a subscriber
  const handleDeleteSubscriber = (id: string) => {
    const targetSub = subscribers.find((sub) => sub.id === id);
    setSubscribers((prev) => prev.filter((sub) => sub.id !== id));
    // Clean up their payments
    setPayments((prev) => prev.filter((pay) => pay.subscriberId !== id));
    // We keep the invoices history, but they won't be in future calculations

    // Log this action
    if (targetSub) {
      logAction(
        'حذف مشترك',
        `تم حذف مشترك: ${targetSub.name} (رقم الاشتراك: ${targetSub.subNumber}) وكافة دفعاته المرتبطة من النظام.`
      );
    }
  };

  // Update/Edit an existing subscriber
  const handleUpdateSubscriber = (updatedSub: Subscriber) => {
    const oldSub = subscribers.find((sub) => sub.id === updatedSub.id);
    setSubscribers((prev) => prev.map((sub) => sub.id === updatedSub.id ? updatedSub : sub));
    
    // Also update payments with their updated name if name changed
    setPayments((prev) => prev.map((pay) => {
      if (pay.subscriberId === updatedSub.id) {
        return { ...pay, subscriberName: updatedSub.name };
      }
      return pay;
    }));

    // Log this action
    if (oldSub) {
      const changes: string[] = [];
      if (oldSub.name !== updatedSub.name) changes.push(`الاسم: من "${oldSub.name}" إلى "${updatedSub.name}"`);
      if (oldSub.phone !== updatedSub.phone) changes.push(`الهاتف: من "${oldSub.phone || 'بلا'}" إلى "${updatedSub.phone || 'بلا'}"`);
      if (oldSub.openingBalance !== updatedSub.openingBalance) changes.push(`القيد الافتتاحي: من ${oldSub.openingBalance} إلى ${updatedSub.openingBalance}`);
      
      const details = changes.length > 0 ? `تعديل بيانات المشترك #${updatedSub.subNumber} (${changes.join(' • ')})` : `حفظ تعديلات للمشترك ${updatedSub.name} #${updatedSub.subNumber}`;
      logAction('تعديل مشترك', details);
    }
  };

  // Add a new custom group
  const handleAddGroup = (groupName: string, subscriberIds?: string[]) => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    
    setGroupsList((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });

    if (subscriberIds && subscriberIds.length > 0) {
      setSubscribers((prev) => prev.map((s) => {
        if (subscriberIds.includes(s.id)) {
          const currentGroups = s.groups || [];
          if (!currentGroups.includes(trimmed)) {
            return { ...s, groups: [...currentGroups, trimmed] };
          }
        }
        return s;
      }));
    }
  };

  // Edit an existing group name
  const handleEditGroup = (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return;

    // Update group list
    setGroupsList((prev) => prev.map((g) => g === oldName ? trimmedNew : g));

    // Update all subscribers belonging to this group
    setSubscribers((prev) => prev.map((s) => ({
      ...s,
      groups: (s.groups || []).map((g) => g === oldName ? trimmedNew : g)
    })));
  };

  // Delete a group
  const handleDeleteGroup = (groupName: string) => {
    // Remove from group list
    setGroupsList((prev) => prev.filter((g) => g !== groupName));

    // Remove from all subscribers belonging to this group
    setSubscribers((prev) => prev.map((s) => ({
      ...s,
      groups: (s.groups || []).filter((g) => g !== groupName)
    })));
  };

  // Settings update handlers
  const handleUpdateDefaultCurrency = (currency: string) => {
    setDefaultCurrency(currency);
    localStorage.setItem('meter_default_currency', currency);
  };

  const handleUpdateCurrencies = (currList: string[]) => {
    setCurrencies(currList);
    localStorage.setItem('meter_currencies_list', JSON.stringify(currList));
  };

  const handleUpdateDefaultPrice = (price: string) => {
    setDefaultPricePerKwh(price);
    localStorage.setItem('meter_default_price_per_kwh', price);
  };

  const handleUpdateWhatsappReminderEnabled = (enabled: boolean) => {
    setWhatsappReminderEnabled(enabled);
    localStorage.setItem('meter_whatsapp_reminder_enabled', enabled ? 'true' : 'false');
  };

  const handleUpdateWhatsappReminderThreshold = (threshold: number) => {
    setWhatsappReminderThreshold(threshold);
    localStorage.setItem('meter_whatsapp_reminder_threshold', threshold.toString());
  };

  const handleUpdateWhatsappReminderTemplate = (template: string) => {
    setWhatsappReminderTemplate(template);
    localStorage.setItem('meter_whatsapp_reminder_template', template);
  };

  const handleUpdateAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('gdrive_auto_sync', enabled ? 'true' : 'false');
    localStorage.setItem('meter_sync_method', enabled ? 'cloud' : 'local');
    
    // Update the sync status indicator
    setTimeout(() => {
      updateInitialSyncStatus();
      if (enabled) {
        localStorage.setItem('meter_unsynced_changes_exist', 'true');
        triggerAutoSync(true);
      }
    }, 100);
  };

  // Record a payment / debt settlement
  const handleRecordPayment = (subscriberId: string, amount: number, notes?: string) => {
    const targetSub = subscribers.find((s) => s.id === subscriberId);
    if (!targetSub) return;

    const newPayment: Payment = {
      id: `payment-${Date.now()}`,
      subscriberId,
      subscriberName: targetSub.name,
      amount,
      date: new Date().toISOString(),
      notes,
    };

    setPayments((prev) => [newPayment, ...prev]);

    // Log this action
    logAction(
      'سداد دفعة',
      `تم تسجيل دفعة مالية بقيمة ${amount.toLocaleString('en-US')} ${defaultCurrency} للمشترك: ${targetSub.name} (رقم الاشتراك: ${targetSub.subNumber}).${notes ? ` ملاحظات: ${notes}` : ''}`
    );
  };

  // Delete a payment
  const handleDeletePayment = (id: string) => {
    const targetPay = payments.find((p) => p.id === id);
    setPayments((prev) => prev.filter((pay) => pay.id !== id));

    // Log this action
    if (targetPay) {
      logAction(
        'حذف دفعة',
        `تم حذف دفعة مالية مسجلة بقيمة ${targetPay.amount.toLocaleString('en-US')} ${defaultCurrency} للمشترك: ${targetPay.subscriberName}.`
      );
    }
  };

  // Delete an invoice
  const handleDeleteInvoice = (id: string) => {
    const targetInv = invoices.find((inv) => inv.id === id);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));

    // Log this action
    if (targetInv) {
      const subNames = subscribers
        .filter((s) => targetInv.subscriberIds.includes(s.id))
        .map((s) => s.name)
        .join('، ');
      
      const actionName = targetInv.isExpense ? 'حذف قيد مصروف' : 'حذف فاتورة';
      const actionDetails = targetInv.isExpense 
        ? `تم حذف قيد مصروف مشترك بقيمة ${targetInv.totalCost.toLocaleString('en-US')} ${defaultCurrency} باسم (${targetInv.expenseType}) للمشتركين: ${subNames || 'غير محدد'}.`
        : `تم حذف فاتورة بقيمة ${targetInv.totalCost.toLocaleString('en-US')} ${defaultCurrency} للمشتركين: ${subNames || 'غير محدد'}.`;

      logAction(actionName, actionDetails);
    }
  };

  // Add a new shared expense distributed among subscribers/groups
  const handleAddExpense = (name: string, amount: number, dateStr: string, subscriberIds: string[], notes?: string) => {
    const sharePerSub = amount / subscriberIds.length;
    const newExpense: Invoice = {
      id: `expense-${Date.now()}`,
      date: new Date(dateStr).toISOString(),
      prevReading: 0,
      currReading: 0,
      consumption: 0,
      pricePerKwh: 0,
      totalCost: amount,
      subscriberIds,
      sharePerSubscriber: sharePerSub,
      notes: notes || '',
      isExpense: true,
      expenseType: name,
    };

    setInvoices((prev) => [newExpense, ...prev]);

    // Log this action
    const subNames = subscribers
      .filter((s) => subscriberIds.includes(s.id))
      .map((s) => s.name)
      .join('، ');
    logAction(
      'تسجيل مصروف مشترك',
      `تم تسجيل مصروف مشترك بقيمة ${amount.toLocaleString('en-US')} ${defaultCurrency} باسم (${name}) وموزع بالتساوي على ${subscriberIds.length} مشتركين: ${subNames || 'غير محدد'}.`
    );
  };

  // Restore database backup
  const handleImportData = (
    importedSubs: Subscriber[],
    importedInvs: Invoice[],
    importedPays: Payment[]
  ) => {
    setSubscribers(importedSubs);
    setInvoices(importedInvs);
    setPayments(importedPays);
    saveToLocalStorage(importedSubs, importedInvs, importedPays);

    logAction(
      'استيراد قاعدة البيانات',
      `تم بنجاح استيراد قاعدة بيانات جديدة تحتوي على ${importedSubs.length} مشتركين، و${importedInvs.length} فواتير، و${importedPays.length} دفعات.`
    );
  };

  // Reset all application data
  const handleClearAllData = () => {
    setSubscribers([]);
    setInvoices([]);
    setPayments([]);
    localStorage.removeItem('meter_subscribers');
    localStorage.removeItem('meter_invoices');
    localStorage.removeItem('meter_payments');

    logAction(
      'تصفير البيانات',
      'تم تصفير وحذف كافة بيانات المشتركين والفواتير والدفعات من النظام نهائياً.'
    );
  };

  const handleClearActivityLogs = () => {
    localStorage.removeItem('meter_activity_logs');
    setActivityLogs([
      {
        id: `log-clear-${Date.now()}`,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'مدير النظام',
        userRole: currentUser?.role || 'admin',
        action: 'تفريغ سجل النشاط',
        details: 'تم تفريغ وحذف سجل العمليات والنشاطات الإدارية بالكامل.',
        date: new Date().toISOString(),
      }
    ]);
  };

  const handleAddUser = (newUserData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...newUserData,
      id: `user-${Date.now()}`,
    };
    setUsersList((prev) => [...prev, newUser]);

    logAction(
      'إنشاء مستخدم جديد',
      `تم إنشاء حساب مستخدم جديد: ${newUser.name} (@${newUser.username}) بصلاحية ${newUser.role === 'admin' ? 'مدير نظام' : newUser.role === 'operator' ? 'محاسب' : 'مشاهد فقط'}.`
    );
  };

  const handleUpdateUser = (updatedUser: User) => {
    const oldUser = usersList.find((u) => u.id === updatedUser.id);
    setUsersList((prev) => prev.map((u) => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('meter_current_user', JSON.stringify(updatedUser));
    }

    if (oldUser) {
      logAction(
        'تعديل حساب مستخدم',
        `تم تعديل بيانات وصلاحيات حساب المستخدم: ${updatedUser.name} (@${updatedUser.username}).`
      );
    }
  };

  const handleUpdateBillSettings = (settings: BillCustomization) => {
    if (!currentUser) return;
    const updatedUser: User = {
      ...currentUser,
      billSettings: settings,
    };
    handleUpdateUser(updatedUser);
  };

  const handleDeleteUser = (userId: string) => {
    const targetUser = usersList.find((u) => u.id === userId);
    setUsersList((prev) => prev.filter((u) => u.id !== userId));

    if (targetUser) {
      logAction(
        'حذف حساب مستخدم',
        `تم حذف حساب المستخدم: ${targetUser.name} (@${targetUser.username}) نهائياً من النظام.`
      );
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('meter_current_user', JSON.stringify(user));

    const updatedLogs = logSystemActivity(user, 'تسجيل دخول', `قام المستخدم بتسجيل الدخول إلى النظام بنجاح.`);
    setActivityLogs(updatedLogs);
  };

  const handleLogout = () => {
    if (currentUser) {
      logSystemActivity(currentUser, 'تسجيل خروج', `قام المستخدم بتسجيل الخروج من النظام.`);
    }
    setCurrentUser(null);
    localStorage.removeItem('meter_current_user');
    setActiveTab('dashboard');
  };

  const handleMenuAction = (
    action:
      | 'new-invoice'
      | 'new-subscriber'
      | 'report-invoices'
      | 'report-subscribers'
      | 'new-group'
      | 'groups'
  ) => {
    setMenuOpen(false);
    setReportsOpen(false);
    setGroupsOpen(false);

    if (action === 'new-invoice') {
      setActiveTab('new-invoice');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('focus-invoice-form'));
      }, 150);
    } else if (action === 'new-subscriber') {
      setActiveTab('subscribers');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-subscriber'));
      }, 150);
    } else if (action === 'new-group') {
      setActiveTab('subscribers');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-group'));
      }, 150);
    } else if (action === 'groups') {
      setActiveTab('subscribers');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-groups'));
      }, 150);
    } else if (action === 'report-invoices') {
      setActiveTab('invoices-history');
    } else if (action === 'report-subscribers') {
      setActiveTab('subscribers');
    }
  };

  const getHighestDebtSub = () => {
    const debtorList = filteredSubscribers
      .map((sub) => {
        const stats = calculateSubscriberStats(sub, invoices, payments);
        return { sub, stats };
      })
      .filter((item) => item.stats.remainingDebt > 0)
      .sort((a, b) => b.stats.remainingDebt - a.stats.remainingDebt);
    return debtorList[0] || null;
  };

  const handleOpenMessages = () => {
    setGuestChatActive(true);
  };

  if (!isAppInitialized && !isOnline) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" style={{ direction: 'rtl' }}>
        <div className="max-w-md w-full bg-slate-950/60 backdrop-blur-md rounded-3xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
          {/* Neon gradient background blur */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Animated wifi off icon */}
            <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6 border border-amber-500/20 animate-pulse">
              <CloudOff className="w-10 h-10" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight">
              اتصال الإنترنت مطلوب لتشغيل التطبيق لأول مرة 🌐
            </h1>
            
            <p className="text-xs sm:text-sm font-medium text-slate-400 leading-relaxed mb-6">
              لتأسيس قواعد البيانات وتأمين النظام والتحقق من التراخيص الأولية، يتطلب التطبيق وجود اتصال بالإنترنت في <span className="text-amber-400 font-black">المرة الأولى للتشغيل فقط</span>.
            </p>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 mb-6 w-full text-right space-y-3.5">
              <div className="flex gap-2.5 items-start">
                <span className="text-emerald-400 mt-0.5 font-black text-sm">✓</span>
                <p className="text-[11px] sm:text-xs font-bold text-slate-300">بعد هذه الخطوة، ستتمكن من فتح وتشغيل النظام بالكامل <span className="text-emerald-400">بدون إنترنت (أوفلاين)</span> في أي وقت.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-emerald-400 mt-0.5 font-black text-sm">✓</span>
                <p className="text-[11px] sm:text-xs font-bold text-slate-300">يمكنك إدخال المشتركين والفواتير والدفعات بدون إنترنت بشكل آمن وسليم.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-emerald-400 mt-0.5 font-black text-sm">✓</span>
                <p className="text-[11px] sm:text-xs font-bold text-slate-300">بمجرد عودة الإنترنت لاحقاً، يقوم النظام بمزامنة كافة تعديلاتك تلقائياً مع السحاب لحمايتها من الضياع.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-black text-amber-400 animate-pulse bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              بانتظار اتصالك بالإنترنت الآن... يرجى تفعيل الشبكة للبدء فوراً
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-600 mt-6 font-semibold">نظام إدارة العداد الرئيسي والفوترة الذكية © {new Date().getFullYear()}</p>
      </div>
    );
  }

  if (guestChatActive) {
    return (
      <>
        <GuestChat
          notifications={notifications}
          onSendMessage={(text) => {
            const newMsg: Notification = {
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              senderId: 'guest',
              senderName: 'زائر / مشترك خارجي',
              senderRole: 'viewer',
              receiverId: 'admin',
              title: 'رسالة جديدة من زائر',
              message: text,
              date: new Date().toISOString(),
              read: false,
              communicationMethod: 'internet'
            };
            handleUpdateNotifications([newMsg, ...notifications]);
          }}
          onBack={() => setGuestChatActive(false)}
        />

        {/* --- TOAST ALERT ON GUEST SCREEN --- */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9, x: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.9, x: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="fixed bottom-6 right-6 z-[9999] w-[92%] sm:w-96 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl shadow-slate-950/20 border border-slate-800 p-4 flex gap-3 text-right items-start"
              style={{ direction: 'rtl' }}
            >
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl mt-0.5 animate-pulse shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-blue-400">
                    إشعار عاجل من الإدارة 📢
                  </h4>
                  <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
                    من: {toast.senderName}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-100 mt-1.5 line-clamp-1">{toast.title}</p>
                <p className="text-[11px] font-medium text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
                
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5 justify-end">
                  <button
                    onClick={() => setToast(null)}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} usersList={usersList} onOpenMessages={handleOpenMessages} />

        {/* --- TOAST ALERT ON LOGIN SCREEN --- */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9, x: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.9, x: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="fixed bottom-6 right-6 z-[9999] w-[92%] sm:w-96 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl shadow-slate-950/20 border border-slate-800 p-4 flex gap-3 text-right items-start"
              style={{ direction: 'rtl' }}
            >
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl mt-0.5 animate-pulse shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-blue-400">
                    تنبيه عام من الإدارة 📢
                  </h4>
                  <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
                    من: {toast.senderName}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-100 mt-1.5 line-clamp-1">{toast.title}</p>
                <p className="text-[11px] font-medium text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
                
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5 justify-end">
                  <button
                    onClick={() => setToast(null)}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  const renderDashboard = () => {
    const collectionRate = totalBillingAmount > 0 ? (totalPaymentsAmount / totalBillingAmount) * 100 : 0;
    const highestDebtItem = getHighestDebtSub();

    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Financial KPIs Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Card 1: Subscribers count */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-400 shadow-md flex items-center justify-between transition-all hover:shadow-lg glow-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs sm:text-base font-black text-slate-600 block text-right whitespace-nowrap overflow-hidden text-ellipsis">المشتركون المسجلون</span>
              <div className="h-[2px] w-full bg-indigo-600/70 dark:bg-indigo-400/70 rounded-full my-2 shadow-sm" />
              <span className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight block text-right">
                {totalSubscribersCount} <span className="text-xs sm:text-sm font-black text-slate-400">أفراد</span>
              </span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hidden sm:block shrink-0 mr-4">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Total main meter cost billed */}
          <div className="bg-white rounded-3xl p-6 border-2 border-blue-100 dark:border-blue-900/60 shadow-md flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 glow-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs sm:text-base font-black text-slate-600 block text-right whitespace-nowrap overflow-hidden text-ellipsis">إجمالي الفواتير الصادرة</span>
              <div className="h-[2px] w-full bg-blue-600/70 dark:bg-blue-400/70 rounded-full my-2 shadow-sm" />
              <span className="text-2xl sm:text-4xl font-black text-blue-600 font-mono tracking-tight block highlight-val text-right">
                {totalBillingAmount.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs sm:text-base font-black text-blue-400">{defaultCurrency}</span>
              </span>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl hidden sm:block shadow-inner shrink-0 mr-4">
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>

          {/* Card 3: Total Payments recorded */}
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-100 dark:border-emerald-900/60 shadow-md flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:border-emerald-500 dark:hover:border-emerald-400 glow-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs sm:text-base font-black text-slate-600 block text-right whitespace-nowrap overflow-hidden text-ellipsis">إجمالي المبالغ المُسددة</span>
              <div className="h-[2px] w-full bg-emerald-600/70 dark:bg-emerald-400/70 rounded-full my-2 shadow-sm" />
              <span className="text-2xl sm:text-4xl font-black text-emerald-600 font-mono tracking-tight block highlight-val text-right">
                {totalPaymentsAmount.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs sm:text-base font-black text-emerald-400">{defaultCurrency}</span>
              </span>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hidden sm:block shadow-inner shrink-0 mr-4">
              <CheckCircle className="w-7 h-7" />
            </div>
          </div>

          {/* Card 4: Net outstanding debt to collect */}
          <div className="bg-white rounded-3xl p-6 border-2 border-rose-100 dark:border-rose-900/60 shadow-md flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:border-rose-500 dark:hover:border-rose-400 glow-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs sm:text-base font-black text-slate-600 block text-right whitespace-nowrap overflow-hidden text-ellipsis">الديون والذمم المستحقة</span>
              <div className="h-[2px] w-full bg-rose-600/70 dark:bg-rose-400/70 rounded-full my-2 shadow-sm" />
              <span className={`text-2xl sm:text-4xl font-black font-mono tracking-tight block highlight-val text-right ${totalOutstandingDebt > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                {totalOutstandingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs sm:text-base font-black text-rose-400">{defaultCurrency}</span>
              </span>
            </div>
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl hidden sm:block shadow-inner shrink-0 mr-4">
              <Wallet className="w-7 h-7" />
            </div>
          </div>

          {/* Card 5: Average monthly consumption */}
          <div className="bg-white rounded-3xl p-6 border-2 border-amber-100 dark:border-amber-900/60 shadow-md col-span-2 lg:col-span-1 flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:border-amber-500 dark:hover:border-amber-400 glow-card">
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs sm:text-base font-black text-slate-600 block text-right whitespace-nowrap overflow-hidden text-ellipsis">متوسط الاستهلاك الشهري</span>
              <div className="h-[2px] w-full bg-amber-600/70 dark:bg-amber-400/70 rounded-full my-2 shadow-sm" />
              <span className="text-2xl sm:text-4xl font-black text-amber-600 font-mono tracking-tight block highlight-val text-right">
                {averageMonthlyConsumptionStats.total.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs sm:text-base font-black text-amber-400">ك.و</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold block text-right">
                بمعدل {averageMonthlyConsumptionStats.perSubscriber.toLocaleString('en-US', { maximumFractionDigits: 1 })} ك.و لكل مشترك
              </span>
            </div>
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl hidden sm:block shadow-inner shrink-0 mr-4">
              <Zap className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Bento Grid layout with dynamic insights and summaries */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Card 1: Collection Rate Summary Card */}
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-100 dark:border-emerald-900/60 shadow-md lg:col-span-4 flex flex-col justify-between space-y-6 hover:border-emerald-500 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">معدل تحصيل المبالغ</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium">مؤشر يقيس مدى التزام المشتركين بسداد قيمة فواتيرهم الموزعة.</p>
            </div>

            {/* Circular Progress Display */}
            <div className="flex flex-col items-center justify-center py-4 relative">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* SVG circle track */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-slate-100"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  <motion.circle
                    className="text-emerald-500"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * collectionRate) / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-800">{collectionRate.toFixed(1)}%</span>
                  <span className="text-[10px] text-slate-400 font-bold">نسبة التحصيل</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-400 font-semibold block text-right">إجمالي المتبقي للتحصيل</span>
                <span className="font-extrabold text-slate-700">{totalOutstandingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}</span>
              </div>
              <button
                onClick={() => setActiveTab('subscribers')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                تسجيل سداد جديد ←
              </button>
            </div>
          </div>

          {/* Card 2: Highest Debtor or WhatsApp Overdue Reminders List Card */}
          <div className="bg-white rounded-3xl p-6 border-2 border-rose-100 dark:border-rose-900/60 shadow-md lg:col-span-5 flex flex-col justify-between space-y-6 hover:border-rose-500 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {whatsappReminderEnabled ? 'تنبيهات تذكير الدفع بالواتساب' : 'تحليل الذمم ومتابعة المتأخرات'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {whatsappReminderEnabled 
                  ? `المشتركون الذين تجاوزت ديونهم الحد الأقصى المسموح (${whatsappReminderThreshold} ${defaultCurrency}).`
                  : 'متابعة حساب المشترك الأكثر ذمة مالية مع إمكانية التذكير بضغطة زر.'}
              </p>
            </div>

            {whatsappReminderEnabled ? (
              (() => {
                const limitOverSubscribers = filteredSubscribers
                  .map((sub) => {
                    const stats = calculateSubscriberStats(sub, invoices, payments);
                    return { sub, stats };
                  })
                  .filter((item) => item.stats.remainingDebt > whatsappReminderThreshold)
                  .sort((a, b) => b.stats.remainingDebt - a.stats.remainingDebt);

                if (limitOverSubscribers.length > 0) {
                  return (
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {limitOverSubscribers.slice(0, 4).map(({ sub, stats }) => (
                        <div key={sub.id} className="bg-rose-50/40 border border-rose-100/50 rounded-2xl p-3 flex items-center justify-between gap-3 text-right">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {sub.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-slate-800 block truncate">{sub.name}</span>
                              <span className="text-[10px] text-rose-600 font-extrabold font-mono block mt-0.5">
                                الدين: {stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                              </span>
                            </div>
                          </div>

                          {sub.whatsapp ? (
                            <a
                              href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                                whatsappReminderTemplate
                                  .replace(/{name}/g, sub.name)
                                  .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                                  .replace(/{currency}/g, defaultCurrency)
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] sm:text-xs rounded-xl flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>تذكير واتس</span>
                            </a>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold bg-white border border-slate-100 px-2 py-1 rounded-lg shrink-0">
                              بلا واتس
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-6 text-center space-y-2">
                      <span className="text-3xl">🎉</span>
                      <p className="text-xs font-extrabold text-emerald-800">ممتاز! لا يوجد أي مشتركين تجاوزت ديونهم الحد المسموح.</p>
                      <p className="text-[10px] text-emerald-600 font-medium">الحد الحالي متاح عند {whatsappReminderThreshold} {defaultCurrency}.</p>
                    </div>
                  );
                }
              })()
            ) : highestDebtItem ? (
              <div className="bg-rose-50/40 border border-rose-100/60 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {highestDebtItem.sub.name.charAt(0)}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                      <span className="text-xs font-black text-slate-800 block">{highestDebtItem.sub.name}</span>
                      <div className="hidden sm:block h-3.5 w-0.5 bg-rose-300 dark:bg-rose-700/80 rounded-full mx-2" /> {/* خط فاصل ملون وجميل */}
                      <span className="text-[10px] text-slate-400 font-bold">رقم المشترك: #{highestDebtItem.sub.subNumber}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-bold block">إجمالي الدين الحالي</span>
                    <span className="text-sm font-black text-rose-600">{highestDebtItem.stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}</span>
                  </div>
                </div>

                {highestDebtItem.sub.whatsapp ? (
                  <a
                    href={`https://wa.me/${highestDebtItem.sub.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(
                      `السلام عليكم ورحمة الله وبركاته، أخ ${highestDebtItem.sub.name}. نود تذكيركم بأن المستحقات والديون المترتبة على العداد الفرعي والخاصة بفواتير الكهرباء تبلغ حالياً ${highestDebtItem.stats.remainingDebt.toFixed(1)} ${defaultCurrency}. يرجى التكرم بتسديد المبلغ لتفادي تراكم المستحقات. شكراً لتعاونكم الطيب.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-center"
                  >
                    <span>تذكير مباشر عبر الواتساب</span>
                  </a>
                ) : (
                  <div className="text-center py-2 text-[11px] text-slate-400 font-semibold bg-white border border-slate-100 rounded-xl">
                    الرجاء إضافة رقم الواتساب للمشترك لتفعيل التذكير المباشر
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-6 text-center space-y-2">
                <span className="text-3xl">🎉</span>
                <p className="text-xs font-extrabold text-emerald-800">ممتاز! لا يوجد أي ذمم أو متأخرات مالية حالية.</p>
                <p className="text-[10px] text-emerald-600 font-medium">جميع المشتركين قاموا بسداد حساباتهم بشكل كامل.</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">إجمالي ذمم المشتركين المتراكمة:</span>
              <span className="font-extrabold text-slate-700">{totalOutstandingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}</span>
            </div>
          </div>

          {/* Card 3: Groups Summary List Card */}
          <div className="bg-white rounded-3xl p-6 border-2 border-purple-100 dark:border-purple-900/60 shadow-md lg:col-span-3 flex flex-col justify-between space-y-4 hover:border-purple-500 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Tags className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">مجموعات العداد المسجلة</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium">مراقبة الاستهلاك الأخير والتاريخي لموازنة الأحمال والتوزيع العادل.</p>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {groupsList.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 font-bold">لا توجد مجموعات مسجلة بعد.</div>
              ) : (
                groupsList.slice(0, 4).map((group) => {
                  const count = subscribers.filter((s) => s.groups?.includes(group)).length;
                  const groupSubs = subscribers.filter((s) => s.groups?.includes(group));
                  
                  // Calculate consumption stats
                  let latestKwh = 0;
                  let allTimeKwh = 0;

                  groupSubs.forEach((sub) => {
                    // Latest invoice consumption
                    const subInvoices = invoices
                      .filter((inv) => inv.subscriberIds && inv.subscriberIds.includes(sub.id))
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    
                    if (subInvoices.length > 0) {
                      const latestInv = subInvoices[0];
                      const subKwh = latestInv.isComposite
                        ? (latestInv.consumption || 0)
                        : ((latestInv.consumption || 0) / (latestInv.subscriberIds?.length || 1));
                      latestKwh += subKwh;
                    }

                    // All-time invoices consumption
                    const allInvs = invoices.filter((inv) => inv.subscriberIds && inv.subscriberIds.includes(sub.id));
                    allInvs.forEach((inv) => {
                      const subKwh = inv.isComposite
                        ? (inv.consumption || 0)
                        : ((inv.consumption || 0) / (inv.subscriberIds?.length || 1));
                      allTimeKwh += subKwh;
                    });
                  });

                  return (
                    <div key={group} className="p-3 rounded-2xl bg-slate-50 border border-slate-100/60 dark:bg-slate-900/40 dark:border-slate-800/60 space-y-2 text-right">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{group}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40">
                            {count} مشتركين
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedDetailGroup(group)}
                            className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/50 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-100/30 dark:border-blue-900/30 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                          >
                            عرض التفاصيل
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 font-bold block leading-normal">استهلاك آخر دورة:</span>
                          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 font-mono">
                            {latestKwh.toLocaleString('en-US', { maximumFractionDigits: 1 })} ك.و
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 font-bold block leading-normal">إجمالي الاستهلاك:</span>
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 font-mono">
                            {allTimeKwh.toLocaleString('en-US', { maximumFractionDigits: 1 })} ك.و
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => {
                setActiveTab('subscribers');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('highlight-groups'));
                }, 150);
              }}
              className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
            >
              إدارة وتعديل المجموعات
            </button>
          </div>
        </div>

        {/* Big Independent Quick Shortcuts Bento Cards */}
        <div className="space-y-3">
          <h3 className="font-black text-slate-700 text-xs uppercase tracking-wider block text-right">أقسام وتطبيقات النظام</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              {
                id: 'subscribers',
                title: 'كشف وسجل المشتركين',
                desc: 'متابعة العدادات الفرعية، كشوفات الحساب المستقلة وتوثيق مبالغ السداد.',
                icon: Users,
                color: 'from-blue-500 to-indigo-600',
                btnText: 'انتقال لكشف المشتركين',
              },
              currentUser.role !== 'viewer' && {
                id: 'payments',
                title: 'سجل المدفوعات والقبض',
                desc: 'إصدار سندات قبض، إرسال تأكيدات بالواتساب، ومتابعة الأموال المُحصلة.',
                icon: Coins,
                color: 'from-emerald-500 to-teal-600',
                btnText: 'انتقال لسجل المدفوعات',
              },
              currentUser.role !== 'viewer' && {
                id: 'new-invoice',
                title: 'احتساب وتوزيع الفاتورة',
                desc: 'إدخال القراءة الحالية والسابقة وسعر كيلوواط وتوزيع التكلفة فورا.',
                icon: Calculator,
                color: 'from-blue-600 to-cyan-600',
                btnText: 'انتقال لحاسبة الفواتير',
              },
              {
                id: 'invoices-history',
                title: 'أرشيف فواتير الكهرباء',
                desc: 'عرض تاريخ كافة الفواتير، وتحميل تفاصيل الحسبة وطباعة الفاتورة للعموم.',
                icon: FileText,
                color: 'from-amber-500 to-orange-600',
                btnText: 'تصفح سجل الفواتير',
              },
              currentUser.role !== 'viewer' && {
                id: 'expenses',
                title: 'إدارة وتوزيع المصاريف',
                desc: 'تسجيل المصاريف التشغيلية والصيانة وتوزيعها كديون مستحقة آلياً.',
                icon: Coins,
                color: 'from-amber-600 to-amber-700',
                btnText: 'انتقال لتوزيع المصاريف',
              },
              {
                id: 'reports',
                title: 'التقارير والإحصائيات',
                desc: 'تحليل الاستهلاك، تحصيل الذمم والديون، وعرض موجز المجموعات بيانياً.',
                icon: FileBarChart2,
                color: 'from-purple-500 to-indigo-600',
                btnText: 'تصفح التقارير والتحليلات',
              },
              currentUser.role === 'admin' && {
                id: 'backup-settings',
                title: 'النسخ وإدارة البيانات',
                desc: 'تحميل نسخة احتياطية من جميع حساباتك واستعادتها في أي وقت.',
                icon: Database,
                color: 'from-rose-500 to-red-600',
                btnText: 'الإعدادات والنسخ',
              },
            ].filter((card): card is Exclude<typeof card, false> => Boolean(card)).map((card) => {
              const Icon = card.icon;
              const borderColors: Record<string, string> = {
                subscribers: 'border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-400',
                payments: 'border-emerald-100 dark:border-emerald-900/60 hover:border-emerald-500 dark:hover:border-emerald-400',
                'new-invoice': 'border-blue-100 dark:border-blue-900/60 hover:border-blue-500 dark:hover:border-blue-400',
                'invoices-history': 'border-amber-100 dark:border-amber-900/60 hover:border-amber-500 dark:hover:border-amber-400',
                expenses: 'border-amber-150 dark:border-amber-900/60 hover:border-amber-500 dark:hover:border-amber-400',
                reports: 'border-purple-100 dark:border-purple-900/60 hover:border-purple-500 dark:hover:border-purple-400',
                'backup-settings': 'border-rose-100 dark:border-rose-900/60 hover:border-rose-500 dark:hover:border-rose-400',
              };
              const borderClass = borderColors[card.id] || 'border-slate-200 dark:border-slate-700 hover:border-blue-500/50';

              return (
                <div
                  key={card.id}
                  onClick={() => setActiveTab(card.id as any)}
                  className={`bg-white border-2 ${borderClass} rounded-3xl p-5 shadow-md hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between space-y-4`}
                >
                  <div className="space-y-3">
                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors text-right">{card.title}</h4>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed text-right">{card.desc}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 self-start">
                    {card.btnText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 antialiased" dir="rtl">
      {/* Top beautiful Header Area */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Clickable Main Logo/Symbol with a Dropdown & Pulse Notification Badge */}
              <div className="relative">
                <button
                  id="logo-dropdown-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-10 sm:w-12 h-10 sm:h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all cursor-pointer relative select-none"
                  title="اضغط هنا لفتح قائمة الخيارات والتقارير"
                >
                  <Zap className="w-5 sm:w-6 h-5 sm:h-6" />
                  {/* Pulse Notification Dot representing "الاشعار" والاتصال بالإنترنت */}
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5" title={isOnline ? 'متصل بالإنترنت' : 'غير متصل بالإنترنت'}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </span>
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      {/* Backdrop to close on click */}
                      <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setReportsOpen(false); setGroupsOpen(false); }} />
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-2 text-right"
                      >
                        {[
                          { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
                          currentUser.role !== 'viewer' && { id: 'subscribers', label: 'المشتركون والذمم', icon: Users },
                          currentUser.role !== 'viewer' && { id: 'payments', label: 'المدفوعات', icon: Coins },
                          currentUser.role !== 'viewer' && { id: 'new-invoice', label: 'اصدار فاتورة جديدة', icon: Calculator },
                          currentUser.role !== 'viewer' && { id: 'composite-invoice', label: 'فاتورة كهرباء مركبة', icon: Layers },
                          currentUser.role !== 'viewer' && { id: 'expenses', label: 'إدارة وتوزيع المصاريف', icon: Coins },
                          { id: 'invoices-history', label: 'أرشيف الفواتير', icon: FileText },
                          { id: 'reports', label: 'التقارير والاحصائيات', icon: FileBarChart2 },
                          { id: 'notifications', label: 'الاشعارات والمراسلات', icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined },
                          currentUser.role === 'admin' && { id: 'users', label: 'إدارة المستخدمين', icon: UserPlus },
                          currentUser.role === 'admin' && { id: 'settings', label: 'الإعدادات العامة', icon: Settings },
                          currentUser.role === 'admin' && { id: 'backup-settings', label: 'النسخ والإعدادات', icon: Database },
                        ].filter((t): t is Exclude<typeof t, false> => Boolean(t)).map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as any);
                                setMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer text-right ${
                                isActive
                                  ? 'bg-blue-50/70 text-blue-600 font-bold border border-blue-100/30'
                                  : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-100/50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span>{item.label}</span>
                              </div>
                              {'badge' in item && item.badge !== undefined && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-rose-500 text-white rounded-full font-black animate-pulse leading-none">
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
            </div>

            <div>
              <h1 id="app-title" className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight">حسابات</h1>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Theme Toggle */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
              title={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع المضيء'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-indigo-600" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
            </button>

            {/* User Profile widget */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-800 leading-none">{currentUser.name}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-0.5 leading-none">
                  {currentUser.role === 'admin' ? 'مدير النظام' : currentUser.role === 'operator' ? 'محاسب' : 'مشاهد فقط'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="mr-2 px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-extrabold rounded-lg transition-colors cursor-pointer border border-rose-100"
              >
                تسجيل الخروج
              </button>
            </div>

            {/* Sync Status Badge */}
            <div 
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setActiveTab('backup-settings')}
              title="اضغط للتحكم بإعدادات المزامنة والنسخ"
            >
              <div className="flex items-center justify-center relative">
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                ) : syncStatus === 'synced' ? (
                  <Cloud className="w-4 h-4 text-emerald-600 animate-pulse" />
                ) : syncStatus === 'pending' ? (
                  <RefreshCw className="w-4 h-4 text-amber-500 cursor-pointer" />
                ) : syncStatus === 'offline-saved' ? (
                  <CloudOff className="w-4 h-4 text-amber-600" />
                ) : (
                  <CloudOff className="w-4 h-4 text-slate-400" />
                )}
                
                {/* Small indicator light */}
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    syncStatus === 'syncing' ? 'bg-blue-400' :
                    syncStatus === 'synced' ? 'bg-emerald-400' :
                    syncStatus === 'pending' ? 'bg-amber-400' :
                    syncStatus === 'offline-saved' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    syncStatus === 'syncing' ? 'bg-blue-500' :
                    syncStatus === 'synced' ? 'bg-emerald-500' :
                    syncStatus === 'pending' ? 'bg-amber-500' :
                    syncStatus === 'offline-saved' ? 'bg-amber-500' : 'bg-slate-400'
                  }`}></span>
                </span>
              </div>
              <div className="flex flex-col text-right select-none">
                <span className="text-[9px] font-bold text-slate-400 leading-none">مزامنة السحاب</span>
                <span className="text-[11px] font-black text-slate-700 mt-0.5 leading-none">
                  {syncStatus === 'syncing' ? 'جاري المزامنة...' :
                   syncStatus === 'synced' ? 'تم الحفظ والمزامنة' :
                   syncStatus === 'pending' ? 'تعديلات بانتظار الاتصال' :
                   syncStatus === 'offline-saved' ? 'محلي (أوفلاين آمن)' : 'مزامنة معطلة'}
                </span>
              </div>
            </div>

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-400">تاريخ اليوم</span>
              <span className="text-sm font-bold text-slate-600">
                {new Date().toLocaleDateString('ar-EG', { numberingSystem: 'latn',
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-16 sm:top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
              currentUser.role !== 'viewer' && { id: 'subscribers', label: 'المشتركون والذمم', icon: Users },
              currentUser.role !== 'viewer' && { id: 'payments', label: 'المدفوعات', icon: Coins },
              currentUser.role !== 'viewer' && { id: 'new-invoice', label: 'إصدار فاتورة جديدة', icon: Calculator },
              currentUser.role !== 'viewer' && { id: 'composite-invoice', label: 'فاتورة كهرباء مركبة', icon: Layers },
              currentUser.role !== 'viewer' && { id: 'expenses', label: 'إدارة وتوزيع المصاريف', icon: Coins },
              { id: 'invoices-history', label: 'أرشيف الفواتير', icon: FileText },
              { id: 'reports', label: 'التقارير والإحصائيات', icon: FileBarChart2 },
              { id: 'notifications', label: 'الإشعارات والمراسلات', icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined },
              currentUser.role === 'admin' && { id: 'users', label: 'إدارة المستخدمين', icon: UserPlus },
              currentUser.role === 'admin' && { id: 'settings', label: 'الإعدادات العامة', icon: Settings },
              currentUser.role === 'admin' && { id: 'backup-settings', label: 'النسخ والإعدادات', icon: Database },
            ].filter((t): t is Exclude<typeof t, false> => Boolean(t)).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer select-none relative ${
                    isActive
                      ? 'text-blue-600 bg-blue-50/70 border border-blue-100/30'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {'badge' in tab && tab.badge !== undefined && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-rose-500 text-white rounded-full font-black animate-pulse leading-none">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 sm:space-y-8 pb-12"
          >
            {activeTab === 'dashboard' && renderDashboard()}

            {activeTab === 'subscribers' && currentUser.role !== 'viewer' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <SubscribersList
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  usersList={usersList}
                  onAddSubscriber={handleAddSubscriber}
                  onDeleteSubscriber={handleDeleteSubscriber}
                  onRecordPayment={handleRecordPayment}
                  onUpdateSubscriber={handleUpdateSubscriber}
                  groupsList={groupsList}
                  onAddGroup={handleAddGroup}
                  onEditGroup={handleEditGroup}
                  onDeleteGroup={handleDeleteGroup}
                  defaultCurrency={defaultCurrency}
                  currentUserRole={currentUser.role}
                  whatsappReminderEnabled={whatsappReminderEnabled}
                  whatsappReminderThreshold={whatsappReminderThreshold}
                  whatsappReminderTemplate={whatsappReminderTemplate}
                  billSettings={currentUser.billSettings}
                  onDeleteInvoice={handleDeleteInvoice}
                  onDeletePayment={handleDeletePayment}
                />
              </div>
            )}

            {activeTab === 'payments' && currentUser.role !== 'viewer' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <PaymentsList
                  subscribers={filteredSubscribers}
                  payments={filteredPayments}
                  invoices={filteredInvoices}
                  groupsList={groupsList}
                  onRecordPayment={handleRecordPayment}
                  onDeletePayment={handleDeletePayment}
                  defaultCurrency={defaultCurrency}
                  currentUserRole={currentUser.role}
                  billSettings={currentUser.billSettings}
                />
              </div>
            )}

            {activeTab === 'new-invoice' && currentUser.role !== 'viewer' && (
              <div className="max-w-4xl mx-auto">
                <NewInvoiceForm
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  groupsList={groupsList}
                  onSaveInvoice={handleSaveInvoice}
                  onAddSubscriberInline={(name) => handleAddSubscriber(name)}
                  defaultCurrency={defaultCurrency}
                  defaultPricePerKwh={defaultPricePerKwh}
                />
              </div>
            )}

            {activeTab === 'composite-invoice' && currentUser.role !== 'viewer' && (
              <div className="max-w-5xl mx-auto">
                <CompositeInvoiceForm
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  groupsList={groupsList}
                  onSaveMultipleInvoices={handleSaveMultipleInvoices}
                  defaultCurrency={defaultCurrency}
                  defaultPricePerKwh={defaultPricePerKwh}
                />
              </div>
            )}

            {activeTab === 'invoices-history' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <InvoicesHistory
                  invoices={filteredInvoices}
                  subscribers={filteredSubscribers}
                  onDeleteInvoice={handleDeleteInvoice}
                  defaultCurrency={defaultCurrency}
                  currentUserRole={currentUser.role}
                  billSettings={currentUser.billSettings}
                />
              </div>
            )}

            {activeTab === 'expenses' && currentUser.role !== 'viewer' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <ExpenseManagement
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  groupsList={groupsList}
                  defaultCurrency={defaultCurrency}
                  onAddExpense={handleAddExpense}
                  onDeleteInvoice={handleDeleteInvoice}
                  currentUserRole={currentUser.role}
                />
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <Reports
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  groupsList={groupsList}
                  defaultCurrency={defaultCurrency}
                  billSettings={currentUser.billSettings}
                  onAddExpense={handleAddExpense}
                  onDeleteInvoice={handleDeleteInvoice}
                  currentUserRole={currentUser.role}
                />
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="max-w-4xl mx-auto">
                <Notifications
                  currentUser={currentUser}
                  usersList={usersList}
                  notifications={notifications}
                  onUpdateNotifications={handleUpdateNotifications}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto">
                <GeneralSettings
                  defaultCurrency={defaultCurrency}
                  currencies={currencies}
                  defaultPricePerKwh={defaultPricePerKwh}
                  whatsappReminderEnabled={whatsappReminderEnabled}
                  whatsappReminderThreshold={whatsappReminderThreshold}
                  whatsappReminderTemplate={whatsappReminderTemplate}
                  currentUser={currentUser}
                  autoSyncEnabled={autoSyncEnabled}
                  onUpdateAutoSync={handleUpdateAutoSync}
                  onUpdateBillSettings={handleUpdateBillSettings}
                  onUpdateDefaultCurrency={handleUpdateDefaultCurrency}
                  onUpdateCurrencies={handleUpdateCurrencies}
                  onUpdateDefaultPrice={handleUpdateDefaultPrice}
                  onUpdateWhatsappReminderEnabled={handleUpdateWhatsappReminderEnabled}
                  onUpdateWhatsappReminderThreshold={handleUpdateWhatsappReminderThreshold}
                  onUpdateWhatsappReminderTemplate={handleUpdateWhatsappReminderTemplate}
                />
              </div>
            )}

            {activeTab === 'backup-settings' && (
              <div className="max-w-3xl mx-auto">
                <BackupRestore
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  onImportData={handleImportData}
                  onClearAllData={handleClearAllData}
                  autoSyncEnabled={autoSyncEnabled}
                  onUpdateAutoSync={handleUpdateAutoSync}
                  usersList={usersList}
                  onUpdateUsersList={setUsersList}
                  notifications={notifications}
                  onUpdateNotifications={setNotifications}
                  activityLogs={activityLogs}
                  onUpdateActivityLogs={setActivityLogs}
                  groupsList={groupsList}
                  onUpdateGroupsList={setGroupsList}
                />
              </div>
            )}

            {activeTab === 'users' && currentUser.role === 'admin' && (
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-sm">
                <UserManagement
                  usersList={usersList}
                  currentUser={currentUser}
                  subscribers={subscribers}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  activityLogs={activityLogs}
                  onClearActivityLogs={handleClearActivityLogs}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- REAL-TIME TOAST ALERT FOR NEW INCOMING MESSAGES --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, x: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed bottom-6 right-6 z-50 w-[92%] sm:w-96 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl shadow-slate-950/20 border border-slate-800 p-4 flex gap-3 text-right items-start"
            style={{ direction: 'rtl' }}
          >
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl mt-0.5 animate-pulse shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black text-blue-400">
                  إشعار جديد وارد!
                </h4>
                <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
                  من: {toast.senderName}
                </span>
              </div>
              <p className="text-xs font-black text-slate-100 mt-1.5 line-clamp-1">{toast.title}</p>
              <p className="text-[11px] font-medium text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
              
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                <button
                  onClick={() => {
                    setActiveTab('notifications');
                    setToast(null);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-lg transition-all cursor-pointer shadow-md shadow-blue-500/10 active:scale-95"
                >
                  عرض في صندوق الوارد
                </button>
                <button
                  onClick={() => setToast(null)}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                >
                  تجاهل
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- GROUP DETAILS MODAL --- */}
      <AnimatePresence>
        {selectedDetailGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailGroup(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-3xl border-2 border-slate-700 dark:border-slate-500 shadow-2xl p-6 sm:p-8 text-right overflow-hidden z-10"
              style={{ direction: 'rtl' }}
            >
              {/* Decorative top strip */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedDetailGroup(null)}
                className="absolute top-5 left-5 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full transition-all cursor-pointer border-2 border-slate-700 dark:border-slate-500"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100 dark:border-slate-900">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl border-2 border-slate-700 dark:border-slate-500 shrink-0">
                  <Tags className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100">
                    تفاصيل المشتركين في {selectedDetailGroup}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    كشف بجميع المشتركين المسجلين في هذه المجموعة وحالة أرصدتهم وديونهم الفردية الحالية
                  </p>
                </div>
              </div>

              {/* Group Subscribers List */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {subscribers.filter((s) => s.groups?.includes(selectedDetailGroup)).length === 0 ? (
                  <div className="text-center py-10 text-sm text-slate-400 font-bold">
                    لا يوجد مشتركين مسجلين في هذه المجموعة حالياً.
                  </div>
                ) : (
                  subscribers
                    .filter((s) => s.groups?.includes(selectedDetailGroup))
                    .map((sub) => {
                      const stats = calculateSubscriberStats(sub, invoices, payments);
                      const isOverdue = stats.remainingDebt > 0;
                      const isCredit = stats.remainingDebt < 0;

                      return (
                        <div
                          key={sub.id}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-700 dark:border-slate-600 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all hover:bg-slate-100/50 dark:hover:bg-slate-900/80"
                        >
                          <div className="space-y-1 text-right">
                            <div className="flex items-center gap-2 justify-start sm:justify-start">
                              <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                                {sub.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono">
                                #{sub.subNumber}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                              العداد الفرعي: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{sub.subMeterId || 'غير محدد'}</span>
                              {sub.phone && (
                                <span className="mr-3">
                                  الهاتف: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{sub.phone}</span>
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 justify-end">
                            {/* Breakdown */}
                            <div className="text-right shrink-0">
                              <span className="text-[9px] text-slate-400 font-bold block">
                                فواتير: {stats.totalDebt} {defaultCurrency} • مسدد: {stats.totalPaid} {defaultCurrency}
                              </span>
                              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                <span className="text-[10px] text-slate-400 font-bold">الرصيد الحالي:</span>
                                <span
                                  className={`text-xs font-black font-mono px-2 py-0.5 rounded-md border ${
                                    isOverdue
                                      ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40'
                                      : isCredit
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}
                                >
                                  {isOverdue && '+'}
                                  {stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                                </span>
                              </div>
                            </div>

                            {/* Status Indicator Pill */}
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 border ${
                                isOverdue
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
                                  : isCredit
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {isOverdue ? 'مترتب عليه ديون' : isCredit ? 'رصيد زائد / دائن' : 'خالص الذمة'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Close Bottom Area */}
              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-900 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDetailGroup(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-700 dark:border-slate-500 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FLOATING QUICK ACTIONS MENU (FAB) --- */}
      {currentUser.role !== 'viewer' && (
        <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3" style={{ direction: 'rtl' }}>
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.8 }}
                className="flex flex-col gap-2.5 items-start pl-1"
              >
                {/* Action 1: Add Payment */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setQuickPaymentOpen(true);
                    setIsFabOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg border border-emerald-500 font-black text-xs cursor-pointer transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  <span>تسجيل دفعة سريعة</span>
                </motion.button>

                {/* Action 2: Issue Invoice */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setQuickInvoiceOpen(true);
                    setIsFabOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg border border-blue-500 font-black text-xs cursor-pointer transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  <span>إصدار فاتورة جديدة</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsFabOpen(!isFabOpen)}
            className="w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center border-2 border-slate-700 cursor-pointer relative group focus:outline-none"
            title="إجراءات سريعة"
          >
            <motion.div
              animate={{ rotate: isFabOpen ? 135 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Plus className="w-7 h-7" />
            </motion.div>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
              إجراءات سريعة
            </span>
          </motion.button>
        </div>
      )}

      {/* --- QUICK INVOICE MODAL --- */}
      <AnimatePresence>
        {quickInvoiceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickInvoiceOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-950 rounded-3xl border-2 border-slate-700 dark:border-slate-500 shadow-2xl p-6 sm:p-8 text-right overflow-hidden z-10"
              style={{ direction: 'rtl' }}
            >
              {/* Decorative top strip */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setQuickInvoiceOpen(false)}
                className="absolute top-5 left-5 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full transition-all cursor-pointer border-2 border-slate-700 dark:border-slate-500"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100 dark:border-slate-900">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border-2 border-slate-700 dark:border-slate-500 shrink-0">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100">
                    إصدار فاتورة جديدة (سريع)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    قم باحتساب وإصدار فاتورة جديدة لأي مشترك أو مجموعة بنقرة واحدة
                  </p>
                </div>
              </div>

              {/* New Invoice Form */}
              <div className="max-h-[70vh] overflow-y-auto px-1">
                <NewInvoiceForm
                  subscribers={filteredSubscribers}
                  invoices={filteredInvoices}
                  payments={filteredPayments}
                  groupsList={groupsList}
                  onSaveInvoice={(invoice) => {
                    handleSaveInvoice(invoice);
                    setQuickInvoiceOpen(false);
                  }}
                  onAddSubscriberInline={(name) => handleAddSubscriber(name)}
                  defaultCurrency={defaultCurrency}
                  defaultPricePerKwh={defaultPricePerKwh}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- QUICK PAYMENT MODAL --- */}
      <AnimatePresence>
        {quickPaymentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setQuickPaymentOpen(false);
                setQuickPaySubId('');
                setQuickPayAmount('');
                setQuickPayNotes('');
                setQuickPaySearch('');
                setQuickPayError('');
                setQuickPaySuccess('');
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-3xl border-2 border-slate-700 dark:border-slate-500 shadow-2xl p-6 sm:p-8 text-right overflow-hidden z-10"
              style={{ direction: 'rtl' }}
            >
              {/* Decorative top strip */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setQuickPaymentOpen(false);
                  setQuickPaySubId('');
                  setQuickPayAmount('');
                  setQuickPayNotes('');
                  setQuickPaySearch('');
                  setQuickPayError('');
                  setQuickPaySuccess('');
                }}
                className="absolute top-5 left-5 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full transition-all cursor-pointer border-2 border-slate-700 dark:border-slate-500"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100 dark:border-slate-900">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl border-2 border-slate-700 dark:border-slate-500 shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100">
                    تسجيل دفعة سريعة (سداد)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    قم بتسجيل سداد مالي أو دفعة لأي مشترك مباشرةً دون مغادرة الصفحة
                  </p>
                </div>
              </div>

              {quickPaySuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-black text-slate-950 dark:text-white">تم تسجيل الدفعة بنجاح!</h4>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300 max-w-sm">
                    {quickPaySuccess}
                  </p>
                </motion.div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!quickPaySubId) {
                      setQuickPayError('الرجاء اختيار المشترك أولاً من القائمة');
                      return;
                    }
                    const parsedAmount = parseFloat(quickPayAmount);
                    if (isNaN(parsedAmount) || parsedAmount <= 0) {
                      setQuickPayError('الرجاء إدخال مبلغ صحيح أكبر من صفر');
                      return;
                    }

                    handleRecordPayment(quickPaySubId, parsedAmount, quickPayNotes.trim() || undefined);

                    const targetSub = subscribers.find((s) => s.id === quickPaySubId);
                    setQuickPaySuccess(`تم تسجيل دفعة مالية بقيمة ${parsedAmount.toLocaleString('en-US')} ${defaultCurrency} للمشترك "${targetSub?.name || ''}" بنجاح.`);
                    setQuickPayError('');

                    setTimeout(() => {
                      setQuickPaymentOpen(false);
                      setQuickPaySubId('');
                      setQuickPayAmount('');
                      setQuickPayNotes('');
                      setQuickPaySearch('');
                      setQuickPayError('');
                      setQuickPaySuccess('');
                    }, 2000);
                  }}
                  className="space-y-5 text-right"
                >
                  {/* Select Subscriber Section */}
                  <div className="space-y-2 relative">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                      المشترك المستهدف *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث باسم المشترك أو برقم الاشتراك..."
                        value={quickPaySearch}
                        onChange={(e) => {
                          setQuickPaySearch(e.target.value);
                          if (quickPaySubId) {
                            setQuickPaySubId('');
                          }
                        }}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-400 focus:bg-white transition-all text-slate-700 dark:text-slate-200 text-right"
                      />
                      <Users className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    </div>

                    {/* Subscriber Dropdown list */}
                    {!quickPaySubId && quickPaySearch.trim().length > 0 && (
                      <div className="absolute z-20 top-full inset-x-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                        {subscribers
                          .filter((s) =>
                            s.name.toLowerCase().includes(quickPaySearch.toLowerCase()) ||
                            s.subNumber.toLowerCase().includes(quickPaySearch.toLowerCase())
                          )
                          .slice(0, 8)
                          .map((sub) => {
                            const subStats = calculateSubscriberStats(sub, invoices, payments);
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setQuickPaySubId(sub.id);
                                  setQuickPaySearch(`${sub.name}`);
                                }}
                                className="w-full text-right px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                              >
                                <span>{sub.name} <span className="text-[10px] text-slate-400 font-mono">#{sub.subNumber}</span></span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${subStats.remainingDebt > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'}`}>
                                  ذمة: {subStats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                                </span>
                              </button>
                            );
                          })}
                        {subscribers.filter((s) =>
                          s.name.toLowerCase().includes(quickPaySearch.toLowerCase()) ||
                          s.subNumber.toLowerCase().includes(quickPaySearch.toLowerCase())
                        ).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400 font-bold">
                            لا يوجد مشتركين مطابقين للبحث
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Amount */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                        قيمة الدفعة *
                      </label>
                      {quickPaySubId && (
                        <span className="text-[10px] text-slate-400 font-bold">
                          المتبقي: {
                            calculateSubscriberStats(
                              subscribers.find((s) => s.id === quickPaySubId)!,
                              invoices,
                              payments
                            ).remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })
                          } {defaultCurrency}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="أدخل قيمة المبلغ المسدد..."
                        value={quickPayAmount}
                        onChange={(e) => setQuickPayAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-700 dark:text-slate-200 text-right"
                      />
                      <span className="absolute left-4 top-3 text-xs font-black text-slate-500 font-mono">
                        {defaultCurrency}
                      </span>
                    </div>

                    {/* Quick amount buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[50, 100, 150, 200, 300, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setQuickPayAmount(amt.toString())}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Notes */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                      ملاحظات أو تفاصيل السداد
                    </label>
                    <textarea
                      placeholder="أدخل أي ملاحظات مرافقة لعملية الدفع (مثل: نقداً، شيك رقم ...، دفعة عن شهر ...)"
                      value={quickPayNotes}
                      onChange={(e) => setQuickPayNotes(e.target.value)}
                      rows={2}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-700 dark:text-slate-200 text-right resize-none"
                    />
                  </div>

                  {/* Error Box */}
                  {quickPayError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{quickPayError}</span>
                    </div>
                  )}

                  {/* Submit buttons */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-900 flex justify-between gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95 text-center"
                    >
                      تسجيل وحفظ الدفعة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPaymentOpen(false);
                        setQuickPaySubId('');
                        setQuickPayAmount('');
                        setQuickPayNotes('');
                        setQuickPaySearch('');
                        setQuickPayError('');
                        setQuickPaySuccess('');
                      }}
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
