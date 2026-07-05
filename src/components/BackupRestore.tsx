/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Subscriber, Invoice, Payment, User, Notification, ActivityLog } from '../types';
import { 
  exportDataAsJSON, 
  importDataFromJSON, 
  ImportResult,
  uploadToGoogleDrive,
  fetchBackupFilesFromGoogleDrive,
  downloadFileFromGoogleDrive
} from '../utils/storage';
import {
  isFirebaseAvailable,
  uploadAllDataToFirebase,
  downloadAllDataFromFirebase
} from '../lib/firebase';
import { 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  ExternalLink, 
  Key, 
  FileText, 
  Check, 
  Info,
  Database,
  Shield,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BackupRestoreProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  onImportData: (subscribers: Subscriber[], invoices: Invoice[], payments: Payment[]) => void;
  onClearAllData: () => void;
  autoSyncEnabled: boolean;
  onUpdateAutoSync: (enabled: boolean) => void;
  // Firebase specific props
  usersList?: User[];
  onUpdateUsersList?: (users: User[]) => void;
  notifications?: Notification[];
  onUpdateNotifications?: (notifications: Notification[]) => void;
  activityLogs?: ActivityLog[];
  onUpdateActivityLogs?: (logs: ActivityLog[]) => void;
  groupsList?: string[];
  onUpdateGroupsList?: (groups: string[]) => void;
}

