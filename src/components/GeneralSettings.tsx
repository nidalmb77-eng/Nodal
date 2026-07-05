/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Coins, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Check, 
  AlertCircle, 
  X, 
  Zap,
  Info,
  MessageSquare,
  Upload,
  Image as ImageIcon,
  Palette,
  FileText,
  Cloud,
  CloudOff,
  Volume2,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, BillCustomization } from '../types';

interface GeneralSettingsProps {
  defaultCurrency: string;
  currencies: string[];
  defaultPricePerKwh: string;
  whatsappReminderEnabled: boolean;
  whatsappReminderThreshold: number;
  whatsappReminderTemplate: string;
  currentUser: User | null;
  autoSyncEnabled: boolean;
  onUpdateAutoSync: (enabled: boolean) => void;
  onUpdateBillSettings: (settings: BillCustomization) => void;
  onUpdateDefaultCurrency: (currency: string) => void;
  onUpdateCurrencies: (currencies: string[]) => void;
  onUpdateDefaultPrice: (price: string) => void;
  onUpdateWhatsappReminderEnabled: (enabled: boolean) => void;
  onUpdateWhatsappReminderThreshold: (threshold: number) => void;
  onUpdateWhatsappReminderTemplate: (template: string) => void;
}

export default function GeneralSettings({
  defaultCurrency,
  currencies,
  defaultPricePerKwh,
  whatsappReminderEnabled,
  whatsappReminderThreshold,
  whatsappReminderTemplate,
  currentUser,
  autoSyncEnabled,
  onUpdateAutoSync,
  onUpdateBillSettings,
  onUpdateDefaultCurrency,
  onUpdateCurrencies,
  onUpdateDefaultPrice,
  onUpdateWhatsappReminderEnabled,
  onUpdateWhatsappReminderThreshold,
  onUpdateWhatsappReminderTemplate,
}: GeneralSettingsProps) {
  const [newCurrency, setNewCurrency] = useState<string>('');
  const [editingCurrencyIndex, setEditingCurrencyIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>(defaultPricePerKwh);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Bill Customization States
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [billTitle, setBillTitle] = useState<string>('');
  const [billSubtitle, setBillSubtitle] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('');
  const [contactDetails, setContactDetails] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');
  const [isDraggingLogo, setIsDraggingLogo] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Sound States
  const [soundSettings, setSoundSettings] = useState(() => {
    const saved = localStorage.getItem('notification_sound_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      financial: 'double-beep',
      general: 'ping',
      system: 'warning'
    };
  });

  const playNotificationSoundPreset = (presetId: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

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

      switch (presetId) {
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
          playTone(523.25, 0, 0.4, 0.15);
          playTone(659.25, 0.1, 0.4, 0.15);
          playTone(783.99, 0.2, 0.5, 0.2);
      }
    } catch (e) {
      console.warn('Could not synthesize sound:', e);
    }
  };

  const handleUpdateSoundSetting = (key: 'financial' | 'general' | 'system', value: string) => {
    const updated = { ...soundSettings, [key]: value };
    setSoundSettings(updated);
    localStorage.setItem('notification_sound_settings', JSON.stringify(updated));
    // Immediately play the sound to give the user instant feedback!
    playNotificationSoundPreset(value);
  };

  // Sync inputs with props on load and user change
  useEffect(() => {
    if (currentUser?.billSettings) {
      setLogoBase64(currentUser.billSettings.logo || '');
      setBillTitle(currentUser.billSettings.title || '');
      setBillSubtitle(currentUser.billSettings.subtitle || '');
      setPaymentTerms(currentUser.billSettings.paymentTerms || '');
      setContactDetails(currentUser.billSettings.contactDetails || '');
      setFooterText(currentUser.billSettings.footerText || '');
    } else {
      setLogoBase64('');
      setBillTitle('');
      setBillSubtitle('');
      setPaymentTerms('');
      setContactDetails('');
      setFooterText('');
    }
  }, [currentUser]);

  // Sync inputs with props on load
  useEffect(() => {
    setPriceInput(defaultPricePerKwh);
  }, [defaultPricePerKwh]);

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(priceInput);
    if (isNaN(parsed) || parsed < 0) {
      setError('يرجى إدخال سعر صحيح أكبر من أو يساوي الصفر.');
      return;
    }
    onUpdateDefaultPrice(priceInput);
    setError('');
    setSuccess('تم تحديث سعر الكيلوواط الافتراضي بنجاح!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanValue = newCurrency.trim();
    if (!cleanValue) return;

    if (currencies.includes(cleanValue)) {
      setError('هذه العملة موجودة بالفعل في القائمة.');
      return;
    }

    const updated = [...currencies, cleanValue];
    onUpdateCurrencies(updated);
    setNewCurrency('');
    setError('');
    setSuccess('تمت إضافة العملة الجديدة بنجاح!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleStartEdit = (index: number, val: string) => {
    setEditingCurrencyIndex(index);
    setEditingValue(val);
  };

  const handleSaveEdit = (index: number) => {
    const cleanValue = editingValue.trim();
    if (!cleanValue) return;

    const oldVal = currencies[index];
    if (currencies.includes(cleanValue) && cleanValue !== oldVal) {
      setError('هذه العملة موجودة بالفعل في القائمة.');
      return;
    }

    const updated = [...currencies];
    updated[index] = cleanValue;
    onUpdateCurrencies(updated);

    // If we edited the active default currency, update it too
    if (defaultCurrency === oldVal) {
      onUpdateDefaultCurrency(cleanValue);
    }

    setEditingCurrencyIndex(null);
    setEditingValue('');
    setError('');
    setSuccess('تم تعديل العملة بنجاح!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDeleteCurrency = (val: string) => {
    if (currencies.length <= 1) {
      setError('يجب الإبقاء على عملة واحدة على الأقل في النظام.');
      return;
    }

    if (defaultCurrency === val) {
      setError('لا يمكن حذف العملة الافتراضية النشطة. يرجى تغيير العملة الافتراضية أولاً.');
      return;
    }

    const updated = currencies.filter(c => c !== val);
    onUpdateCurrencies(updated);
    setError('');
    setSuccess('تم حذف العملة بنجاح!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صحيح (PNG, JPG, JPEG, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 2 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setLogoBase64(e.target.result);
        setError('');
        setSuccess('تم تحميل الشعار بنجاح! تذكر النقر على حفظ في الأسفل لتأكيد الحفظ.');
        setTimeout(() => setSuccess(''), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(true);
  };

  const handleDragLeave = () => {
    setIsDraggingLogo(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemoveLogo = () => {
    setLogoBase64('');
    setSuccess('تم إزالة الشعار. انقر على حفظ التعديلات لحفظ التغييرات.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveBillCustomization = (e: React.FormEvent) => {
    e.preventDefault();
    const settings: BillCustomization = {
      logo: logoBase64 || undefined,
      title: billTitle.trim() || undefined,
      subtitle: billSubtitle.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      contactDetails: contactDetails.trim() || undefined,
      footerText: footerText.trim() || undefined,
    };
    onUpdateBillSettings(settings);
    setError('');
    setSuccess('تم حفظ إعدادات مظهر وتخصيص الفواتير الخاصة بك بنجاح!');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div id="general-settings-section" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 space-y-8">
      
      {/* Header */}
      <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Settings className="w-6 h-6 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">الإعدادات العامة</h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">ضبط وتخصيص أسعار الطاقة الافتراضية والعملات المستخدمة في الفواتير والتقارير</p>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 flex items-center gap-2.5 text-xs sm:text-sm font-bold"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 flex items-center gap-2.5 text-xs sm:text-sm font-bold"
          >
            <Check className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUMN 1: KWH PRICE & DEFAULT CURRENCY */}
        <div className="space-y-6">
          
          {/* DEFAULT PRICE SETTING */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              سعر الكيلوواط الافتراضي (سعر الوحدة)
            </h3>
            
            <form onSubmit={handleSavePrice} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500">
                  سعر الكيلوواط الافتراضي ({defaultCurrency})
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      required
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      dir="ltr"
                      placeholder="0.5"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    حفظ السعر
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed flex items-start gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                <span>سيتم اقتراح هذا السعر تلقائياً عند إصدار الفواتير الفردية أو المركبة لتوفير وقت الإدخال.</span>
              </p>
            </form>
          </div>

          {/* DEFAULT CURRENCY SELECT */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-500" />
              اختيار العملة الافتراضية للنظام
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500">
                  العملة النشطة حالياً
                </label>
                <select
                  value={defaultCurrency}
                  onChange={(e) => {
                    onUpdateDefaultCurrency(e.target.value);
                    setSuccess(`تم تغيير العملة الافتراضية بنجاح إلى "${e.target.value}"`);
                    setTimeout(() => setSuccess(''), 3000);
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20"
                >
                  {currencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="p-3 bg-blue-50/50 border border-blue-100/30 rounded-2xl flex items-start gap-2.5">
                <Coins className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[10px] text-blue-700 font-semibold leading-relaxed">
                  تغيير العملة الافتراضية سيقوم بتحديث رمز العملة المعروض في جميع شاشات لوحة التحكم، المدفوعات، وإصدار الفواتير تلقائياً دون التأثير على القيم الرقمية.
                </span>
              </div>
            </div>
          </div>

          {/* WHATSAPP REMINDER SETTING */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              ميزة التذكير التلقائي للدفع عبر الواتساب
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl shadow-sm">
                <div className="space-y-0.5 text-right">
                  <span className="text-xs font-black text-slate-700 block">تفعيل إشعارات تذكير الدفع</span>
                  <span className="text-[10px] text-slate-400 font-bold leading-normal block">تمكين النظام من تتبع وتنبيه المشتركين الذين تراكمت ديونهم</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateWhatsappReminderEnabled(!whatsappReminderEnabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-all duration-300 relative cursor-pointer ${
                    whatsappReminderEnabled ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-all duration-300 ${
                    whatsappReminderEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {whatsappReminderEnabled && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                      الحد الأقصى للدين المسموح ({defaultCurrency}) قبل إرسال التذكير
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={whatsappReminderThreshold}
                      onChange={(e) => onUpdateWhatsappReminderThreshold(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      dir="ltr"
                      placeholder="500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                      قالب رسالة التذكير الجاهزة
                    </label>
                    <textarea
                      rows={3}
                      value={whatsappReminderTemplate}
                      onChange={(e) => onUpdateWhatsappReminderTemplate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans text-xs font-bold text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="اكتب رسالة التذكير هنا..."
                    />
                    <div className="p-2.5 bg-slate-100 rounded-lg text-[9px] text-slate-500 leading-normal font-semibold text-right">
                      <span>الرموز المتاحة للاستبدال التلقائي: </span>
                      <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono">{`{name}`}</code> (اسم المشترك)،{' '}
                      <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono">{`{debt}`}</code> (قيمة الدين)،{' '}
                      <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono">{`{currency}`}</code> (رمز العملة)
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CLOUD SYNC & OFFLINE WORK MODE */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              وضع الاتصال والعمل (استهلاك البيانات)
            </h3>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                تحكم في كيفية مزامنة بياناتك مع السحاب لتوفير باقة الإنترنت أو للعمل بحرية مطلقة أوفلاين.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {/* Auto Sync */}
                <button
                  type="button"
                  onClick={() => onUpdateAutoSync(true)}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                    autoSyncEnabled
                      ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Cloud className={`w-4 h-4 ${autoSyncEnabled ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-extrabold text-xs text-slate-800">تزامن تلقائي</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold">مزامنة مستمرة عند توفر الاتصال</span>
                </button>

                {/* Offline Work */}
                <button
                  type="button"
                  onClick={() => onUpdateAutoSync(false)}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                    !autoSyncEnabled
                      ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-100 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <CloudOff className={`w-4 h-4 ${!autoSyncEnabled ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="font-extrabold text-xs text-slate-800">عمل بدون اتصال</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold">حفظ محلي لتوفير البيانات</span>
                </button>
              </div>

              <div className="p-3 bg-slate-100/60 border border-slate-200/50 rounded-2xl flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600 font-semibold leading-relaxed">
                  {autoSyncEnabled 
                    ? 'وضع التزامن التلقائي نشط: سيتم رفع التحديثات آلياً لحسابك السحابي لحمايتها.' 
                    : 'وضع العمل بدون اتصال نشط: سيتم حفظ كافة التحديثات محلياً وآمنة على جهازك لتوفير باقة الإنترنت ولن ترفع للسحاب إلا عندما تقوم بالتبديل يدوياً.'}
                </span>
              </div>
            </div>
          </div>

          {/* NOTIFICATION SOUNDS SETTINGS */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              تخصيص نغمات التنبيه الصوتية الإشعارات
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              اختر نغمة الرنين الإلكترونية المفضلة لديك لكل نوع من أنواع الرسائل والإشعارات في النظام لتنبيهك فوراً بصوت مخصص.
            </p>

            <div className="space-y-4">
              {/* Financial Alerts */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-600">
                  🪙 تنبيه مالي (ديون، فواتير، مستحقات مالية)
                </label>
                <div className="flex gap-2">
                  <select
                    value={soundSettings.financial}
                    onChange={(e) => handleUpdateSoundSetting('financial', e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="double-beep">🪙 رنين مالي ثنائي (عملة معدنية)</option>
                    <option value="ping">🔔 رنين هادئ مفرد (صدى ناعم)</option>
                    <option value="warning">⚠️ تنبيه إداري تنظيمي (انتباه دافئ)</option>
                    <option value="arpeggio">🎵 رنين ثلاثي متصاعد</option>
                    <option value="melody">🎼 لحن موسيقي صاعد سريع</option>
                    <option value="sci-fi">🚀 نغمة تقنية عصرية (انزلاق ذكي)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => playNotificationSoundPreset(soundSettings.financial)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-indigo-100 active:scale-95"
                    title="تجربة الصوت"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>

              {/* General Messages */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-600">
                  💬 رسالة عامة (محادثات مباشرة، مجموعات، زوار)
                </label>
                <div className="flex gap-2">
                  <select
                    value={soundSettings.general}
                    onChange={(e) => handleUpdateSoundSetting('general', e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="double-beep">🪙 رنين مالي ثنائي (عملة معدنية)</option>
                    <option value="ping">🔔 رنين هادئ مفرد (صدى ناعم)</option>
                    <option value="warning">⚠️ تنبيه إداري تنظيمي (انتباه دافئ)</option>
                    <option value="arpeggio">🎵 رنين ثلاثي متصاعد</option>
                    <option value="melody">🎼 لحن موسيقي صاعد سريع</option>
                    <option value="sci-fi">🚀 نغمة تقنية عصرية (انزلاق ذكي)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => playNotificationSoundPreset(soundSettings.general)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-indigo-100 active:scale-95"
                    title="تجربة الصوت"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>

              {/* System Alerts */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-600">
                  🛡️ إشعار نظام (إجراءات إدارية، نسخ احتياطي، تفعيل صلاحيات)
                </label>
                <div className="flex gap-2">
                  <select
                    value={soundSettings.system}
                    onChange={(e) => handleUpdateSoundSetting('system', e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="double-beep">🪙 رنين مالي ثنائي (عملة معدنية)</option>
                    <option value="ping">🔔 رنين هادئ مفرد (صدى ناعم)</option>
                    <option value="warning">⚠️ تنبيه إداري تنظيمي (انتباه دافئ)</option>
                    <option value="arpeggio">🎵 رنين ثلاثي متصاعد</option>
                    <option value="melody">🎼 لحن موسيقي صاعد سريع</option>
                    <option value="sci-fi">🚀 نغمة تقنية عصرية (انزلاق ذكي)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => playNotificationSoundPreset(soundSettings.system)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-indigo-100 active:scale-95"
                    title="تجربة الصوت"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMN 2: CURRENCIES LIST (ADD, EDIT, DELETE) */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-5">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <Coins className="w-4 h-4 text-purple-500" />
            إدارة قائمة العملات المتاحة
          </h3>

          {/* Add New Currency inline form */}
          <form onSubmit={handleAddCurrency} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="مثال: ش.ج، ₪، دولار، دينار..."
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              className="flex-1 px-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right"
            />
            <button
              type="submit"
              disabled={!newCurrency.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة عملة</span>
            </button>
          </form>

          {/* List of Currencies */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
            <div className="divide-y divide-slate-100">
              {currencies.map((curr, idx) => {
                const isEditing = editingCurrencyIndex === idx;
                const isDefault = defaultCurrency === curr;

                return (
                  <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50/30 transition-colors">
                    {isEditing ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCurrencyIndex(null)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800">{curr}</span>
                          {isDefault && (
                            <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md text-[9px] font-black">
                              الافتراضية النشطة
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx, curr)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="تعديل اسم العملة"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isDefault}
                            onClick={() => handleDeleteCurrency(curr)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isDefault 
                                ? 'text-slate-200 cursor-not-allowed' 
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isDefault ? 'لا يمكن حذف العملة الافتراضية' : 'حذف العملة'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Bill Customization Section */}
      <div className="border-t border-slate-100 pt-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-md font-black text-slate-800">تخصيص مظهر الفاتورة والطباعة</h3>
            <p className="text-xs text-slate-400 font-medium">تخصيص شعار شركتك، العناوين، شروط الدفع وتفاصيل الاتصال على الفواتير وكشوف الحساب المطبوعة</p>
          </div>
        </div>

        <form onSubmit={handleSaveBillCustomization} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Logo Upload Card */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-500">
                شعار الشركة / المؤسسة
              </label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                  isDraggingLogo 
                    ? 'border-indigo-500 bg-indigo-50/40' 
                    : logoBase64 
                      ? 'border-slate-200 bg-slate-50/30' 
                      : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoChange}
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                  className="hidden"
                />

                {logoBase64 ? (
                  <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block border border-slate-200 rounded-xl p-2 bg-white shadow-sm">
                      <img src={logoBase64} alt="Company Logo" className="max-h-16 max-w-[200px] object-contain" />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        تغيير الشعار
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف الشعار
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pointer-events-none">
                    <div className="p-3 bg-slate-100 text-slate-500 rounded-full inline-block">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">اسحب شعار مؤسستك وأفلته هنا، أو انقر للاختيار</p>
                    <p className="text-[10px] text-slate-400 font-semibold">PNG, JPG, SVG بحد أقصى 2 ميجابايت (يُفضل خلفية شفافة)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Title & Subtitle Settings */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  عنوان الفاتورة المخصص (اسم الشركة / المنشأة)
                </label>
                <input
                  type="text"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  placeholder="مثال: شركة الكهرباء الأهلية، خدمات الفتح العقارية"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-bold text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500">
                  العنوان الفرعي المخصص (وصف أو تفاصيل إضافية)
                </label>
                <input
                  type="text"
                  value={billSubtitle}
                  onChange={(e) => setBillSubtitle(e.target.value)}
                  placeholder="مثال: نظام إدارة وتوزيع طاقة مجمع الهدى السكني"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-bold text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">
                شروط الدفع والتحصيل (تظهر في الفاتورة)
              </label>
              <textarea
                rows={3}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="مثال: يرجى السداد في غضون 7 أيام من تاريخ صدور الفاتورة لتجنب تراكم الغرامات أو فصل الخدمة."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-medium text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">
                تفاصيل الاتصال والعناوين (تظهر في ترويسة الطباعة)
              </label>
              <textarea
                rows={3}
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="مثال: هاتف: 05999999 | جوال: 05922222 | العنوان: الطابق الثاني، مجمع السلام التجاري"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-medium text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">
                نص تذييل الصفحة المخصص (تظهر في أسفل الطباعة)
              </label>
              <textarea
                rows={3}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="مثال: شكراً لاختياركم خدماتنا الأهلية. تم توليد هذه الفاتورة المعتمدة آلياً."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-medium text-slate-800 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              حفظ مظهر وتخصيص الفواتير
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
