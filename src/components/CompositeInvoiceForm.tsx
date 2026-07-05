/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Subscriber, Invoice, Payment } from '../types';
import { Calculator, AlertCircle, PlusCircle, Check, Users, Tags, ArrowDownWideNarrow, Layers, Calendar, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CompositeInvoiceFormProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  groupsList?: string[];
  onSaveMultipleInvoices: (newInvoices: Invoice[]) => void;
  defaultCurrency?: string;
  defaultPricePerKwh?: string;
}

// Days of the week in Arabic
const DAYS_OF_WEEK = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت'
];

export default function CompositeInvoiceForm({
  subscribers,
  invoices,
  payments,
  groupsList = [],
  onSaveMultipleInvoices,
  defaultCurrency = 'ش.ج',
  defaultPricePerKwh = '0.5',
}: CompositeInvoiceFormProps) {
  // Main Meter States
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [invoiceDay, setInvoiceDay] = useState<string>('');

  // Auto-fill day name when date changes
  useEffect(() => {
    if (invoiceDate) {
      try {
        const dateObj = new Date(invoiceDate);
        const dayIdx = dateObj.getDay();
        setInvoiceDay(DAYS_OF_WEEK[dayIdx] || '');
      } catch (e) {
        // Fallback
      }
    }
  }, [invoiceDate]);

  // Try to find the last main meter current reading as previous reading for main meter
  const initialMainPrev = useMemo(() => {
    if (invoices.length === 0) return '';
    const sorted = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Find latest composite or standard
    const latestComposite = sorted.find(inv => inv.isComposite && inv.mainMeterCurr !== undefined);
    if (latestComposite && latestComposite.mainMeterCurr) {
      return latestComposite.mainMeterCurr.toString();
    }
    const latestStandard = sorted.find(inv => !inv.isComposite);
    if (latestStandard && latestStandard.currReading) {
      return latestStandard.currReading.toString();
    }
    return sorted[0].currReading.toString();
  }, [invoices]);

  const [mainPrevReading, setMainPrevReading] = useState<string>('');
  const [mainCurrReading, setMainCurrReading] = useState<string>('');
  const [mainPricePerKwh, setMainPricePerKwh] = useState<string>(defaultPricePerKwh);
  const [notes, setNotes] = useState<string>('');

  // Update price when default in settings is updated
  useEffect(() => {
    setMainPricePerKwh(defaultPricePerKwh);
  }, [defaultPricePerKwh]);

  // Update main previous reading when calculated or when mounting
  useEffect(() => {
    if (initialMainPrev) {
      setMainPrevReading(initialMainPrev);
    }
  }, [initialMainPrev]);

  // Main Meter Calculations
  const mainPrev = parseFloat(mainPrevReading) || 0;
  const mainCurr = parseFloat(mainCurrReading) || 0;
  const mainPrice = parseFloat(mainPricePerKwh) || 0;
  const mainConsumption = mainCurr >= mainPrev ? mainCurr - mainPrev : 0;
  const mainTotal = mainConsumption * mainPrice;

  // Subscriber selection mode: 'individual' or 'group'
  const [selectionMode, setSelectionMode] = useState<'individual' | 'group'>('individual');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  // Unique list of groups in system
  const allGroups = useMemo(() => {
    return Array.from(
      new Set([...groupsList, ...subscribers.flatMap((s) => s.groups || [])])
    );
  }, [groupsList, subscribers]);

  // Filter subscribers list by group if needed
  const visibleSubscribers = useMemo(() => {
    if (selectionMode === 'individual') {
      return subscribers;
    }
    if (!selectedGroup) return [];
    return subscribers.filter((s) => s.groups && s.groups.includes(selectedGroup));
  }, [subscribers, selectionMode, selectedGroup]);

  // Auto-select subscribers when choosing a group
  useEffect(() => {
    if (selectionMode === 'group' && selectedGroup) {
      const groupSubIds = subscribers
        .filter((s) => s.groups && s.groups.includes(selectedGroup))
        .map((s) => s.id);
      setSelectedSubIds(groupSubIds);
    } else if (selectionMode === 'individual') {
      // Keep existing selection or clear if needed. Let's keep it but bound to existing subscribers
      setSelectedSubIds(prev => prev.filter(id => subscribers.some(s => s.id === id)));
    }
  }, [selectionMode, selectedGroup, subscribers]);

  // Subscriber input data: prevReading, currReading, pricePerKwh
  const [subscriberInputs, setSubscriberInputs] = useState<Record<string, {
    prevReading: string;
    currReading: string;
    pricePerKwh: string;
  }>>({});

  // Get helper to retrieve latest sub-meter current reading
  const getLastSubReading = (subId: string): string => {
    const subInvoices = invoices.filter(inv => inv.subscriberIds.includes(subId));
    if (subInvoices.length === 0) {
      // check if subscriber has opening balance or default to 0
      const sub = subscribers.find(s => s.id === subId);
      return '0';
    }
    // Sort descending by date
    const sorted = [...subInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].currReading.toString();
  };

  // Whenever selectedSubIds change, initialize missing inputs
  useEffect(() => {
    setSubscriberInputs(prev => {
      const next = { ...prev };
      let updated = false;
      selectedSubIds.forEach(id => {
        if (!next[id]) {
          next[id] = {
            prevReading: getLastSubReading(id),
            currReading: '',
            pricePerKwh: mainPricePerKwh,
          };
          updated = true;
        } else {
          // Sync default price if it wasn't edited or if empty
          if (!next[id].pricePerKwh) {
            next[id].pricePerKwh = mainPricePerKwh;
            updated = true;
          }
        }
      });
      return updated ? next : prev;
    });
  }, [selectedSubIds, mainPricePerKwh, invoices, subscribers]);

  // Individual handles for sub-meter inputs
  const handleSubInputChange = (subId: string, field: 'prevReading' | 'currReading' | 'pricePerKwh', value: string) => {
    setSubscriberInputs(prev => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        [field]: value
      }
    }));
  };

  // Calculations for selected subscribers
  const subCalculations = useMemo(() => {
    return selectedSubIds.map(id => {
      const sub = subscribers.find(s => s.id === id);
      const inputs = subscriberInputs[id] || { prevReading: '0', currReading: '', pricePerKwh: mainPricePerKwh };
      
      const prev = parseFloat(inputs.prevReading) || 0;
      const curr = parseFloat(inputs.currReading) || 0;
      const price = parseFloat(inputs.pricePerKwh) || 0;
      
      const consumption = curr >= prev ? curr - prev : 0;
      const total = consumption * price;

      return {
        id,
        name: sub?.name || 'مشترك محذوف',
        subNumber: sub?.subNumber || 0,
        prev,
        curr,
        consumption,
        price,
        total,
        hasError: curr < prev,
      };
    });
  }, [selectedSubIds, subscriberInputs, subscribers, mainPricePerKwh]);

  // Totals for sub-meters
  const subMetersTotalConsumption = useMemo(() => {
    return subCalculations.reduce((sum, item) => sum + item.consumption, 0);
  }, [subCalculations]);

  const subMetersTotalCost = useMemo(() => {
    return subCalculations.reduce((sum, item) => sum + item.total, 0);
  }, [subCalculations]);

  // Differences/Remeaning
  const remainingConsumption = mainConsumption - subMetersTotalConsumption;
  const remainingCost = mainTotal - subMetersTotalCost;

  // Validation & Save States
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const handleToggleSubId = (id: string) => {
    if (selectedSubIds.includes(id)) {
      setSelectedSubIds(selectedSubIds.filter(subId => subId !== id));
    } else {
      setSelectedSubIds([...selectedSubIds, id]);
    }
  };

  const handleSelectAll = () => {
    const listToCompare = selectionMode === 'individual' ? subscribers : visibleSubscribers;
    const listToCompareIds = listToCompare.map((s) => s.id);
    const allSelectedInList = listToCompareIds.length > 0 && listToCompareIds.every((id) => selectedSubIds.includes(id));

    if (allSelectedInList) {
      setSelectedSubIds(selectedSubIds.filter((id) => !listToCompareIds.includes(id)));
    } else {
      const uniqueNewSubIds = Array.from(new Set([...selectedSubIds, ...listToCompareIds]));
      setSelectedSubIds(uniqueNewSubIds);
    }
  };

  const handleSaveInvoiceForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!mainPrevReading || !mainCurrReading || !mainPricePerKwh) {
      setError('يرجى ملء جميع الحقول المطلوبة للعداد الرئيسي.');
      return;
    }

    if (mainCurr < mainPrev) {
      setError('القراءة الحالية للعداد الرئيسي يجب أن تكون أكبر من أو تساوي القراءة السابقة.');
      return;
    }

    if (selectedSubIds.length === 0) {
      setError('يرجى اختيار مشترك واحد على الأقل وتعبئة بياناته.');
      return;
    }

    // Check if any sub-meter has invalid inputs or current < previous
    const hasSubErrors = subCalculations.some(item => item.hasError || !subscriberInputs[item.id]?.currReading);
    if (hasSubErrors) {
      setError('يرجى تعبئة قراءات المشتركين الفرعية بشكل صحيح (القراءة الحالية يجب أن تكون أكبر من السابقة).');
      return;
    }

    setError('');

    // Generate separate Invoice records for each selected sub-meter
    const generatedInvoices: Invoice[] = subCalculations.map((sub, index) => {
      return {
        id: `composite-sub-${sub.id}-${Date.now()}-${index}`,
        date: new Date(invoiceDate).toISOString(),
        prevReading: sub.prev,
        currReading: sub.curr,
        consumption: sub.consumption,
        pricePerKwh: sub.price,
        totalCost: sub.total,
        subscriberIds: [sub.id],
        sharePerSubscriber: sub.total,
        notes: `فاتورة كهرباء فرعية مركبة. العداد الرئيسي قراءته: من ${mainPrev} إلى ${mainCurr} (${mainConsumption} ك.و) بسعر ${mainPrice} ${defaultCurrency}. اليوم: ${invoiceDay}. ${notes.trim() ? `ملاحظات: ${notes.trim()}` : ''}`,
        isComposite: true,
        mainMeterPrev: mainPrev,
        mainMeterCurr: mainCurr,
        mainMeterConsumption: mainConsumption,
        mainMeterPrice: mainPrice,
        mainMeterTotal: mainTotal,
        invoiceDay: invoiceDay,
      };
    });

    onSaveMultipleInvoices(generatedInvoices);

    // Reset Form
    setMainPrevReading(mainCurrReading); // Convenient for next bill!
    setMainCurrReading('');
    setNotes('');
    
    // Clear sub readings
    setSelectedSubIds([]);
    setSelectedGroup('');
    setSubscriberInputs({});
    
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div id="composite-invoice-section" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 space-y-8">
      
      {/* Tab Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">إصدار فاتورة كهرباء مركبة (الرئيسي مع الفرعي)</h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">تسجيل قراءة العداد الرئيسي واحتساب سحب المشتركين الفرعيين وموازنة الفروق تلقائياً</p>
        </div>
      </div>

      <form onSubmit={handleSaveInvoiceForm} className="space-y-8">
        
        {/* SECTION 1: MAIN METER DETAILS */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-5">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            بيانات وقراءات العداد الرئيسي (المغذي)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                اليوم
              </label>
              <select
                value={invoiceDay}
                onChange={(e) => setInvoiceDay(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                التاريخ
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-sm text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                سعر كيلوواط الرئيسي ({defaultCurrency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={mainPricePerKwh}
                onChange={(e) => setMainPricePerKwh(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                dir="ltr"
                placeholder="0.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                القراءة السابقة للرئيسي (kWh) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={mainPrevReading}
                onChange={(e) => setMainPrevReading(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                dir="ltr"
                placeholder="قراءة سابقة"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                القراءة الحالية للرئيسي (kWh) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={mainCurrReading}
                onChange={(e) => setMainCurrReading(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                dir="ltr"
                placeholder="قراءة حالية"
              />
            </div>

            <div className="bg-blue-50/60 border border-blue-100/30 rounded-2xl p-3 flex flex-col justify-center text-center">
              <span className="text-[10px] text-blue-500 font-bold block mb-0.5">كمية سحب العداد الرئيسي</span>
              <span className="text-base font-black text-blue-900 font-mono">
                {mainConsumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-[10px] font-bold">kWh</span>
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100/30 rounded-2xl p-3 flex flex-col justify-center text-center">
              <span className="text-[10px] text-emerald-600 font-bold block mb-0.5">الإجمالي الكلي للرئيسي</span>
              <span className="text-base font-black text-emerald-900 font-mono">
                {mainTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })} <span className="text-[10px] font-bold">{defaultCurrency}</span>
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: SELECT SUBSCRIBERS */}
        <div className="border border-slate-100 rounded-3xl p-5 lg:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              اختيار وتحديد المشتركين المعنيين (الفرعيين)
            </h3>

            {/* Selection Mode Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start">
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
                onClick={() => setSelectionMode('group')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectionMode === 'group' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                حسب المجموعة
              </button>
            </div>
          </div>

          {/* Group Selector Dropdown */}
          {selectionMode === 'group' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl max-w-md space-y-1.5">
              <label className="text-xs font-black text-slate-500">اختر المجموعة لربط أعضائها:</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:outline-none"
              >
                <option value="">-- حدد المجموعة --</option>
                {allGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {/* Interactive Checkbox List for subscribers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500">
              <span>قائمة تحديد المشتركين</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {visibleSubscribers.length > 0 && visibleSubscribers.every(s => selectedSubIds.includes(s.id)) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
              {visibleSubscribers.map((sub) => {
                const isChecked = selectedSubIds.includes(sub.id);
                return (
                  <div
                    key={sub.id}
                    onClick={() => handleToggleSubId(sub.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/20 text-blue-900'
                        : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold">{sub.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">#{sub.subNumber || ''}</span>
                  </div>
                );
              })}
              
              {visibleSubscribers.length === 0 && (
                <div className="col-span-full text-center py-6 text-xs font-semibold text-slate-300">
                  {selectionMode === 'group' ? 'يرجى اختيار مجموعة أولاً لعرض مشتركيها' : 'لا يوجد مشتركون متاحون في النظام.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: EDIT INDIVIDUAL SUB-METERS (القراءات الفرعية للمشتركين بعد اختيارهم) */}
        {selectedSubIds.length > 0 && (
          <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm space-y-4">
            <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                تعبئة بيانات وسحب العدادات الفرعية للمشتركين المحددين
              </h3>
            </div>

            <div className="p-4 sm:p-5 overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs sm:text-sm whitespace-nowrap min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/40 rounded-xl">
                    <th className="py-3 px-4 font-black">اسم المشترك / العداد</th>
                    <th className="py-3 px-4 font-black">القراءة السابقة (kWh)</th>
                    <th className="py-3 px-4 font-black">القراءة الحالية (kWh)</th>
                    <th className="py-3 px-4 font-black text-center">كمية السحب</th>
                    <th className="py-3 px-4 font-black text-left">سعر الكيلوواط ({defaultCurrency})</th>
                    <th className="py-3 px-4 font-black text-left">الإجمالي ({defaultCurrency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subCalculations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col text-right">
                          <span className="font-extrabold text-slate-800">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">عداد #{item.subNumber || ''}</span>
                        </div>
                      </td>
                      
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          required
                          value={subscriberInputs[item.id]?.prevReading || '0'}
                          onChange={(e) => handleSubInputChange(item.id, 'prevReading', e.target.value)}
                          className="w-28 px-3 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 text-left"
                          dir="ltr"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          required
                          value={subscriberInputs[item.id]?.currReading || ''}
                          onChange={(e) => handleSubInputChange(item.id, 'currReading', e.target.value)}
                          className={`w-28 px-3 py-1.5 border rounded-lg font-mono font-bold text-slate-700 text-left focus:ring-2 ${
                            item.hasError
                              ? 'border-rose-500 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:ring-blue-500/10'
                          }`}
                          dir="ltr"
                          placeholder="أدخل الحالية"
                        />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                          {item.consumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh
                        </span>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <input
                          type="number"
                          step="any"
                          required
                          value={subscriberInputs[item.id]?.pricePerKwh || mainPricePerKwh}
                          onChange={(e) => handleSubInputChange(item.id, 'pricePerKwh', e.target.value)}
                          className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 text-left"
                          dir="ltr"
                        />
                      </td>

                      <td className="py-3 px-4 text-left">
                        <span className="font-mono font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                          {item.total.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {defaultCurrency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 4: DETAILED BOTTOM BALANCES SUMMARY & FORM CONTROLS */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 lg:p-8 space-y-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-4">خلاصة ومطابقة الفاتورة المركبة والعدادات الفرعية</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">إجمالي سحب العدادات الفرعية</span>
              <p className="text-lg font-black text-slate-800 font-mono">
                {subMetersTotalConsumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-400">kWh</span>
              </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">إجمالي مجموع مبالغ المشتركين</span>
              <p className="text-lg font-black text-blue-600 font-mono">
                {subMetersTotalCost.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-400">{defaultCurrency}</span>
              </p>
            </div>

            <div className={`border rounded-2xl p-4 flex flex-col justify-between shadow-sm ${
              remainingConsumption < 0 ? 'bg-rose-50/50 border-rose-100 text-rose-900' : 'bg-white border-slate-100'
            }`}>
              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">فارق الاستهلاك (رئيسي - فرعي)</span>
              <p className="text-lg font-black font-mono">
                {remainingConsumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-400">kWh</span>
              </p>
              <span className="text-[9px] font-bold text-slate-400 mt-0.5">سحب العداد الرئيسي مطروحاً منه العدادات الفرعية</span>
            </div>

            <div className={`border rounded-2xl p-4 flex flex-col justify-between shadow-sm ${
              remainingCost < 0 ? 'bg-rose-50/50 border-rose-100 text-rose-900' : 'bg-white border-slate-100'
            }`}>
              <span className="text-[10px] text-slate-400 font-extrabold block mb-1">فارق المبلغ المالي المتبقي</span>
              <p className="text-lg font-black font-mono">
                {remainingCost.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-400">{defaultCurrency}</span>
              </p>
              <span className="text-[9px] font-bold text-slate-400 mt-0.5">مبلغ العداد الرئيسي مطروحاً منه إجمالي العدادات الفرعية</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات الفاتورة المركبة (تظهر في كشف الحساب)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="مثال: فاتورة مجمع الشقق السكنية لشهر يونيو 2026..."
            />
          </div>

          {/* Form Actions with Errors */}
          <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 flex items-center gap-2 text-xs font-bold"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 flex items-center gap-2 text-xs font-bold"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>تم احتساب وتوزيع الفاتورة المركبة وحفظها بنجاح لجميع المشتركين المحددين!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Calculator className="w-4.5 h-4.5" />
              <span>حفظ الفاتورة المركبة وتوزيع القيد</span>
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}