export default function BackupRestore({
  subscribers,
  invoices,
  payments,
  onImportData,
  onClearAllData,
  autoSyncEnabled,
  onUpdateAutoSync,
  usersList,
  onUpdateUsersList,
  notifications,
  onUpdateNotifications,
  activityLogs,
  onUpdateActivityLogs,
  groupsList,
  onUpdateGroupsList,
}: BackupRestoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Firebase Sync States
  const [firebaseSyncEnabled, setFirebaseSyncEnabled] = useState(() => {
    return localStorage.getItem('firebase_auto_sync') === 'true';
  });
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);
  const [firebaseLastSynced, setFirebaseLastSynced] = useState(() => {
    return localStorage.getItem('firebase_last_synced_time') || '';
  });

  // Connection & Sync States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncMethod = autoSyncEnabled ? 'cloud' : 'local';

  // Google Drive Credentials & Token States
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('meter_gdrive_client_id') || '';
  });
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveToken, setDriveToken] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  
  // Backups listed from Google Drive
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check and parse Google Drive token from localStorage
  useEffect(() => {
    const token = localStorage.getItem('gdrive_access_token');
    const expiry = localStorage.getItem('gdrive_token_expiry');
    
    if (token && expiry) {
      if (Date.now() < parseInt(expiry, 10)) {
        setIsDriveConnected(true);
        setDriveToken(token);
        // Load backups if online
        if (navigator.onLine) {
          loadCloudBackupsList(token);
        }
      } else {
        // Expired
        localStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('gdrive_token_expiry');
        setIsDriveConnected(false);
        setDriveToken('');
      }
    }
  }, [isOnline]);

  // Load backups list from Google Drive
  const loadCloudBackupsList = async (tokenStr: string) => {
    const currentToken = tokenStr || driveToken;
    if (!currentToken) return;
    setLoadingBackups(true);
    try {
      const files = await fetchBackupFilesFromGoogleDrive(currentToken);
      setCloudBackups(files);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  // Connect Google Drive (OAuth 2.0 Implicit Flow)
  const handleConnectDrive = () => {
    if (!clientId.trim()) {
      setActionStatus({ success: false, message: 'يرجى إدخال معرف العميل (Client ID) أولاً لإتمام عملية الربط.' });
      return;
    }

    // Save client ID
    localStorage.setItem('meter_gdrive_client_id', clientId.trim());

    // Build authorization request URL
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = 'https://www.googleapis.com/auth/drive.file';
    const state = 'gdrive_sync';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(state)}&` +
      `prompt=select_account`;

    // Redirect to google consent screen
    window.location.href = authUrl;
  };

  const handleDisconnectDrive = () => {
    localStorage.removeItem('gdrive_access_token');
    localStorage.removeItem('gdrive_token_expiry');
    setIsDriveConnected(false);
    setDriveToken('');
    setCloudBackups([]);
    setActionStatus({ success: true, message: 'تم قطع الاتصال بحساب Google Drive بنجاح.' });
    setTimeout(() => setActionStatus(null), 4000);
  };

  // Handle Sync Method Change
  const handleSyncMethodChange = (method: 'local' | 'cloud') => {
    onUpdateAutoSync(method === 'cloud');
    if (method === 'cloud') {
      setActionStatus({ 
        success: true, 
        message: 'تم تفعيل المزامنة التلقائية! سيقوم التطبيق برفع نسخة مشفرة وآمنة سحابياً كلما توفر الإنترنت وحدث تغيير في البيانات.' 
      });
    } else {
      setActionStatus({ 
        success: true, 
        message: 'تم التحويل للوضع المحلي فقط بنجاح. البيانات لن ترفع للسحاب وستحفظ محلياً على جهازك.' 
      });
    }
    setTimeout(() => setActionStatus(null), 5000);
  };

  // Perform Manual Google Drive Backup
  const handleCloudBackup = async () => {
    if (!isDriveConnected || !driveToken) {
      setActionStatus({ success: false, message: 'الرجاء ربط حساب Google Drive أولاً لتتمكن من النسخ السحابي.' });
      return;
    }

    setIsSyncing(true);
    try {
      const jsonString = exportDataAsJSON(subscribers, invoices, payments);
      const fileName = `نسخة_احتياطية_العداد_الرئيسي_${new Date().toISOString().split('T')[0]}.json`;
      
      await uploadToGoogleDrive(driveToken, jsonString, fileName);
      
      // Save last synced info
      const nowString = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
      localStorage.setItem('gdrive_last_synced_time', nowString);
      localStorage.setItem('meter_unsynced_changes_exist', 'false');

      setActionStatus({ success: true, message: `🎉 تم رفع النسخة الاحتياطية بنجاح إلى Google Drive باسم: ${fileName}` });
      loadCloudBackupsList(driveToken);
    } catch (err: any) {
      setActionStatus({ success: false, message: err.message || 'حدث خطأ أثناء الاتصال بسيرفرات جوجل.' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  // Restore backup from Google Drive file
  const handleCloudRestore = async (fileId: string, fileName: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في استعادة النسخة الاحتياطية "${fileName}"؟ سيؤدي ذلك لاستبدال البيانات الحالية.`)) {
      return;
    }

    setLoadingBackups(true);
    try {
      const text = await downloadFileFromGoogleDrive(driveToken, fileId);
      const result: ImportResult = importDataFromJSON(text);

      if (result.success && result.subscribers) {
        onImportData(
          result.subscribers,
          result.invoices || [],
          result.payments || []
        );
        setActionStatus({
          success: true,
          message: `🎉 تم استعادة البيانات بنجاح من Google Drive وتحديث كافة الحسابات والديون!`,
        });
      } else {
        setActionStatus({
          success: false,
          message: result.message,
        });
      }
    } catch (err: any) {
      setActionStatus({
        success: false,
        message: err.message || 'فشل في استيراد البيانات من السحاب.',
      });
    } finally {
      setLoadingBackups(false);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  // Local JSON File export
  const handleExport = () => {
    const jsonString = exportDataAsJSON(subscribers, invoices, payments);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نسخة_احتياطية_العداد_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Local JSON File import
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result: ImportResult = importDataFromJSON(text);

      if (result.success && result.subscribers) {
        onImportData(
          result.subscribers,
          result.invoices || [],
          result.payments || []
        );
        setImportStatus({
          success: true,
          message: 'تم استعادة النسخة الاحتياطية بنجاح وتحديث كافة الحسابات والديون!',
        });
      } else {
        setImportStatus({
          success: false,
          message: result.message,
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Hide message after 5 seconds
      setTimeout(() => setImportStatus(null), 5000);
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    onClearAllData();
    setShowClearConfirm(false);
  };

  const handleToggleFirebaseAutoSync = () => {
    const newVal = !firebaseSyncEnabled;
    setFirebaseSyncEnabled(newVal);
    localStorage.setItem('firebase_auto_sync', newVal ? 'true' : 'false');
    
    setActionStatus({
      success: true,
      message: newVal 
        ? 'تم تفعيل التزامن التلقائي مع Firebase! سيتم مزامنة أي تعديلات تقوم بها لحظياً مع السحاب.'
        : 'تم تعطيل التزامن التلقائي مع Firebase.'
    });
    setTimeout(() => setActionStatus(null), 5000);
  };

  const handleFirebaseUploadAll = async () => {
    setIsFirebaseSyncing(true);
    setActionStatus(null);
    try {
      const res = await uploadAllDataToFirebase(
        subscribers,
        invoices,
        payments,
        usersList || [],
        notifications || [],
        activityLogs || [],
        groupsList || []
      );
      
      if (res.success) {
        const nowStr = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
        localStorage.setItem('firebase_last_synced_time', nowStr);
        setFirebaseLastSynced(nowStr);
        setActionStatus({ success: true, message: res.message });
      } else {
        setActionStatus({ success: false, message: res.message });
      }
    } catch (err: any) {
      setActionStatus({ success: false, message: err.message || 'حدث خطأ أثناء الرفع إلى فايربيس.' });
    } finally {
      setIsFirebaseSyncing(false);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  const handleFirebaseDownloadAll = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في تنزيل البيانات من Firebase واستبدال كافة بياناتك المحلية الحالية؟ لا يمكن التراجع عن هذه الخطوة.')) {
      return;
    }
    
    setIsFirebaseSyncing(true);
    setActionStatus(null);
    try {
      const res = await downloadAllDataFromFirebase();
      if (res.success && res.data) {
        const d = res.data;
        // Import data using props callbacks
        onImportData(d.subscribers, d.invoices, d.payments);
        
        if (onUpdateUsersList && d.users.length > 0) {
          onUpdateUsersList(d.users);
        }
        if (onUpdateNotifications && d.notifications.length > 0) {
          onUpdateNotifications(d.notifications);
        }
        if (onUpdateActivityLogs && d.activityLogs.length > 0) {
          onUpdateActivityLogs(d.activityLogs);
        }
        if (onUpdateGroupsList && d.groups.length > 0) {
          onUpdateGroupsList(d.groups);
        }

        const nowStr = new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' });
        localStorage.setItem('firebase_last_synced_time', nowStr);
        setFirebaseLastSynced(nowStr);
        setActionStatus({ success: true, message: res.message });
      } else {
        setActionStatus({ success: false, message: res.message });
      }
    } catch (err: any) {
      setActionStatus({ success: false, message: err.message || 'حدث خطأ أثناء التنزيل من فايربيس.' });
    } finally {
      setIsFirebaseSyncing(false);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-8 text-right" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600" />
          النسخ الاحتياطي والمزامنة الذكية
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          تحكّم بأسلوب حفظ بياناتك وتعديلاتها، مع إمكانية المزامنة السحابية المتقدمة وحفظ النسخ محلياً أو على Google Drive لحمايتها من الفقدان.
        </p>
      </div>

      {/* Real-time Connection Status Card */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isOnline 
          ? 'bg-emerald-50/30 border-emerald-100 text-emerald-900' 
          : 'bg-amber-50/40 border-amber-100 text-amber-950'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-emerald-100/60 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              {isOnline ? <Wifi className="w-5 h-5 animate-pulse" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">حالة الاتصال بالشبكة</span>
              <h4 className="font-extrabold text-sm sm:text-base mt-0.5">
                {isOnline ? 'جهازك متصل بالإنترنت الآن' : 'جهازك يعمل دون اتصال بالإنترنت (Offline Mode)'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isOnline 
                  ? 'يمكنك الآن تفعيل المزامنة التلقائية والرفع الفوري على Google Drive.' 
                  : 'جميع بياناتك وتعديلاتك آمنة تماماً وتُحفظ لحظياً على جهازك المحلي، وسيتم مزامنتها بمجرد اتصالك بالإنترنت.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className={`flex h-3 w-3 relative ${isOnline ? 'block' : 'hidden'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white border border-slate-100 shadow-sm">
              {isOnline ? 'متصل سحابياً' : 'وضع غير متصل'}
            </span>
          </div>
        </div>
      </div>

      {/* Sync Method Selection Section */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-700 text-base flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-500" />
          اختيار أسلوب مزامنة البيانات
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option A: Local Storage (Offline First) */}
          <button
            type="button"
            onClick={() => handleSyncMethodChange('local')}
            className={`p-5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden ${
              syncMethod === 'local'
                ? 'bg-blue-50/30 border-blue-200 shadow-sm shadow-blue-500/5 ring-1 ring-blue-100'
                : 'bg-white border-slate-100 hover:border-slate-200'
            }`}
          >
            {syncMethod === 'local' && (
              <span className="absolute top-0 left-0 bg-blue-600 text-white p-1 rounded-br-2xl">
                <Check className="w-4.5 h-4.5" />
              </span>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${syncMethod === 'local' ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                  <Database className="w-4.5 h-4.5" />
                </div>
                <span className="font-extrabold text-sm text-slate-800">حفظ محلي فقط (أوفلاين - أمان تام)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                تخزين محلي فوري على متصفح جهازك الحالي فقط. هذا الخيار يحافظ على خصوصيتك المطلقة ويعمل بسرعة فائقة بدون إنترنت، دون مشاركة البيانات سحابياً.
              </p>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-100/50 px-2.5 py-1 rounded-lg self-start">
              موصى به للأمان والخصوصية الفائقة
            </span>
          </button>

          {/* Option B: Cloud Sync (Auto-Sync) */}
          <button
            type="button"
            onClick={() => handleSyncMethodChange('cloud')}
            className={`p-5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden ${
              syncMethod === 'cloud'
                ? 'bg-emerald-50/30 border-emerald-200 shadow-sm shadow-emerald-500/5 ring-1 ring-emerald-100'
                : 'bg-white border-slate-100 hover:border-slate-200'
            }`}
          >
            {syncMethod === 'cloud' && (
              <span className="absolute top-0 left-0 bg-emerald-600 text-white p-1 rounded-br-2xl">
                <Check className="w-4.5 h-4.5" />
              </span>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${syncMethod === 'cloud' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                  <Cloud className="w-4.5 h-4.5" />
                </div>
                <span className="font-extrabold text-sm text-slate-800">مزامنة سحابية تلقائية (Google Drive)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                حفظ نسختك آلياً في السحاب بمجرد توفر الإنترنت. يتم تحديث السجل المشفر على Google Drive الخاص بك تلقائياً لحمايته من أي عطل في جهازك.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/50 px-2.5 py-1 rounded-lg self-start">
              موصى به لتجنب ضياع البيانات والتزامن المستمر
            </span>
          </button>
        </div>
      </div>

      {/* Action Alerts Block */}
      <AnimatePresence>
        {actionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-start gap-2.5 p-4 rounded-xl border text-xs sm:text-sm ${
              actionStatus.success
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}
          >
            {actionStatus.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            )}
            <div>
              <p className="font-bold">{actionStatus.success ? 'مكتمل بنجاح' : 'تنبيه النظام'}</p>
              <p className="mt-1 leading-relaxed">{actionStatus.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Firebase Cloud Sync Block */}
      <div className="border border-slate-100 rounded-2xl p-5 space-y-6 bg-emerald-50/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Shield className="w-5.5 h-5.5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm sm:text-base">بوابة التزامن والنسخ السحابي الفوري (Firebase Firestore)</h3>
              <p className="text-xs text-slate-400 mt-0.5">مزامنة حية وتلقائية للبيانات وقاعدة المشتركين والحسابات المالية عبر خوادم السحاب بشكل آمن.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isFirebaseAvailable() ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100/50 px-3 py-1.5 rounded-xl border border-emerald-100">
                🟢 متصل بـ Firebase
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                🔴 غير مهيأ بعد
              </span>
            )}
          </div>
        </div>

        {/* Firebase control actions */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 block">وضع التزامن التلقائي مع Firebase</span>
              <p className="text-xs text-slate-400">عند تفعيل المزامنة، سيتم رفع أي تعديل تقوم به على المشتركين أو الفواتير والمدفوعات إلى السحابة فوراً.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleFirebaseAutoSync}
                className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  firebaseSyncEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {firebaseSyncEnabled ? 'تعطيل المزامنة التلقائية 🔴' : 'تفعيل المزامنة التلقائية 🟢'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100/60">
            {/* Action 1: Bulk upload local data */}
            <button
              type="button"
              onClick={handleFirebaseUploadAll}
              disabled={isFirebaseSyncing || !isFirebaseAvailable()}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {isFirebaseSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              <span>رفع وتثبيت البيانات المحلية إلى السحاب 📤</span>
            </button>

            {/* Action 2: Bulk download data */}
            <button
              type="button"
              onClick={handleFirebaseDownloadAll}
              disabled={isFirebaseSyncing || !isFirebaseAvailable()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {isFirebaseSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>تنزيل واستعادة البيانات من السحاب 📥</span>
            </button>
          </div>

          {firebaseLastSynced && (
            <p className="text-[10px] text-slate-400 font-bold text-center mt-2">
              آخر تزامن ناجح مع Firebase: <span className="font-mono text-slate-600">{firebaseLastSynced}</span>
            </p>
          )}
        </div>
      </div>

      {/* Google Drive Integration & Storage */}
      <div className="border border-slate-100 rounded-2xl p-5 space-y-6 bg-slate-50/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Cloud className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm sm:text-base">بوابة المزامنة مع Google Drive</h3>
              <p className="text-xs text-slate-400 mt-0.5">اربط تطبيقك بمساحتك الخاصة لحفظ واستيراد النسخ الاحتياطية سحابياً.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isDriveConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100/50 px-3 py-1.5 rounded-xl border border-emerald-100">
                  🟢 متصل بـ Google Drive
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  قطع الاتصال 🔌
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                🔴 غير متصل بسحابة جوجل
              </span>
            )}
          </div>
        </div>

        {/* Credentials Form / Connection Actions */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="max-w-xl space-y-2">
            <label className="text-xs font-black text-slate-700 block">معرّف عميل جوجل لربط التطبيق (Google Client ID)</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Key className="absolute right-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="أدخل معرّف OAuth Client ID (مثل: 123456-abcde.apps.googleusercontent.com)"
                  className="w-full text-left font-mono pr-10 pl-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  الاتصال بالحساب 🔗
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                  title="دليل الإعداد خطوة بخطوة"
                >
                  <Info className="w-4 h-4" />
                  {showGuide ? 'إغلاق الدليل' : 'دليل الإعداد'}
                </button>
              </div>
            </div>
          </div>

          {/* Guide Steps (Arabic explanation) */}
          <AnimatePresence>
            {showGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-xs text-slate-600 space-y-3 leading-relaxed">
                  <h5 className="font-extrabold text-blue-800 text-sm">كيفية الحصول على Google Client ID وتجهيزه مجاناً (خلال دقيقة):</h5>
                  <ol className="list-decimal list-inside space-y-1.5 pr-2">
                    <li>اذهب إلى منصة مطوري جوجل: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                    <li>أنشئ مشروعاً جديداً (New Project) أو اختر مشروعاً قائماً.</li>
                    <li>اذهب إلى تبويب <strong>OAuth consent screen</strong>، اختر نوع المطور الخارجي (External)، وحدد اسم التطبيق واكتب بريدك الإلكتروني كمسؤول.</li>
                    <li>اذهب إلى تبويب <strong>Credentials</strong>، واضغط على <strong>+ Create Credentials</strong> ثم اختر <strong>OAuth client ID</strong>.</li>
                    <li>اختر نوع التطبيق <strong>Web application</strong> (تطبيق ويب).</li>
                    <li>في حقل <strong>Authorized JavaScript origins</strong>، أضف الرابط الحالي للتطبيق: <code className="bg-white border px-1.5 py-0.5 rounded text-red-600 font-mono">{window.location.origin}</code></li>
                    <li>في حقل <strong>Authorized redirect URIs</strong>، أضف الرابط الحالي للتطبيق تماماً: <code className="bg-white border px-1.5 py-0.5 rounded text-red-600 font-mono">{window.location.origin + window.location.pathname}</code></li>
                    <li>اضغط <strong>Create</strong>، ثم انسخ معرف العميل (Client ID) والصقه في المربع واضغط "الاتصال بالحساب".</li>
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* If Connected: Show Backup Actions & Cloud Files list */}
        {isDriveConnected && (
          <div className="border-t border-slate-100 pt-5 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">عمليات المزامنة السحابية المباشرة</h4>
                <p className="text-xs text-slate-400 mt-0.5">رفع نسخة احتياطية فورية أو استيرادها من Google Drive الخاص بك.</p>
              </div>
              
              <button
                type="button"
                onClick={handleCloudBackup}
                disabled={isSyncing}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري المزامنة مع السحاب...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    مزامنة ورفع قاعدة البيانات الآن 🚀
                  </>
                )}
              </button>
            </div>

            {/* Cloud Backups List Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-600">الملفات والنسخ الاحتياطية المتوفرة على حسابك في جوجل:</span>
                <button
                  type="button"
                  onClick={() => loadCloudBackupsList(driveToken)}
                  disabled={loadingBackups}
                  className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                  title="تحديث القائمة"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingBackups ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  جاري جلب قائمة الملفات من Google Drive الخاص بك...
                </div>
              ) : cloudBackups.length > 0 ? (
                <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
                  {cloudBackups.map((file) => (
                    <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-slate-700 block">{file.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            آخر تعديل: {new Date(file.modifiedTime).toLocaleString('ar-EG', { numberingSystem: 'latn' })} | الحجم: {file.size ? `${(parseInt(file.size, 10) / 1024).toFixed(1)} ك.ب` : 'غير معروف'}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleCloudRestore(file.id, file.name)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 font-black text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        استيراد واستعادة 📥
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-xl bg-white leading-relaxed">
                  ⚠️ لا توجد ملفات نسخ احتياطي خاصة بالنظام على حسابك في جوجل حالياً.<br />
                  اضغط على زر <strong>"مزامنة ورفع قاعدة البيانات الآن"</strong> لإنشاء أول نسخة مشفرة سحابية!
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Traditional Local Backup and Restore File Upload */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-700 text-base flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-500" />
          النسخ الاحتياطي التقليدي (تنزيل ملفات محلياً)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Data Card */}
          <div className="border border-slate-100 rounded-xl p-4 space-y-3 hover:border-slate-200 transition-colors bg-slate-50/20">
            <h4 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
              <Download className="w-4.5 h-4.5 text-blue-500" />
              تصدير نسخة احتياطية للجهاز
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              تنزيل كافة البيانات الحالية (المشتركين، سجل الفواتير، والمدفوعات) في ملف مخصّص بصيغة JSON على جهازك للاحتفاظ به بشكل مستقل.
            </p>
            <button
              id="btn-export-backup"
              onClick={handleExport}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-500/5"
            >
              <Download className="w-4 h-4" />
              تحميل ملف النسخة الاحتياطية (.json)
            </button>
          </div>

          {/* Import Data Card */}
          <div className="border border-slate-100 rounded-xl p-4 space-y-3 hover:border-slate-200 transition-colors bg-slate-50/20">
            <h4 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
              <Upload className="w-4.5 h-4.5 text-emerald-500" />
              استيراد نسخة احتياطية من ملف
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              رفع ملف نسخة احتياطية مسبقة بصيغة JSON من جهازك لاستعادة كافة حسابات المشتركين والمديونيات في ثانية واحدة.
            </p>
            <div className="relative">
              <input
                id="file-import-backup"
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFileChange}
                className="hidden"
              />
              <button
                id="btn-trigger-import-backup"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/5"
              >
                <Upload className="w-4 h-4" />
                اختيار ورفع ملف النسخة (.json)
              </button>
            </div>
          </div>
        </div>

        {/* Local Import Status Alert banner */}
        <AnimatePresence>
          {importStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-start gap-2.5 p-4 rounded-xl border text-sm ${
                importStatus.success
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-red-50 border-red-100 text-red-800'
              }`}
            >
              {importStatus.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              )}
              <div>
                <p className="font-bold">{importStatus.success ? 'تم الاستيراد بنجاح' : 'فشل الاستيراد'}</p>
                <p className="text-xs mt-1 leading-relaxed">{importStatus.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset application system */}
      <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-bold text-rose-600 text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4.5 h-4.5 animate-bounce" />
            منطقة الخطر: تصفير قاعدة البيانات بالكامل
          </h4>
          <p className="text-xs text-slate-400">حذف كافة بيانات المشتركين، سجلات الفواتير، العمليات المالية، والمدفوعات نهائياً والعودة لضبط المصنع الافتراضي.</p>
        </div>

        {!showClearConfirm ? (
          <button
            id="btn-trigger-clear-all"
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-rose-100"
          >
            <Trash2 className="w-4 h-4" />
            مسح وتصفير كافة البيانات الحالية
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-rose-50 p-3 rounded-xl border border-rose-100">
            <span className="text-xs font-bold text-rose-800">هل أنت متأكد تماماً من رغبتك في حذف وحظر كل السجلات؟ لن تستطيع استعادتها!</span>
            <button
              id="btn-confirm-clear-all"
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
            >
              نعم، امسح كل شيء
            </button>
            <button
              id="btn-cancel-clear-all"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 bg-white text-slate-500 font-bold text-xs rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              تراجع
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
