/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Subscriber, Invoice, Payment } from '../types';
import { 
  Calculator, 
  AlertCircle, 
  PlusCircle, 
  Check, 
  Users, 
  Tags, 
  ChevronDown, 
  UserPlus, 
  Coins, 
  FileSpreadsheet, 
  Flame, 
  TrendingUp,
  Receipt,
  PenTool,
  Trash2,
  RefreshCw,
  Sparkles,
  User,
  Copy,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateSubscriberStats } from '../utils/storage';

interface NewInvoiceFormProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  groupsList?: string[];
  onSaveInvoice: (invoice: Omit<Invoice, 'id' | 'date'>) => void;
  onAddSubscriberInline?: (name: string) => void;
  defaultCurrency?: string;
  defaultPricePerKwh?: string;
}

export default function NewInvoiceForm({
  subscribers,
  invoices,
  payments,
  groupsList = [],
  onSaveInvoice,
  onAddSubscriberInline,
  defaultCurrency = 'ش.ج',
  defaultPricePerKwh = '0.5',
}: NewInvoiceFormProps) {
  // Form State
  const [calculatorMode, setCalculatorMode] = useState<'system' | 'quick'>('system');
  const [prevReading, setPrevReading] = useState<string>('');
  const [currReading, setCurrReading] = useState<string>('');
  const [pricePerKwh, setPricePerKwh] = useState<string>(defaultPricePerKwh); // Default energy unit price
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Quick mode specific states
  const [quickSubscribersCount, setQuickSubscribersCount] = useState<string>('4');
  const [quickSubs, setQuickSubs] = useState<{ id: string; name: string; due: number; isCustomDue: boolean }[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  // Update pricePerKwh if the default in settings changes
  useEffect(() => {
    setPricePerKwh(defaultPricePerKwh);
  }, [defaultPricePerKwh]);

  // Selection mode: 'individual' (individual subscriber list checkboxes) or 'group' (by group name)
  const [selectionMode, setSelectionMode] = useState<'individual' | 'group'>('individual');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  
  // Quick Inline Add Subscriber
  const [inlineSubName, setInlineSubName] = useState<string>('');
  const [showInlineAdd, setShowInlineAdd] = useState<boolean>(false);

  // Errors & Success
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Calculations
  const prevVal = parseFloat(prevReading) || 0;
  const currVal = parseFloat(currReading) || 0;
  const kwhPrice = parseFloat(pricePerKwh) || 0;

  const consumption = currVal >= prevVal ? currVal - prevVal : 0;
  const totalCost = consumption * kwhPrice;

  const activeSubCount = selectedSubIds.length;
  const sharePerSub = activeSubCount > 0 ? totalCost / activeSubCount : 0;

  // Initialize and synchronize quick subscribers list when totalCost or count changes
  useEffect(() => {
    if (calculatorMode !== 'quick') return;

    const num = Math.max(1, parseInt(quickSubscribersCount) || 1);
    
    // Copy existing state to avoid mutation
    let updated = [...quickSubs];
    
    // Grow or shrink the array
    if (updated.length < num) {
      for (let i = updated.length; i < num; i++) {
        // Pre-populate from system subscribers if possible
        const sysSub = subscribers[i];
        updated.push({
          id: `quick-sub-${i + 1}-${Date.now()}`,
          name: sysSub ? sysSub.name : `مشترك ${i + 1}`,
          due: 0,
          isCustomDue: false
        });
      }
    } else if (updated.length > num) {
      updated = updated.slice(0, num);
    }

    // Distribute totalCost
    const customSubs = updated.filter(s => s.isCustomDue);
    const customSum = customSubs.reduce((sum, s) => sum + s.due, 0);
    const remainingCost = Math.max(0, totalCost - customSum);
    const nonCustomCount = updated.length - customSubs.length;

    const equalShare = nonCustomCount > 0 ? remainingCost / nonCustomCount : 0;

    const finalSubs = updated.map(s => {
      if (s.isCustomDue) {
        return s;
      }
      return { ...s, due: equalShare };
    });

    // Determine if there are actual changes before setting state to avoid re-render loops
    const hasLengthChange = finalSubs.length !== quickSubs.length;
    const hasValueChange = finalSubs.some((s, idx) => {
      const prev = quickSubs[idx];
      if (!prev) return true;
      return s.name !== prev.name || Math.abs(s.due - prev.due) > 0.01 || s.isCustomDue !== prev.isCustomDue;
    });

    if (hasLengthChange || hasValueChange) {
      setQuickSubs(finalSubs);
    }
  }, [quickSubscribersCount, totalCost, calculatorMode]);

  // Auto-fill previous reading from the latest invoice to save user effort!
  useEffect(() => {
    if (invoices.length > 0 && !prevReading) {
      // Find the latest invoice's current reading
      const sorted = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sorted[0] && sorted[0].currReading) {
        setPrevReading(sorted[0].currReading.toString());
      }
    }
  }, [invoices, prevReading]);

  // Auto-select all subscribers initially
  useEffect(() => {
    if (subscribers.length > 0 && selectedSubIds.length === 0) {
      setSelectedSubIds(subscribers.map((s) => s.id));
    }
  }, [subscribers]);

  // Focus on mounted
  useEffect(() => {
    const handleFocusInvoice = () => {
      setTimeout(() => {
        const el = document.getElementById('input-prev-reading');
        if (el) el.focus();
      }, 300);
    };
    window.addEventListener('focus-invoice-form', handleFocusInvoice);
    return () => {
      window.removeEventListener('focus-invoice-form', handleFocusInvoice);
    };
  }, []);

  // Compute all unique groups in the system
  const allGroups = useMemo(() => {
    return Array.from(
      new Set([...groupsList, ...subscribers.flatMap((s) => s.groups || [])])
    );
  }, [groupsList, subscribers]);

  // Filter subscribers to show depending on the selection mode
  const visibleSubscribers = useMemo(() => {
    if (selectionMode === 'individual') {
      return subscribers;
    }
    return subscribers.filter((s) => selectedGroup ? (s.groups && s.groups.includes(selectedGroup)) : false);
  }, [subscribers, selectionMode, selectedGroup]);

  // Quick mode handlers
  const handleUpdateQuickSubName = (id: string, newName: string) => {
    setQuickSubs(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleUpdateQuickSubDue = (id: string, newDue: number) => {
    setQuickSubs(prev => prev.map(s => s.id === id ? { ...s, due: newDue, isCustomDue: true } : s));
  };

  const handleResetQuickDues = () => {
    setQuickSubs(prev => prev.map(s => ({ ...s, isCustomDue: false })));
  };

  const handleDeleteQuickSub = (id: string) => {
    const filtered = quickSubs.filter(s => s.id !== id);
    setQuickSubs(filtered);
    setQuickSubscribersCount(filtered.length.toString());
  };

  const handleAddQuickSub = () => {
    const nextIndex = quickSubs.length + 1;
    setQuickSubs(prev => [
      ...prev,
      {
        id: `quick-sub-${nextIndex}-${Date.now()}`,
        name: `مشترك جديد ${nextIndex}`,
        due: 0,
        isCustomDue: false
      }
    ]);
    setQuickSubscribersCount((quickSubs.length + 1).toString());
  };

  const handleImportRegisteredSubs = () => {
    if (subscribers.length === 0) {
      setError('لا يوجد مشتركين مسجلين لاستيرادهم. يرجى إضافة مشتركين أولاً.');
      return;
    }
    const imported = subscribers.map((s, idx) => ({
      id: `quick-sub-imp-${s.id}-${idx}`,
      name: s.name,
      due: 0,
      isCustomDue: false
    }));
    setQuickSubs(imported);
    setQuickSubscribersCount(imported.length.toString());
    setError('');
  };

  const handleCopyReport = () => {
    try {
      const currency = defaultCurrency || 'ش.ج';
      let text = `⚡️ *كشف احتساب وتوزيع فاتورة الكهرباء* ⚡️\n`;
      text += `------------------------------------------\n`;
      text += `📝 *تفاصيل العداد المغذي الرئيسي:*\n`;
      text += `• القراءة السابقة: ${prevVal} kWh\n`;
      text += `• القراءة الحالية: ${currVal} kWh\n`;
      text += `• الاستهلاك الكلي: ${consumption} kWh\n`;
      text += `• سعر الكيلوواط: ${kwhPrice} ${currency}\n`;
      text += `• *إجمالي قيمة الفاتورة: ${totalCost.toFixed(2)} ${currency}*\n`;
      text += `------------------------------------------\n`;
      text += `👥 *تفصيل المستحقات والمبالغ المطلوبة:*\n`;
      
      const targetSubs = calculatorMode === 'quick' ? quickSubs : selectedSubIds.map(id => {
        const sub = subscribers.find(s => s.id === id);
        return { name: sub ? sub.name : 'مشترك', due: sharePerSub };
      });

      targetSubs.forEach((sub, idx) => {
        text += `• ${idx + 1}. *${sub.name}*: ${sub.due.toFixed(2)} ${currency}\n`;
      });
      text += `------------------------------------------\n`;
      text += `🔌 _تم الاحتساب والمشاركة بواسطة نظام العدادات الذكي_ ⚡️`;

      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('فشل نسخ التقرير إلى الحافظة.');
    }
  };

  // Toggle subscriber selection
  const handleToggleSubscriber = (id: string) => {
    if (selectedSubIds.includes(id)) {
      setSelectedSubIds(selectedSubIds.filter((subId) => subId !== id));
    } else {
      setSelectedSubIds([...selectedSubIds, id]);
    }
  };

  const handleSelectAll = () => {
    const listToCompare = selectionMode === 'individual' ? subscribers : visibleSubscribers;
    const listToCompareIds = listToCompare.map((s) => s.id);
    const allSelectedInList = listToCompareIds.length > 0 && listToCompareIds.every((id) => selectedSubIds.includes(id));

    if (allSelectedInList) {
      // Remove all visible subscriber IDs from selection
      setSelectedSubIds(selectedSubIds.filter((id) => !listToCompareIds.includes(id)));
    } else {
      // Add all visible subscriber IDs that aren't already selected
      const uniqueNewSubIds = Array.from(new Set([...selectedSubIds, ...listToCompareIds]));
      setSelectedSubIds(uniqueNewSubIds);
    }
  };

  const handleAddInlineSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineSubName.trim()) return;
    if (onAddSubscriberInline) {
      onAddSubscriberInline(inlineSubName.trim());
      setInlineSubName('');
      setShowInlineAdd(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!prevReading || !currReading || !pricePerKwh) {
      setError('يرجى ملء جميع الحقول المطلوبة (القراءة السابقة والحالية وسعر الكيلوواط).');
      return;
    }

    if (currVal < prevVal) {
      setError('القراءة الحالية يجب أن تكون أكبر من أو تساوي القراءة السابقة لتفادي استهلاك سالب.');
      return;
    }

    if (calculatorMode === 'system') {
      if (selectedSubIds.length === 0) {
        setError('يرجى اختيار مشترك واحد على الأقل لتوزيع واحتساب المستحقات.');
        return;
      }

      setError('');
      
      onSaveInvoice({
        prevReading: prevVal,
        currReading: currVal,
        consumption,
        pricePerKwh: kwhPrice,
        totalCost,
        subscriberIds: selectedSubIds,
        sharePerSubscriber: sharePerSub,
        notes: notes.trim() || undefined,
      });

      // Reset Form
      setPrevReading(currReading); // Convenient for next bill!
      setCurrReading('');
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      // In quick mode, we check if there are custom subscribers to register first
      if (quickSubs.length === 0) {
        setError('يرجى إدخال مشترك واحد على الأقل.');
        return;
      }

      // Check if some names are not registered
      const unregisteredNames = quickSubs.filter(qs => !subscribers.some(s => s.name.trim() === qs.name.trim()));
      
      if (unregisteredNames.length > 0 && onAddSubscriberInline) {
        // Inform user we're creating them and wait or add them
        unregisteredNames.forEach(un => {
          onAddSubscriberInline(un.name.trim());
        });
        
        setError('تم تسجيل بعض المشتركين الجدد في النظام تلقائياً لمطابقة الأسماء. يرجى الضغط مرة أخرى لتأكيد الترحيل وحفظ الفاتورة.');
        return;
      }

      setError('');
      
      // Resolve IDs for the invoice
      const resolvedIds: string[] = [];
      quickSubs.forEach(qs => {
        const match = subscribers.find(s => s.name.trim() === qs.name.trim());
        if (match) {
          resolvedIds.push(match.id);
        }
      });

      // Average share
      const averageShare = totalCost / quickSubs.length;

      onSaveInvoice({
        prevReading: prevVal,
        currReading: currVal,
        consumption,
        pricePerKwh: kwhPrice,
        totalCost,
        subscriberIds: resolvedIds,
        sharePerSubscriber: averageShare,
        notes: `فاتورة حاسبة سريعة مخصصة. ${notes.trim()}`.trim(),
      });

      // Reset Form
      setPrevReading(currReading);
      setCurrReading('');
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div id="new-invoice-section" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 space-y-8">
      
      {/* Header with clear title & instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800">حساب وتوزيع تكلفة استهلاك الكهرباء</h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">احتساب قيمة سحب العداد الرئيسي وتقسيم المبلغ بالتساوي على المشتركين المحددين</p>
          </div>
        </div>

        {calculatorMode === 'system' && (
          <button
            type="button"
            onClick={() => setShowInlineAdd(!showInlineAdd)}
            className="self-start sm:self-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مشترك جديد سريع</span>
          </button>
        )}
      </div>

      {/* Selector for calculatorMode */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-full max-w-xl mx-auto border border-slate-200/40">
        <button
          type="button"
          onClick={() => setCalculatorMode('quick')}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            calculatorMode === 'quick'
              ? 'bg-white text-blue-700 shadow-sm font-black border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>الحاسبة التفاعلية السريعة (توزيع حر)</span>
        </button>
        <button
          type="button"
          onClick={() => setCalculatorMode('system')}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            calculatorMode === 'system'
              ? 'bg-white text-blue-700 shadow-sm font-black border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-blue-500" />
          <span>توزيع معتمد على حسابات النظام</span>
        </button>
      </div>

      {/* Inline Add Subscriber Form (Only in system mode) */}
      <AnimatePresence>
        {calculatorMode === 'system' && showInlineAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddInlineSub} className="flex flex-col sm:flex-row gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/60 mb-4">
              <input
                id="input-inline-sub-name"
                type="text"
                required
                placeholder="اسم المشترك الجديد ثنائي أو ثلاثي..."
                value={inlineSubName}
                onChange={(e) => setInlineSubName(e.target.value)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!inlineSubName.trim()}
                  className="px-5 py-2 bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  إضافة الآن
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineAdd(false)}
                  className="px-4 py-2 bg-white text-slate-500 font-bold text-xs sm:text-sm rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Render Form Inputs based on mode */}
        {calculatorMode === 'quick' ? (
          /* QUICK INTERACTIVE MODE INPUT GRID */
          <div className="bg-slate-50/40 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>بيانات الاحتساب الفوري</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  القراءة السابقة (kWh) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-prev-reading"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 12450"
                  value={prevReading}
                  onChange={(e) => setPrevReading(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 font-semibold">قراءة العداد السابقة</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  القراءة الحالية (kWh) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-curr-reading"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 12900"
                  value={currReading}
                  onChange={(e) => setCurrReading(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 font-semibold">قراءة العداد الحالية</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  سعر الكيلوواط ({defaultCurrency}) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-price-per-kwh"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 0.50"
                  value={pricePerKwh}
                  onChange={(e) => setPricePerKwh(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 font-semibold">تكلفة الكيلوواط الواحد</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  عدد المشتركين لتوزيع التكلفة <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickSubscribersCount(prev => Math.max(1, (parseInt(prev) || 1) - 1).toString())}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs transition-colors"
                  >
                    -
                  </button>
                  <input
                    id="input-quick-sub-count"
                    type="number"
                    min="1"
                    required
                    value={quickSubscribersCount}
                    onChange={(e) => setQuickSubscribersCount(Math.max(1, parseInt(e.target.value) || 1).toString())}
                    className="w-full px-3 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickSubscribersCount(prev => ((parseInt(prev) || 1) + 1).toString())}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">عدد أطراف توزيع هذه الفاتورة</p>
              </div>
            </div>
          </div>
        ) : (
          /* SYSTEM INTEGRATED MODE INPUT GRID */
          <div className="bg-slate-50/40 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider block">بيانات عداد المغذي الرئيسي</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  القراءة السابقة (kWh) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-prev-reading"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 12450"
                  value={prevReading}
                  onChange={(e) => setPrevReading(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  القراءة الحالية (kWh) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-curr-reading"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 12900"
                  value={currReading}
                  onChange={(e) => setCurrReading(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600">
                  سعر الكيلوواط ({defaultCurrency}) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-price-per-kwh"
                  type="number"
                  step="any"
                  required
                  placeholder="مثال: 0.50"
                  value={pricePerKwh}
                  onChange={(e) => setPricePerKwh(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-mono font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {/* Real-time consumption summary dashboard */}
        <div className="bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-emerald-600/5 border-2 border-blue-100 rounded-3xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-md">
          <div className="flex flex-col items-center sm:items-start justify-center space-y-1.5">
            <div className="flex items-center gap-2 text-slate-500">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-black uppercase tracking-wide">كمية الاستهلاك الفعلي</span>
            </div>
            <span className="text-3xl sm:text-4xl font-black text-slate-800 font-mono">
              {consumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-sm font-black text-slate-400">kWh</span>
            </span>
            <span className="text-xs font-bold text-slate-400">(القراءة الحالية - القراءة السابقة)</span>
          </div>

          <div className="flex flex-col items-center sm:items-start justify-center space-y-1.5 border-y sm:border-y-0 sm:border-x-2 border-slate-200/60 py-5 sm:py-0 sm:px-8">
            <div className="flex items-center gap-2 text-slate-500">
              <Coins className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-black uppercase tracking-wide">إجمالي تكلفة الفاتورة</span>
            </div>
            <span className="text-3xl sm:text-4xl font-black text-blue-700 font-mono">
              {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-black text-blue-500">{defaultCurrency}</span>
            </span>
            <span className="text-xs font-bold text-slate-400">(الاستهلاك الكلي × سعر كيلوواط)</span>
          </div>

          <div className="flex flex-col items-center sm:items-start justify-center space-y-1.5">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-black uppercase tracking-wide">نصيب المشترك (المتوسط)</span>
            </div>
            <span className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono">
              {(calculatorMode === 'quick' ? (totalCost / (parseInt(quickSubscribersCount) || 1)) : sharePerSub).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-black text-emerald-500">{defaultCurrency}</span>
            </span>
            <span className="text-xs font-bold text-slate-400">مقسم على {calculatorMode === 'quick' ? quickSubscribersCount : activeSubCount} مشتركين</span>
          </div>
        </div>

        {/* SECTION 3: SUBSCRIBERS DETAILS & DUE AMOUNTS SETUP BASED ON MODE */}
        {calculatorMode === 'quick' ? (
          /* QUICK MODE SUBSCRIBERS LIST AND DUE INPUTS */
          <div className="border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  أسماء المشتركين وتفصيل المبالغ المستحقة عليهم
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">يمكنك تعديل الأسماء وتعديل المبالغ مباشرة. بقية التكلفة ستوزع تلقائياً بالتساوي!</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleImportRegisteredSubs}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>استيراد الأسماء المسجلة بالنظام</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetQuickDues}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  ⚖️
                  <span>توزيع متساوي بالكامل</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddQuickSub}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إضافة مشترك يدوي</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1">
              {quickSubs.map((qs, idx) => (
                <div
                  key={qs.id}
                  className={`flex flex-col p-4 rounded-2xl border transition-all space-y-3 ${
                    qs.isCustomDue
                      ? 'border-amber-400 bg-amber-50/20'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-extrabold text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-400">بيانات الطرف</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleDeleteQuickSub(qs.id)}
                      className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="حذف هذا المشترك"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500">اسم المشترك</label>
                      <input
                        type="text"
                        value={qs.name}
                        onChange={(e) => handleUpdateQuickSubName(qs.id, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        placeholder="أدخل اسم المشترك..."
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-slate-500">المبلغ المستحق ({defaultCurrency})</label>
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          qs.isCustomDue ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {qs.isCustomDue ? 'مخصص' : 'تلقائي'}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        value={qs.due === 0 ? '' : qs.due.toFixed(2)}
                        onChange={(e) => handleUpdateQuickSubDue(qs.id, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                        placeholder="مقسم تلقائياً..."
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick check on distribution sums */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-500">مجموع المبالغ الموزعة حالياً:</span>
                <span className="font-black text-slate-800 font-mono">
                  {quickSubs.reduce((sum, s) => sum + s.due, 0).toFixed(2)} {defaultCurrency}
                </span>
                <span className="text-slate-300">/</span>
                <span className="font-bold text-slate-500">قيمة الفاتورة الكلية:</span>
                <span className="font-black text-blue-700 font-mono">
                  {totalCost.toFixed(2)} {defaultCurrency}
                </span>
              </div>

              {Math.abs(quickSubs.reduce((sum, s) => sum + s.due, 0) - totalCost) > 0.5 && (
                <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 text-[10px]">
                  ⚠️ المجموع الموزع لا يتطابق تماماً مع إجمالي الفاتورة. اضغط "توزيع متساوي" للوزن الملقائي.
                </span>
              )}
            </div>
          </div>
        ) : (
          /* SYSTEM MODE SUBSCRIBERS SELECTION AND CHECKBOXES */
          <div className="border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                تحديد المشتركين المعنيين بالتقسيم والتوزيع
              </h3>

              {/* Quick selectors & Toggles */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-extrabold cursor-pointer"
                >
                  {(() => {
                    const listToCompare = selectionMode === 'individual' ? subscribers : visibleSubscribers;
                    const listToCompareIds = listToCompare.map((s) => s.id);
                    const allSelectedInList = listToCompareIds.length > 0 && listToCompareIds.every((id) => selectedSubIds.includes(id));
                    return allSelectedInList ? 'إلغاء تحديد الكل' : 'تحديد جميع الظاهرين';
                  })()}
                </button>
                
                <span className="text-slate-200">|</span>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('individual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectionMode === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    اختيار فردي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('group');
                      if (allGroups.length > 0 && !selectedGroup) {
                        const firstG = allGroups[0];
                        setSelectedGroup(firstG);
                        const groupSubs = subscribers.filter((s) => s.groups && s.groups.includes(firstG));
                        setSelectedSubIds(groupSubs.map((s) => s.id));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectionMode === 'group' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    حسب المجموعة
                  </button>
                </div>
              </div>
            </div>

            {/* Group filtration badges */}
            {selectionMode === 'group' && (
              <div className="p-4 bg-purple-50/30 border border-purple-100/40 rounded-2xl space-y-2.5">
                <label className="text-xs font-black text-purple-700 flex items-center gap-1.5">
                  <Tags className="w-3.5 h-3.5 text-purple-500" />
                  تصفية وتثبيت الاختيار حسب اسم المجموعة:
                </label>
                
                {allGroups.length === 0 ? (
                  <p className="text-xs font-medium text-slate-400">لا توجد أي مجموعات حالياً. يرجى إعداد مجموعات للمشتركين أولاً.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allGroups.map((g) => {
                      const isChosen = selectedGroup === g;
                      const count = subscribers.filter((s) => s.groups && s.groups.includes(g)).length;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGroup(g);
                            const groupSubs = subscribers.filter((s) => s.groups && s.groups.includes(g));
                            setSelectedSubIds(groupSubs.map((s) => s.id));
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isChosen
                              ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {g} ({count} مشترك)
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Subscribers Grid Box */}
            {subscribers.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <p className="text-sm font-bold text-slate-400 mb-3">لا يوجد أي مشتركين مسجلين في النظام حالياً لتوزيع الاستهلاك عليهم.</p>
                <button
                  type="button"
                  onClick={() => setShowInlineAdd(true)}
                  className="px-5 py-2.5 bg-blue-50 text-blue-600 font-extrabold text-xs rounded-xl hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  أضف أول مشترك الآن
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-56 overflow-y-auto p-1">
                {visibleSubscribers.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">
                    لا يوجد مشتركين لعرضهم تحت التصفية الحالية.
                  </div>
                ) : (
                  visibleSubscribers.map((sub) => {
                    const isSelected = selectedSubIds.includes(sub.id);
                    const stats = calculateSubscriberStats(sub, invoices, payments);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubscriber(sub.id)}
                        className={`flex flex-col p-3.5 rounded-2xl border text-right transition-all cursor-pointer select-none gap-2.5 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/30 text-slate-800 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3.5]" />}
                            </div>
                            <span className="font-extrabold text-xs sm:text-sm text-slate-800">{sub.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">#{sub.subNumber || ''}</span>
                        </div>
                        
                        <div className="w-full text-xs sm:text-sm border-t border-slate-100/60 pt-2 flex justify-between items-center">
                          <span className="text-slate-400 font-bold">الرصيد القائم:</span>
                          {stats.remainingDebt > 0 ? (
                             <span className="font-extrabold text-rose-600 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-100/40">
                               عليه {stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                             </span>
                          ) : stats.remainingDebt < 0 ? (
                             <span className="font-extrabold text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-100/40">
                               له {Math.abs(stats.remainingDebt).toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                             </span>
                          ) : (
                             <span className="font-bold text-slate-400 bg-slate-100/60 px-2.5 py-1 rounded-lg">خالص</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: ORGANIZED DUE AMOUNTS DISTRIBUTION TABLE (SYSTEM MODE ONLY) */}
        {calculatorMode === 'system' && selectedSubIds.length > 0 && totalCost > 0 && (
          <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm space-y-4">
            <div className="bg-slate-50/60 border-b border-slate-100 px-5 py-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4.5 h-4.5 text-blue-500" />
              <h3 className="text-sm font-black text-slate-700">جدول توزيع المبالغ والالتزامات المستحقة على المشتركين</h3>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs sm:text-sm whitespace-nowrap min-w-[550px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-black bg-slate-50/30">
                    <th className="py-3 px-4 text-right">رقم المشترك</th>
                    <th className="py-3 px-4 text-right">اسم المشترك</th>
                    <th className="py-3 px-4 text-left">الرصيد السابق قبل الترحيل</th>
                    <th className="py-3 px-4 text-left font-black text-blue-600">المبلغ المستحق حالياً (نصيبه)</th>
                    <th className="py-3 px-4 text-left">الرصيد الإجمالي المتوقع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedSubIds.map((id) => {
                    const sub = subscribers.find(s => s.id === id);
                    if (!sub) return null;
                    const stats = calculateSubscriberStats(sub, invoices, payments);
                    const currentBalance = stats.remainingDebt;
                    const expectedBalance = currentBalance + sharePerSub;

                    return (
                      <tr key={id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                          #{sub.subNumber || '---'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-800">{sub.name}</span>
                          {sub.groups && sub.groups.length > 0 && (
                            <span className="mr-2 px-1.5 py-0.5 bg-slate-100 text-[9px] text-slate-500 rounded font-bold">
                              {sub.groups.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono font-bold">
                          {currentBalance === 0 ? (
                            <span className="text-slate-400">0.00 {defaultCurrency}</span>
                          ) : currentBalance > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100/20 font-black">+{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}</span>
                          ) : (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/20 font-black">{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono font-black text-blue-700 bg-blue-50/20 rounded-lg">
                          {sharePerSub.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                        </td>
                        <td className="py-3.5 px-4 text-left font-mono font-black text-slate-800">
                          {expectedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Optional Notes */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-600 flex items-center gap-1">
            <PenTool className="w-3.5 h-3.5 text-slate-400" />
            <span>ملاحظات وبيان الفاتورة (تظهر في كشوف الحساب والأرشيف)</span>
          </label>
          <textarea
            id="input-invoice-notes"
            rows={2.5}
            placeholder="مثال: فاتورة استهلاك الدورة الحالية لشهر يونيو 2026 - شامل الضريبة والرسوم الخدمية..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800"
          />
        </div>

        {/* Success/Error Alerts and Save Action */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 lg:p-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex-1 w-full">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2 p-3.5 bg-rose-50 text-rose-700 text-xs sm:text-sm font-bold rounded-xl border border-rose-100"
                >
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2 p-3.5 bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-bold rounded-xl border border-emerald-100"
                >
                  <Check className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>تم احتساب، ترحيل، وحفظ الفاتورة بنجاح في أرشيف الفواتير!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {totalCost > 0 && (
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copied ? 'تم نسخ التقرير بنجاح!' : 'نسخ التقرير للواتساب'}</span>
              </button>
            )}

            <button
              id="btn-submit-invoice"
              type="submit"
              disabled={(calculatorMode === 'system' && (subscribers.length === 0 || selectedSubIds.length === 0)) || totalCost <= 0}
              className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Receipt className="w-4.5 h-4.5" />
              <span>حفظ الفاتورة وترحيل مبالغ الاستهلاك</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
