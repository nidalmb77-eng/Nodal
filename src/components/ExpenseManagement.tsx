/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Subscriber, Invoice } from '../types';
import {
  Coins,
  Plus,
  Search,
  Trash2,
  Users,
  Layers,
  Calendar,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Filter,
  Check,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseManagementProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  groupsList: string[];
  defaultCurrency?: string;
  onAddExpense: (name: string, amount: number, date: string, subscriberIds: string[], notes?: string) => void;
  onDeleteInvoice: (id: string) => void;
  currentUserRole?: string;
}

const QUICK_TYPES = [
  'صيانة محول كهربائي كلي',
  'أجور جباية ومتابعة ميدانية',
  'تجديد وتمديد أسلاك نحاسية',
  'شراء لوحة قواطع رئيسية',
  'رسوم وتراخيص بلدية/سنوية',
  'صيانة طوارئ عامة للشبكة'
];

export default function ExpenseManagement({
  subscribers,
  invoices,
  groupsList,
  defaultCurrency = 'ش.ج',
  onAddExpense,
  onDeleteInvoice,
  currentUserRole = 'operator',
}: ExpenseManagementProps) {
  // Form State
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Target Selection Mode: 'groups' | 'individuals'
  const [targetMode, setTargetMode] = useState<'groups' | 'individuals'>('groups');
  
  // Selected Groups (if mode is 'groups')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  
  // Selected Individual Subscribers (if mode is 'individuals')
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');

  // Expense History List State
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Dynamically resolve all registered groups from configuration + actual subscribers
  const registeredGroups = useMemo(() => {
    const fromSubs = subscribers.reduce((acc, sub) => {
      if (sub.groups) {
        sub.groups.forEach(g => {
          if (g && !acc.includes(g)) {
            acc.push(g);
          }
        });
      }
      return acc;
    }, [] as string[]);
    
    const combined = Array.from(new Set([...groupsList, ...fromSubs]))
      .map(g => g.trim())
      .filter(Boolean);
    return combined;
  }, [groupsList, subscribers]);

  // 1. Resolve Target Subscribers based on selection criteria
  const resolvedSubscriberIds = useMemo(() => {
    if (targetMode === 'groups') {
      // Get subscribers who belong to any of the selected groups
      return subscribers
        .filter(s => s.groups && s.groups.some(g => selectedGroups.includes(g)))
        .map(s => s.id);
    }
    if (targetMode === 'individuals') {
      return selectedSubIds;
    }
    return [];
  }, [targetMode, subscribers, selectedGroups, selectedSubIds]);

  // Compute resolved subscribers info
  const resolvedSubscribersInfo = useMemo(() => {
    return subscribers.filter(s => resolvedSubscriberIds.includes(s.id));
  }, [subscribers, resolvedSubscriberIds]);

  // Split calculation
  const sharePerIndividual = useMemo(() => {
    if (resolvedSubscriberIds.length === 0 || !amount || amount <= 0) return 0;
    return amount / resolvedSubscriberIds.length;
  }, [amount, resolvedSubscriberIds]);

  // Search filtered individual subscribers for the selector
  const filteredSelectorSubscribers = useMemo(() => {
    if (!subSearchQuery.trim()) return subscribers;
    const query = subSearchQuery.toLowerCase().trim();
    return subscribers.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.subNumber && s.subNumber.toString().includes(query)) ||
      (s.groups && s.groups.some(g => g.toLowerCase().includes(query)))
    );
  }, [subscribers, subSearchQuery]);

  // Filter historical expenses
  const expenseInvoices = useMemo(() => {
    const list = invoices.filter(inv => !!inv.isExpense);
    if (!historySearchQuery.trim()) return list;
    const q = historySearchQuery.toLowerCase().trim();
    return list.filter(inv => 
      (inv.notes || '').toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q)
    );
  }, [invoices, historySearchQuery]);

  // Handlers
  const handleToggleGroup = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const handleToggleSubscriber = (id: string) => {
    setSelectedSubIds(prev => 
      prev.includes(id) ? prev.filter(subId => subId !== id) : [...prev, id]
    );
  };

  const handleSelectAllSubscribers = () => {
    setSelectedSubIds(subscribers.map(s => s.id));
  };

  const handleDeselectAllSubscribers = () => {
    setSelectedSubIds([]);
  };

  const [formSuccess, setFormSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = expenseName.trim();
    if (!trimmedName) {
      setErrorMessage('يرجى تحديد نوع أو اسم المصروف بشكل واضح.');
      return;
    }

    if (!amount || amount <= 0) {
      setErrorMessage('يرجى إدخال قيمة مالية صحيحة أكبر من صفر.');
      return;
    }

    if (resolvedSubscriberIds.length === 0) {
      setErrorMessage('يرجى تحديد مشترك واحد على الأقل ليتحمل حصته من هذا المصروف.');
      return;
    }

    // Call callback to add expense
    onAddExpense(trimmedName, amount, expenseDate, resolvedSubscriberIds, notes.trim());

    // Show success message and reset form
    setFormSuccess(true);
    setExpenseName('');
    setAmount('');
    setNotes('');
    setSelectedSubIds([]);
    setSelectedGroups([]);
    
    setTimeout(() => {
      setFormSuccess(false);
    }, 5000);
  };

  return (
    <div className="space-y-8" style={{ direction: 'rtl' }}>
      {/* Informative Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-sm shadow-amber-500/20">
          <Coins className="w-6 h-6" />
        </div>
        <div className="space-y-1 text-right">
          <h3 className="text-base sm:text-lg font-black text-slate-800">إدارة المصاريف المشتركة وتوزيع المبالغ آلياً</h3>
          <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed">
            يتيح لك هذا المكون تسجيل المصاريف المتنوعة للشبكة (كالصيانات، المتابعات، رسوم ومواد) ثم تحديد المجموعات أو المشتركين المعنيين لتحميلهم كلفة المصروف. يقوم النظام بتقسيم المبلغ بالتساوي وإضافته تلقائياً كدين قيد مستحق في حساباتهم وليدجر ذممهم المالية.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* RIGHT COLUMN: REGISTER NEW EXPENSE FORM */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-50 pb-4">
            <h4 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-5.5 h-5.5 text-amber-500" />
              <span>تسجيل وتوزيع مصروف تشغيلي جديد</span>
            </h4>
            <p className="text-xs text-slate-400 font-bold mt-1">تعبئة بيانات المصروف لتوليد قيود ديون مخصصة وموزعة آلياً</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Expense Name */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-black text-slate-700">نوع أو بيان المصروف</label>
              <input
                type="text"
                required
                placeholder="مثال: تبديل قواطع الحماية في اللوحة الرئيسية"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              
              {/* Predefined Quick Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setExpenseName(type)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100/80 text-amber-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer border border-amber-100/40"
                  >
                    + {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount & Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-black text-slate-700">القيمة الإجمالية للمصروف</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">
                    {defaultCurrency}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-black text-slate-700">تاريخ القيد والتوزيع</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-black text-slate-700">ملاحظات توضيحية أو أرقام الفواتير (اختياري)</label>
              <textarea
                placeholder="تفاصيل إضافية حول المصروف، أرقام إيصالات الشراء والمورد..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Targeting Options */}
            <div className="space-y-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <label className="block text-xs sm:text-sm font-black text-slate-800">تحديد فئة وقنوات التوزيع للمصروف</label>
                <span className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full font-black">طريقة التوزيع</span>
              </div>

              {/* Selection Tabs */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'groups', title: 'مجموعات محددة', icon: Layers, desc: 'حسب فئة الاشتراك' },
                  { id: 'individuals', title: 'مشتركين أفراد', icon: UserCheck, desc: 'تحديد مخصص بالأسماء' },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isActive = targetMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTargetMode(mode.id as any)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/10'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-[10px] sm:text-xs font-black">{mode.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mode-Specific Sub UI */}
              <AnimatePresence mode="wait">
                {targetMode === 'groups' && (
                  <motion.div
                    key="groups"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-3"
                  >
                    <span className="text-[11px] text-slate-500 font-black block">اختر المجموعات التي ستتحمل المصروف:</span>
                    <div className="flex flex-wrap gap-2">
                      {registeredGroups.map((g) => {
                        const isChecked = selectedGroups.includes(g);
                        const count = subscribers.filter(s => s.groups && s.groups.includes(g)).length;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleToggleGroup(g)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isChecked
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isChecked ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300'}`}>
                              {isChecked && <Check className="w-2.5 h-2.5" />}
                            </span>
                            <span>{g} ({count} مشتركين)</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {targetMode === 'individuals' && (
                  <motion.div
                    key="individuals"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 font-black block">ابحث واختر المشتركين فرادى:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllSubscribers}
                          className="text-[10px] text-blue-600 hover:underline font-black cursor-pointer"
                        >
                          تحديد الجميع ({subscribers.length})
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllSubscribers}
                          className="text-[10px] text-rose-600 hover:underline font-black cursor-pointer"
                        >
                          إلغاء تحديد الكل
                        </button>
                      </div>
                    </div>

                    {/* Search inside selector */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="البحث بالاسم أو رقم المشترك..."
                        value={subSearchQuery}
                        onChange={(e) => setSubSearchQuery(e.target.value)}
                        className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Scrollable list */}
                    <div className="border border-slate-150 rounded-2xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredSelectorSubscribers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold">لا يوجد مشتركين مطابقين للبحث.</div>
                      ) : (
                        filteredSelectorSubscribers.map((sub) => {
                          const isChecked = selectedSubIds.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleToggleSubscriber(sub.id)}
                              className="w-full px-4 py-2 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 text-right"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'border-slate-300'}`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </span>
                                <span className="text-xs font-bold text-slate-700">{sub.name}</span>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                #{sub.subNumber}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Split Preview Panel */}
            <div className="bg-gradient-to-br from-slate-50 to-amber-50/20 border-2 border-dashed border-slate-200/80 rounded-3xl p-5 space-y-4">
              <h5 className="text-xs font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>ملخص ومعاينة الاحتساب الفوري للتقسيم</span>
              </h5>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">إجمالي عدد المشتركين المشمولين</span>
                  <span className="text-xl font-black text-slate-700 font-mono">
                    {resolvedSubscriberIds.length} <span className="text-xs font-semibold text-slate-400">مشتركين</span>
                  </span>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">نصيب الدين الفردي المترتب</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">
                    {sharePerIndividual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-emerald-500">{defaultCurrency}</span>
                  </span>
                </div>
              </div>

              {resolvedSubscribersInfo.length > 0 && (
                <div className="text-[10px] text-slate-500 font-bold bg-white/70 border border-slate-100 rounded-xl p-2.5 max-h-24 overflow-y-auto leading-relaxed">
                  <span className="text-slate-600 font-extrabold block mb-1">قائمة المشتركين المتحملين للقيد:</span>
                  {resolvedSubscribersInfo.map(s => s.name).join('، ')}
                </div>
              )}
            </div>

            {/* Form Success/Error */}
            <AnimatePresence>
              {formSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black p-4 rounded-2xl flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم حفظ وتوزيع المصروف بنجاح كديون مستحقة في حسابات المشتركين وسجل الذمم!</span>
                </motion.div>
              )}

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-black p-4 rounded-2xl flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={resolvedSubscriberIds.length === 0 || !amount || amount <= 0 || !expenseName.trim()}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-amber-500/10 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Coins className="w-4 h-4" />
              <span>تسجيل وتثبيت المصروف وتقييده كدين</span>
            </button>
          </form>
        </div>

        {/* LEFT COLUMN: HISTORY / REGISTERED EXPENSES LIST */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-50 pb-4">
            <h4 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              <span>كشف أرشيف المصاريف المسجلة</span>
            </h4>
            <p className="text-xs text-slate-400 font-bold mt-1">عرض وتدقيق وإلغاء المصاريف الموزعة سابقاً في كشوفات الشبكة</p>
          </div>

          {/* Search inside history list */}
          <div className="relative">
            <input
              type="text"
              placeholder="البحث في بيان وملاحظات المصاريف..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* History scroll list */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {expenseInvoices.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-100 bg-slate-50/30 rounded-2xl space-y-2">
                <Coins className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-black text-slate-500">لا يوجد أي مصاريف مسجلة مطابقة حتى الآن</p>
              </div>
            ) : (
              expenseInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-2xl p-4 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black rounded-lg">
                        مصروف موزع
                      </span>
                      <h5 className="text-xs sm:text-sm font-black text-slate-800 leading-normal">{inv.notes || 'مصروف متنوع'}</h5>
                      
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(inv.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Delete option for administrators */}
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذا المصروف؟ سيتم إلغاء حصة هذا المصروف من ديون جميع المشتركين المسجلين فيه تلقائياً!')) {
                            onDeleteInvoice(inv.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer shrink-0"
                        title="إلغاء قيد المصروف وحذفه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-150 text-[10px]">
                    <div>
                      <span className="text-slate-400 font-bold">المبلغ الإجمالي للمصروف:</span>{' '}
                      <span className="font-extrabold text-slate-800 text-xs">{inv.totalCost.toLocaleString('en-US')} {defaultCurrency}</span>
                    </div>
                    <div className="text-left">
                      <span className="text-slate-400 font-bold">موزع على:</span>{' '}
                      <span className="font-extrabold text-amber-700 text-xs">
                        {inv.subscriberIds.length} مشتركين ({inv.sharePerSubscriber.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}/للفرد)
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
