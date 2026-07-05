/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Invoice, Subscriber, BillCustomization } from '../types';
import { 
  History, 
  Calendar, 
  Trash2, 
  Tag, 
  Zap, 
  Printer,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  Coins
} from 'lucide-react';
import { printSingleInvoice } from '../utils/print';
import { motion, AnimatePresence } from 'motion/react';

interface InvoicesHistoryProps {
  invoices: Invoice[];
  subscribers: Subscriber[];
  onDeleteInvoice: (id: string) => void;
  defaultCurrency?: string;
  currentUserRole?: string;
  billSettings?: BillCustomization;
}

export default function InvoicesHistory({
  invoices,
  subscribers,
  onDeleteInvoice,
  defaultCurrency = 'ش.ج',
  currentUserRole = 'operator',
  billSettings,
}: InvoicesHistoryProps) {
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'standard' | 'composite' | 'expense'>('all');
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_consumption' | 'lowest_consumption' | 'highest_cost' | 'lowest_cost'>('newest');
  
  // Interactive expanded invoice details tracking
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  // Toggle detail breakdown view
  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to map subscriber ID to Name
  const getSubscriberName = (id: string) => {
    return subscribers.find((s) => s.id === id)?.name || 'مشترك محذوف';
  };

  const getSubscriberNumber = (id: string) => {
    return subscribers.find((s) => s.id === id)?.subNumber || '---';
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedSubscriberId('all');
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setSortBy('newest');
  };

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return searchQuery !== '' || 
      selectedType !== 'all' || 
      selectedSubscriberId !== 'all' || 
      dateFilter !== 'all' || 
      startDate !== '' || 
      endDate !== '';
  }, [searchQuery, selectedType, selectedSubscriberId, dateFilter, startDate, endDate]);

  // Apply search, filtration, and sorting logic
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // 1. Filter by Search Query (Invoice ID, subscriber names, or notes)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((invoice, idx) => {
        const indexStr = `فاتورة #${invoices.length - idx}`;
        const invoiceId = invoice.id.toLowerCase();
        const notes = (invoice.notes || '').toLowerCase();
        const day = (invoice.invoiceDay || '').toLowerCase();
        
        // Find if any subscriber name inside the invoice matches the search query
        const matchSubscriber = invoice.subscriberIds.some(id => {
          const name = getSubscriberName(id).toLowerCase();
          const subNum = getSubscriberNumber(id).toString();
          return name.includes(query) || subNum.includes(query);
        });

        return invoiceId.includes(query) || 
               notes.includes(query) || 
               day.includes(query) || 
               indexStr.includes(query) ||
               matchSubscriber;
      });
    }

    // 2. Filter by Invoice Type
    if (selectedType === 'standard') {
      result = result.filter(inv => !inv.isComposite && !inv.isExpense);
    } else if (selectedType === 'composite') {
      result = result.filter(inv => inv.isComposite && !inv.isExpense);
    } else if (selectedType === 'expense') {
      result = result.filter(inv => !!inv.isExpense);
    }

    // 3. Filter by specific Subscriber ID
    if (selectedSubscriberId !== 'all') {
      result = result.filter(inv => inv.subscriberIds.includes(selectedSubscriberId));
    }

    // 4. Filter by Date range
    const now = new Date();
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(inv => new Date(inv.date) >= sevenDaysAgo);
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(inv => new Date(inv.date) >= thirtyDaysAgo);
    } else if (dateFilter === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      result = result.filter(inv => new Date(inv.date) >= startOfMonth);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter(inv => new Date(inv.date) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        result = result.filter(inv => new Date(inv.date) <= end);
      }
    }

    // 5. Apply Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === 'highest_consumption') {
        return b.consumption - a.consumption;
      }
      if (sortBy === 'lowest_consumption') {
        return a.consumption - b.consumption;
      }
      if (sortBy === 'highest_cost') {
        return b.totalCost - a.totalCost;
      }
      if (sortBy === 'lowest_cost') {
        return a.totalCost - b.totalCost;
      }
      return 0;
    });

    return result;
  }, [invoices, subscribers, searchQuery, selectedType, selectedSubscriberId, dateFilter, startDate, endDate, sortBy]);

  // Calculate filtered KPI metrics
  const metrics = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const totalCost = filteredInvoices.reduce((sum, inv) => sum + inv.totalCost, 0);
    const totalConsumption = filteredInvoices.reduce((sum, inv) => sum + inv.consumption, 0);
    const averageCost = totalCount > 0 ? totalCost / totalCount : 0;

    return {
      totalCount,
      totalCost,
      totalConsumption,
      averageCost,
    };
  }, [filteredInvoices]);

  return (
    <div id="invoices-history-section" className="space-y-8" style={{ direction: 'rtl' }}>
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <History className="w-8 h-8 text-blue-600 animate-pulse" />
            <span>سجل وأرشيف الفواتير التاريخية</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-bold mt-1">
            البحث في الفواتير المحفوظة وتصفيتها، ومتابعة تفاصيل توزيع واحتساب التكاليف والكسور لكل مشترك
          </p>
        </div>
      </div>

      {/* KPI METRICS BAR (Visible when there are invoices) */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-5 text-white shadow-md space-y-2 relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 transform rotate-12 transition-transform duration-500 group-hover:scale-110">
              <History className="w-24 h-24" />
            </div>
            <span className="text-xs font-black text-blue-100/90 block uppercase tracking-wider">عدد الفواتير المؤرشفة</span>
            <span className="text-3xl font-black block font-mono">
              {metrics.totalCount} <span className="text-xs font-bold text-blue-100">فاتورة</span>
            </span>
            <span className="text-[10px] text-blue-100/70 font-semibold block">من أصل {invoices.length} إجمالي الفواتير في النظام</span>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl p-5 text-white shadow-md space-y-2 relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 transform rotate-12 transition-transform duration-500 group-hover:scale-110">
              <Zap className="w-24 h-24" />
            </div>
            <span className="text-xs font-black text-amber-100/90 block uppercase tracking-wider">إجمالي استهلاك الطاقة المفلتر</span>
            <span className="text-3xl font-black block font-mono">
              {metrics.totalConsumption.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-amber-100">kWh</span>
            </span>
            <span className="text-[10px] text-amber-100/70 font-semibold block">مجموع الاستهلاك في الفواتير الظاهرة حالياً</span>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-md space-y-2 relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 transform rotate-12 transition-transform duration-500 group-hover:scale-110">
              <Tag className="w-24 h-24" />
            </div>
            <span className="text-xs font-black text-emerald-100/90 block uppercase tracking-wider">إجمالي قيم المبالغ المحتسبة</span>
            <span className="text-3xl font-black block font-mono text-emerald-50">
              {metrics.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-emerald-100">{defaultCurrency}</span>
            </span>
            <span className="text-[10px] text-emerald-100/70 font-semibold block">مجموع مبالغ الاستهلاك للعدادات المفلترة</span>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-5 text-white shadow-md space-y-2 relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 transform rotate-12 transition-transform duration-500 group-hover:scale-110">
              <TrendingUp className="w-24 h-24" />
            </div>
            <span className="text-xs font-black text-purple-100/90 block uppercase tracking-wider">متوسط تكلفة الفاتورة الواحدة</span>
            <span className="text-3xl font-black block font-mono">
              {metrics.averageCost.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-bold text-purple-100">{defaultCurrency}</span>
            </span>
            <span className="text-[10px] text-purple-100/70 font-semibold block">معدل التكلفة التقريبي لكل دورة احتساب</span>
          </div>
        </div>
      )}

      {/* SEARCH & FILTRATION CONTROL PANEL */}
      <div className="bg-slate-50 rounded-3xl border border-slate-200/60 p-5 lg:p-6 space-y-4 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>لوحة التحكم والتصفية الذكية للأرشيف</span>
          </h3>
          {isAnyFilterActive && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-black text-red-600 hover:text-red-700 transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إعادة ضبط وتصفير التصفية</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* 1. Search Query */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500">البحث السريع النصي</label>
            <div className="relative">
              <input
                type="text"
                placeholder="البحث باسم المشترك، رقم الفاتورة، أو الملاحظات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          {/* 2. Invoice Type Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500">نوع الفاتورة</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">كل الأنواع (عادية، مركبة، ومصاريف)</option>
              <option value="standard">فواتير عادية (تقسيم متساوي)</option>
              <option value="composite">فواتير مركبة (رئيسي مع فرعي)</option>
              <option value="expense">مصاريف موزعة مشتركة</option>
            </select>
          </div>

          {/* 3. Sort Order */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500">ترتيب العرض</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="newest">الأحدث تاريخاً أولاً</option>
              <option value="oldest">الأقدم تاريخاً أولاً</option>
              <option value="highest_consumption">الأعلى استهلاكاً (kWh)</option>
              <option value="lowest_consumption">الأقل استهلاكاً (kWh)</option>
              <option value="highest_cost">الأعلى تكلفة ومبلغاً</option>
              <option value="lowest_cost">الأقل تكلفة ومبلغاً</option>
            </select>
          </div>

          {/* 4. Specific Subscriber Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500">تصفية لمشترك معين</label>
            <select
              value={selectedSubscriberId}
              onChange={(e) => setSelectedSubscriberId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">كل المشتركين</option>
              {subscribers.map(sub => (
                <option key={sub.id} value={sub.id}>
                  رقم #{sub.subNumber} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Date Filter Options */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500">النطاق والمدى الزمني</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">كل الأوقات والتاريخ</option>
              <option value="7days">آخر 7 أيام</option>
              <option value="30days">آخر 30 يوماً</option>
              <option value="thisMonth">هذا الشهر الحالي</option>
              <option value="custom">تحديد فترة مخصصة...</option>
            </select>
          </div>

          {/* 6. Custom Date Range inputs (conditional) */}
          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">تاريخ البدء</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">تاريخ النهاية</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILTER RESULTS FEEDBACK */}
      {isAnyFilterActive && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex items-center justify-between gap-4">
          <p className="text-xs font-bold text-blue-800">
            تم تطبيق التصفية. تم العثور على <span className="font-black text-sm">{filteredInvoices.length}</span> فواتير مطابقة من أصل <span className="font-black text-sm">{invoices.length}</span>.
          </p>
          <button
            onClick={handleClearFilters}
            className="text-xs font-black text-blue-600 hover:underline cursor-pointer"
          >
            عرض الكل
          </button>
        </div>
      )}

      {/* INVOICES LIST SECTION */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed border-slate-200 bg-white rounded-3xl shadow-sm space-y-4">
          <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <History className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-600 text-lg font-black">لا توجد أي فواتير مسجلة ومطابقة لخيارات البحث حالياً.</p>
            <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">يرجى تعديل معايير البحث أو تصفية التواريخ، أو تسجيل فاتورة جديدة.</p>
          </div>
          {isAnyFilterActive && (
            <button
              onClick={handleClearFilters}
              className="px-5 py-2 bg-blue-600 text-white font-black text-xs rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-md"
            >
              إلغاء التصفية وعرض جميع الفواتير
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredInvoices.map((invoice) => {
            // Find absolute index of this invoice in original array (for labeling Invoice #Num correctly)
            const origIndex = invoices.findIndex((i) => i.id === invoice.id);
            const displayInvoiceNum = origIndex !== -1 ? invoices.length - origIndex : 'مجهول';
            const isExpanded = !!expandedInvoices[invoice.id];

            const isExp = !!invoice.isExpense;
            const cardBorderClass = isExp 
              ? 'border-amber-100 hover:border-amber-300' 
              : invoice.isComposite 
                ? 'border-slate-100 hover:border-purple-200' 
                : 'border-slate-100 hover:border-blue-200';
            const iconBgClass = isExp 
              ? 'bg-amber-100 text-amber-700' 
              : invoice.isComposite 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700';
            const badgeClass = isExp 
              ? 'bg-amber-50 border-amber-200 text-amber-700' 
              : invoice.isComposite 
                ? 'bg-purple-50 border-purple-200 text-purple-700' 
                : 'bg-blue-50 border-blue-200 text-blue-700';
            const badgeLabel = isExp 
              ? 'مصروف مشترك (موزع بقيد)' 
              : invoice.isComposite 
                ? 'فاتورة مركبة (رئيسي مع فرعي)' 
                : 'فاتورة عادية مشتركة';

            return (
              <div
                id={`invoice-history-card-${invoice.id}`}
                key={invoice.id}
                className={`bg-white border-2 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300 space-y-5 ${cardBorderClass}`}
              >
                {/* Header of Invoice Card */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-50 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl shadow-sm ${iconBgClass}`}>
                      {isExp ? <Coins className="w-6 h-6" /> : invoice.isComposite ? <Layers className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-800 text-base sm:text-lg">
                          {isExp ? 'مصروف #' : 'فاتورة #'}{displayInvoiceNum}
                        </h4>
                        <span className={`px-2.5 py-0.5 border rounded-xl text-[10px] font-black shadow-sm ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5 mt-1">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>
                          {new Date(invoice.date).toLocaleString('en-US', {
                            numberingSystem: 'latn',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {invoice.invoiceDay && (
                          <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-black">
                            {invoice.invoiceDay}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Expand breakdown breakdown button */}
                    <button
                      onClick={() => toggleInvoiceExpand(invoice.id)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center gap-1 font-bold text-xs"
                      title="عرض تفاصيل التقسيم على المشتركين"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                      <span>{isExpanded ? 'إخفاء الحصص' : 'تفاصيل الكسر والشركاء'}</span>
                    </button>

                    {/* Print Button */}
                    <button
                      id={`btn-print-invoice-${invoice.id}`}
                      onClick={() => printSingleInvoice(invoice, subscribers, billSettings)}
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-all cursor-pointer border border-blue-100 flex items-center gap-1 font-bold text-xs"
                      title="طباعة تفاصيل الفاتورة الرسمية"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة</span>
                    </button>

                    {/* Delete Button (Restricted to Admin) */}
                    {currentUserRole === 'admin' && (
                      <button
                        id={`btn-delete-invoice-${invoice.id}`}
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء حصة الفاتورة من ديون جميع المشتركين المشاركين تلقائياً!')) {
                            onDeleteInvoice(invoice.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-100"
                        title="حذف الفاتورة وإلغاء القيد"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Primary Stats block */}
                {isExp ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-50/30 p-4 rounded-2xl border border-amber-100/40">
                    <div className="text-right">
                      <span className="text-[10px] text-amber-600 block font-black mb-1">بيان المصروف وتفاصيله</span>
                      <span className="text-xs sm:text-sm font-black text-slate-700">
                        {invoice.notes || 'مصروف متنوع'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-amber-600 block font-black mb-1">المشتركون والمجموعات المستهدفة</span>
                      <span className="text-xs sm:text-sm font-black text-slate-700">
                        تم التوزيع بالتساوي على {invoice.subscriberIds.length} مشتركين
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-black mb-1">نطاق القراءات للعداد</span>
                      <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                        {invoice.prevReading.toLocaleString('en-US')} ← {invoice.currReading.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-black mb-1">صافي الاستهلاك للعداد</span>
                      <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                        {invoice.consumption.toLocaleString('en-US')} ك.و
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-black mb-1">سعر الكيلوواط</span>
                      <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                        {invoice.pricePerKwh.toLocaleString('en-US')} {defaultCurrency}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-black mb-1">نطاق المسؤولية والتوزيع</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">
                        {invoice.isComposite ? 'عداد فرعي مخصص' : `${invoice.subscriberIds.length} مشتركين بالتساوي`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Financial Summary panel */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/70 to-emerald-50/70 p-4 rounded-2xl border border-slate-100/80 shadow-sm">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-black mb-1">
                      {isExp ? 'القيمة الإجمالية للمصروف' : invoice.isComposite ? 'قيمة الاستهلاك الفعلي للمشترك' : 'المبلغ الكلي المطلوب للعداد الرئيسي'}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-blue-700 font-mono">
                      {invoice.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                    </span>
                  </div>
                  <div className="text-right sm:border-r-2 sm:border-slate-200 sm:pr-4">
                    <span className="text-[10px] text-slate-500 block font-black mb-1">
                      {isExp ? 'حصة كل مشترك (الدين المترتب)' : invoice.isComposite ? 'مبلغ القيد والترحيل كدين' : 'نصيب الفرد المترتب من التقسيم'}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
                      {invoice.sharePerSubscriber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                    </span>
                  </div>
                </div>

                {/* If composite: display Main Meter reference info that it was checked against */}
                {invoice.isComposite && (invoice.mainMeterPrev !== undefined) && (
                  <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-800 border-b border-purple-100 pb-2">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>بيانات مطابقة العداد المغذي الرئيسي المتزامنة</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block">قراءة الرئيسي السابقة</span>
                        <span className="font-mono font-black text-slate-700">{(invoice.mainMeterPrev ?? 0).toLocaleString('en-US')} ك.و</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">قراءة الرئيسي الحالية</span>
                        <span className="font-mono font-black text-slate-700">{(invoice.mainMeterCurr ?? 0).toLocaleString('en-US')} ك.و</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">إجمالي سحب الرئيسي</span>
                        <span className="font-mono font-black text-purple-700">{(invoice.mainMeterConsumption ?? 0).toLocaleString('en-US')} ك.و</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">إجمالي تكلفة الرئيسي</span>
                        <span className="font-mono font-black text-purple-700">{(invoice.mainMeterTotal ?? 0).toLocaleString('en-US')} {defaultCurrency}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* EXPANDABLE COST BREAKDOWN PER SUBSCRIBER */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-2 border-dashed border-slate-100 bg-slate-50/40 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <h5 className="text-xs sm:text-sm font-black text-slate-700 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            <span>{isExp ? 'جدول توزيع ومشاركة مبلغ المصروف على المشتركين' : 'جدول تفصيل توزيع كسر وتكاليف الاستهلاك للشركاء'}</span>
                          </h5>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {isExp ? 'إجمالي عدد المتحملين للمصروف:' : 'العدد الإجمالي للمشتركين:'} {invoice.subscriberIds.length}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-right border-collapse text-xs whitespace-nowrap min-w-[500px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 font-black bg-slate-100/50">
                                <th className="py-2.5 px-3">رقم المشترك</th>
                                <th className="py-2.5 px-3">اسم المشترك الشريك</th>
                                {!isExp && <th className="py-2.5 px-3">الاستهلاك الفردي المحتسب</th>}
                                {!isExp && <th className="py-2.5 px-3">سعر الوحدة</th>}
                                {isExp && <th className="py-2.5 px-3">نوع المطالبة والقيد</th>}
                                <th className="py-2.5 px-3 text-left font-black text-emerald-700">نصيب المستحق كدين</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {invoice.subscriberIds.map((id) => {
                                const sub = subscribers.find((s) => s.id === id);
                                return (
                                  <tr key={id} className="hover:bg-slate-100/40 transition-colors">
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                                      #{sub?.subNumber || getSubscriberNumber(id)}
                                    </td>
                                    <td className="py-2.5 px-3 font-extrabold text-slate-800">
                                      {sub?.name || getSubscriberName(id)}
                                      {sub?.groups && sub.groups.length > 0 && (
                                        <span className="mr-2 px-1 py-0.5 bg-slate-100 rounded text-[9px] text-slate-400 font-bold">
                                          {sub.groups.join(', ')}
                                        </span>
                                      )}
                                    </td>
                                    {!isExp && (
                                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                                        {invoice.isComposite 
                                          ? `${invoice.consumption.toLocaleString('en-US')} ك.و`
                                          : `${(invoice.consumption / invoice.subscriberIds.length).toLocaleString('en-US', { maximumFractionDigits: 1 })} ك.و (حصة متساوية)`
                                        }
                                      </td>
                                    )}
                                    {!isExp && (
                                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                                        {invoice.pricePerKwh.toLocaleString('en-US')} {defaultCurrency}
                                      </td>
                                    )}
                                    {isExp && (
                                      <td className="py-2.5 px-3 font-semibold text-amber-600">
                                        تقسيم متساوٍ للمصروف
                                      </td>
                                    )}
                                    <td className="py-2.5 px-3 font-mono font-black text-emerald-700 text-left bg-emerald-50/20 rounded-md">
                                      {invoice.sharePerSubscriber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {isExp ? (
                          <div className="flex items-start gap-2 bg-amber-50/40 border border-amber-100/50 rounded-xl p-3 text-[10px] text-amber-800 leading-relaxed">
                            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black">ملاحظة توزيع المصروف:</span> تم تقسيم قيمة المصروف الإجمالية البالغة ({invoice.totalCost.toLocaleString('en-US')} {defaultCurrency}) على عدد المشتركين المحدد وهو ({invoice.subscriberIds.length}) بالتساوي تماماً. تم تقييد نصيب كل فرد بمبلغ ({invoice.sharePerSubscriber.toLocaleString('en-US')} {defaultCurrency}) كدين مستحق مضاف تلقائياً في حساباتهم المترتبة.
                            </div>
                          </div>
                        ) : !invoice.isComposite ? (
                          <div className="flex items-start gap-2 bg-blue-50/40 border border-blue-100/50 rounded-xl p-3 text-[10px] text-blue-700 leading-relaxed">
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black">ملاحظة التوزيع بالتساوي:</span> تم احتساب هذه الفاتورة كاستهلاك مغذٍ مشترك. يتم قسمة إجمالي كمية الاستهلاك الفعلي المقدرة بـ ({invoice.consumption} ك.و) وقيمة التكلفة الكلية المقدرة بـ ({invoice.totalCost} {defaultCurrency}) على عدد المشتركين المحددين ({invoice.subscriberIds.length} شريك) بالتساوي تماماً لتكون حصة كل فرد مقيدة بمبلغ ({invoice.sharePerSubscriber} {defaultCurrency}).
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subscribers list details tag */}
                <div className="text-xs space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-start gap-2">
                    <Tag className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-extrabold text-slate-700">المشتركون المشمولون:</span>{' '}
                      <span className="text-slate-600 font-bold leading-relaxed">
                        {invoice.subscriberIds.map(id => getSubscriberName(id)).join('، ')}
                      </span>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-bold">
                      <span className="font-black block mb-1 text-slate-700">ملاحظات الفاتورة والبيان:</span>
                      {invoice.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
