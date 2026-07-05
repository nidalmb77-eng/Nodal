/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Subscriber, Payment, Invoice, BillCustomization } from '../types';
import {
  Coins,
  Search,
  PlusCircle,
  Trash2,
  Printer,
  Phone,
  Calendar,
  User,
  DollarSign,
  Wallet,
  ArrowDownCircle,
  Clock,
  Check,
  Send,
  Sparkles,
  Filter,
  X,
  ArrowUpDown,
  Hash,
  Tags,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateSubscriberStats } from '../utils/storage';

interface PaymentsListProps {
  subscribers: Subscriber[];
  payments: Payment[];
  invoices: Invoice[];
  groupsList: string[];
  onRecordPayment: (subscriberId: string, amount: number, notes?: string) => void;
  onDeletePayment: (id: string) => void;
  defaultCurrency?: string;
  currentUserRole?: string;
  billSettings?: BillCustomization;
}

export default function PaymentsList({
  subscribers,
  payments,
  invoices,
  groupsList,
  onRecordPayment,
  onDeletePayment,
  defaultCurrency = 'ش.ج',
  currentUserRole = 'operator',
  billSettings,
}: PaymentsListProps) {
  // UI states
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [filterSubscriberId, setFilterSubscriberId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // New payment form state
  const [selectedSubId, setSelectedSubId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete confirm modal state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick select amounts
  const quickAmounts = [50, 100, 150, 200, 300, 500];

  // Handle Recording payment
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    onRecordPayment(selectedSubId, parseFloat(paymentAmount), paymentNotes.trim() || undefined);

    // Show success message
    const sub = subscribers.find((s) => s.id === selectedSubId);
    setSuccessMessage(`تم تسجيل سداد بقيمة ${paymentAmount} ${defaultCurrency} للمشترك "${sub?.name || ''}" بنجاح!`);
    
    // Clear form
    setSelectedSubId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setShowAddForm(false);

    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // Printing payment receipt dynamically via a clean styled iframe
  const handlePrintReceipt = (pay: Payment) => {
    const sub = subscribers.find((s) => s.id === pay.subscriberId);
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const formattedDate = new Date(pay.date).toLocaleString('en-US', {
      numberingSystem: 'latn',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>سند قبض - ${pay.subscriberName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          
          @media print {
            body {
              margin: 10px;
              color: #1e293b;
              background: #fff;
            }
          }

          body {
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
            margin: 30px;
            line-height: 1.6;
            background-color: #fff;
          }

          .receipt-container {
            border: 2px solid #e2e8f0;
            border-radius: 16px;
            padding: 25px;
            max-width: 500px;
            margin: 0 auto;
            position: relative;
            background: #fff;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          }

          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            font-size: 60px;
            font-weight: 900;
            color: rgba(16, 185, 129, 0.08);
            pointer-events: none;
            white-space: nowrap;
          }

          .header {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .header h1 {
            font-size: 20px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0;
          }

          .header p {
            font-size: 11px;
            color: #64748b;
            margin: 4px 0 0 0;
            font-weight: 600;
          }

          .receipt-title {
            text-align: center;
            font-size: 16px;
            font-weight: 800;
            color: #10b981;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 6px 12px;
            border-radius: 9999px;
            display: inline-block;
            margin: 0 auto 20px auto;
          }

          .center-wrapper {
            text-align: center;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 8px;
          }

          .info-label {
            font-weight: 700;
            color: #475569;
          }

          .info-value {
            color: #1e293b;
            font-weight: 600;
          }

          .amount-box {
            background-color: #ecfdf5;
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
          }

          .amount-label {
            font-size: 11px;
            color: #047857;
            font-weight: 700;
            display: block;
            margin-bottom: 3px;
          }

          .amount-value {
            font-size: 24px;
            font-weight: 900;
            color: #065f46;
          }

          .footer {
            text-align: center;
            margin-top: 25px;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 15px;
          }

          .signature-area {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            font-size: 11px;
          }

          .sig-box {
            text-align: center;
            width: 120px;
          }

          .sig-line {
            margin-top: 30px;
            border-top: 1px solid #94a3b8;
            padding-top: 4px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="watermark">مَدفُوع</div>
          
          <div class="header">
            ${billSettings?.logo ? `<img src="${billSettings.logo}" style="max-height: 50px; max-width: 140px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto;" />` : ''}
            <h1>${billSettings?.title || 'حسابات العداد الرئيسي'}</h1>
            <p>${billSettings?.subtitle || 'نظام توزيع وإدارة فواتير الكهرباء والعدادات الفرعية'}</p>
            ${billSettings?.contactDetails ? `<div style="font-size: 10px; color: #64748b; margin-top: 4px;">${billSettings.contactDetails}</div>` : ''}
          </div>

          <div class="center-wrapper">
            <span class="receipt-title">سند قبض وإثبات سداد</span>
          </div>

          <div class="info-row">
            <span class="info-label">رقم السند:</span>
            <span class="info-value" style="font-family: monospace;">${pay.id}</span>
          </div>

          <div class="info-row">
            <span class="info-label">اسم المشترك:</span>
            <span class="info-value" style="font-weight: 800; color: #1e3a8a;">${pay.subscriberName}</span>
          </div>

          <div class="info-row">
            <span class="info-label">رقم المشترك:</span>
            <span class="info-value">#${sub?.subNumber || '---'}</span>
          </div>

          <div class="info-row">
            <span class="info-label">تاريخ وتوقيت الدفع:</span>
            <span class="info-value">${formattedDate}</span>
          </div>

          <div class="amount-box">
            <span class="amount-label">المبلغ المقبوض سداداً</span>
            <span class="amount-value">${pay.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${defaultCurrency}</span>
          </div>

          <div class="info-row">
            <span class="info-label">طريقة السداد:</span>
            <span class="info-value">نقدي / حوالة بنكية</span>
          </div>

          <div class="info-row" style="border-bottom: none;">
            <span class="info-label">ملاحظات / تفاصيل:</span>
            <span class="info-value">${pay.notes || 'سداد مستحقات استهلاك الكهرباء'}</span>
          </div>

          <div class="signature-area">
            <div class="sig-box">
              <span class="sig-line">توقيع المستلم</span>
            </div>
            <div class="sig-box">
              <span class="sig-line">توقيع المشترك</span>
            </div>
          </div>

          <div class="footer">
            ${billSettings?.footerText || 'تم إصدار وتوثيق هذا السند إلكترونياً. شكراً لالتزامكم بالسداد.'}
          </div>
        </div>

        <script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
              window.print();
            }, 500);
          });
        </script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 10000);
  };

  // WhatsApp thank you note
  const getWhatsAppReceiptUrl = (pay: Payment) => {
    const sub = subscribers.find((s) => s.id === pay.subscriberId);
    if (!sub || !sub.whatsapp) return null;

    const cleanPhone = sub.whatsapp.replace(/\+/g, '');
    const dateStr = new Date(pay.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const msg = `السلام عليكم ورحمة الله وبركاته، الأخ ${sub.name}. 

تم استلام وتوثيق دفعتكم المالية بقيمة *${pay.amount.toFixed(1)}* ريال سعودي بتاريخ *${dateStr}*. 
شكراً جزيلاً لالتزامكم الطيب بالسداد السريع ومساعدتنا في تنظيم وتوزيع حسابات العداد الرئيسي للكهرباء. 

*تفاصيل السند:*
- رقم السند: ${pay.id.split('-')[1] || pay.id}
- المبلغ المسدد: ${pay.amount.toFixed(1)} ريال سعودي
- البيان: ${pay.notes || 'سداد فاتورة استهلاك'}

دمتم بخير وعافية.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Filter & Search payments logic
  const filteredPayments = payments.filter((pay) => {
    // 1. Search term (by subscriber name or invoice notes)
    const matchesSearch =
      pay.subscriberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pay.notes && pay.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Filter by group
    if (selectedGroup !== 'all') {
      const sub = subscribers.find((s) => s.id === pay.subscriberId);
      if (!sub?.groups?.includes(selectedGroup)) return false;
    }

    // 3. Filter by specific subscriber
    if (filterSubscriberId !== 'all') {
      if (pay.subscriberId !== filterSubscriberId) return false;
    }

    // 4. Filter by start date (from 00:00:00 of that day)
    if (startDate) {
      const payDate = new Date(pay.date);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (payDate < start) return false;
    }

    // 5. Filter by end date (to 23:59:59 of that day)
    if (endDate) {
      const payDate = new Date(pay.date);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (payDate > end) return false;
    }

    return true;
  });

  // Sorting
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortBy === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount;
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  // Calculate Metrics
  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const paymentCount = filteredPayments.length;
  const avgPayment = paymentCount > 0 ? totalPaid / paymentCount : 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 text-right">
      
      {/* Title Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-500" />
            سجل حركة المدفوعات والمقبوضات
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">عرض الدفعات المستلمة من المشتركين، وإصدار وتوثيق سندات القبض</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
            showAddForm
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" />
              إغلاق نافذة السداد
            </>
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              توثيق سداد جديد
            </>
          )}
        </button>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 font-extrabold text-xs sm:text-sm rounded-2xl flex items-center gap-2.5"
          >
            <Check className="w-4 h-4 text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Form Section */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white border border-emerald-100/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3>تسجيل عملية قبض وسداد نقدي جديدة</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Subscriber search select */}
                <div className="md:col-span-5 space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-500 block">اختر المشترك الذي قام بالسداد *</label>
                  <div className="relative">
                    <select
                      required
                      value={selectedSubId}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/60 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- اختر المشترك من القائمة --</option>
                      {subscribers.map((sub) => {
                        return (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                         );
                      })}
                    </select>
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Dynamic Live Balance Badge */}
                  {selectedSubId && (() => {
                    const selectedSub = subscribers.find((s) => s.id === selectedSubId);
                    if (!selectedSub) return null;
                    const stats = calculateSubscriberStats(selectedSub, invoices, payments);
                    return (
                      <div className="mt-2.5 p-3 rounded-2xl text-sm flex justify-between items-center bg-slate-100/60 border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200 shadow-inner">
                        <span className="text-slate-500 font-black text-xs sm:text-sm">الرصيد المستحق حالياً:</span>
                        {stats.remainingDebt > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-100/60 px-3 py-1.5 rounded-xl border border-rose-200 text-sm sm:text-base shadow-sm">
                            عليه {stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                          </span>
                        ) : stats.remainingDebt < 0 ? (
                          <span className="font-black text-emerald-600 bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-200 text-sm sm:text-base shadow-sm">
                            له {Math.abs(stats.remainingDebt).toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency} (رصيد دائن)
                          </span>
                        ) : (
                          <span className="font-black text-slate-500 bg-slate-200/60 px-3 py-1.5 rounded-xl text-sm sm:text-base border border-slate-300">
                            مُسدد بالكامل (خالص)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Amount */}
                <div className="md:col-span-4 space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-500 block">المبلغ المدفوع ({defaultCurrency}) *</label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="أدخل قيمة المبلغ المسدد..."
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50/60 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-black text-slate-800 outline-none transition-all"
                    />
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      {defaultCurrency}
                    </div>
                  </div>
                  
                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quickAmounts.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setPaymentAmount(amt.toString())}
                        className="px-2.5 py-1 text-[10px] sm:text-xs font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 bg-slate-100/60 hover:border-emerald-100 border border-transparent rounded-lg transition-all cursor-pointer"
                      >
                        {amt} {defaultCurrency}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-3 space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-500 block">البيان / ملاحظات إضافية (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: سداد دفعة مايو..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/60 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
                >
                  حفظ الدفعة وتثبيت السداد
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI statistics inside Payments view */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-black text-slate-500 block">إجمالي المقبوضات المستهدفة بالبحث</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight block mt-1">
              {totalPaid.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-sm font-black text-emerald-400">{defaultCurrency}</span>
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 block">عدد سندات القبض المدونة</span>
            <span className="text-xl sm:text-2xl font-black text-blue-600">
              {paymentCount} <span className="text-xs font-bold text-blue-400">سندات</span>
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-black text-slate-500 block">متوسط قيمة المقبوضات</span>
            <span className="text-2xl sm:text-3xl font-black text-purple-600 font-mono tracking-tight block mt-1">
              {avgPayment.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-sm font-black text-purple-400">{defaultCurrency}</span>
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Advanced Filters Block */}
      <div className="bg-white border-2 border-slate-700 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Search bar input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="ابحث باسم المشترك أو تفاصيل الملاحظات المدونة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Advanced Filters Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 border-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                showAdvancedFilters || filterSubscriberId !== 'all' || startDate || endDate
                  ? 'bg-blue-50 border-blue-600 text-blue-700'
                  : 'bg-slate-50 border-slate-700 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>تصفية متطورة</span>
              {(filterSubscriberId !== 'all' || startDate || endDate) && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Filter by group */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-400 flex items-center gap-1">
                <Tags className="w-3.5 h-3.5" />
                المجموعة:
              </span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
              >
                <option value="all">كل المجموعات</option>
                {groupsList.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                الترتيب:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
              >
                <option value="date-desc">التاريخ (الأحدث أولاً)</option>
                <option value="date-asc">التاريخ (الأقدم أولاً)</option>
                <option value="amount-desc">القيمة (الأعلى أولاً)</option>
                <option value="amount-asc">القيمة (الأقل أولاً)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Collapsible Advanced Filters Row */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-slate-100 pt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Specific Subscriber Filter */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 block flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    تصفية حسب مشترك محدد:
                  </label>
                  <select
                    value={filterSubscriberId}
                    onChange={(e) => setFilterSubscriberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
                  >
                    <option value="all">كل المشتركين</option>
                    {subscribers.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} (#{sub.subNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range filters */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 block flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    من تاريخ:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none hover:border-slate-300 text-left"
                  />
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 block flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    إلى تاريخ:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none hover:border-slate-300 text-left"
                  />
                </div>

                {/* Reset filters */}
                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSubscriberId('all');
                      setStartDate('');
                      setEndDate('');
                      setSearchTerm('');
                      setSelectedGroup('all');
                    }}
                    disabled={filterSubscriberId === 'all' && !startDate && !endDate && !searchTerm && selectedGroup === 'all'}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="تصفير كافة الفلاتر النشطة"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>تصفير</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3 border-t border-dashed border-slate-100">
                <span className="text-[10px] font-bold text-slate-400">تصفية سريعة بالتاريخ:</span>
                
                {/* Predefined range presets */}
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="px-2 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-transparent transition-all cursor-pointer"
                >
                  اليوم
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yestStr = yesterday.toISOString().split('T')[0];
                    setStartDate(yestStr);
                    setEndDate(yestStr);
                  }}
                  className="px-2 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-transparent transition-all cursor-pointer"
                >
                  أمس
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    setStartDate(firstDay);
                    setEndDate(lastDay);
                  }}
                  className="px-2 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-transparent transition-all cursor-pointer"
                >
                  هذا الشهر الحالي
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    setStartDate(firstDayPrev);
                    setEndDate(lastDayPrev);
                  }}
                  className="px-2 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-transparent transition-all cursor-pointer"
                >
                  الشهر الماضي
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDayYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    const lastDayYear = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                    setStartDate(firstDayYear);
                    setEndDate(lastDayYear);
                  }}
                  className="px-2 py-1 text-[10px] font-extrabold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-transparent transition-all cursor-pointer"
                >
                  السنة الحالية كاملة
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Receipts Ledger Container */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        {sortedPayments.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
              <Coins className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-600">لا توجد عمليات سداد مطابقة</p>
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                يرجى تعديل معايير البحث والفلترة أو البدء بإضافة سداد جديد للمشتركين لتوثيقه هنا.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold text-xs">
                  <th className="py-4 px-5 font-black text-right">رقم السند</th>
                  <th className="py-4 px-5 font-black text-right">المشترك</th>
                  <th className="py-4 px-5 font-black text-right">تاريخ وتوقيت الدفع</th>
                  <th className="py-4 px-5 font-black text-right">المجموعة</th>
                  <th className="py-4 px-5 font-black text-right">البيان / ملاحظات</th>
                  <th className="py-4 px-5 font-black text-left">قيمة المقبوضات</th>
                  <th className="py-4 px-5 font-black text-center" style={{ width: '150px' }}>سند / إشعار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPayments.map((pay) => {
                  const sub = subscribers.find((s) => s.id === pay.subscriberId);
                  const isConfirmingDelete = confirmDeleteId === pay.id;

                  return (
                    <tr
                      key={pay.id}
                      className="hover:bg-slate-50/50 transition-colors text-xs sm:text-sm font-semibold text-slate-700"
                    >
                      {/* ID */}
                      <td className="py-4 px-5 text-slate-400 font-mono text-[11px] font-bold">
                        {pay.id.split('-')[1] || pay.id}
                      </td>

                      {/* Subscriber Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                            {pay.subscriberName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-black text-slate-800 block">{pay.subscriberName}</span>
                            <span className="text-[10px] text-slate-400 font-bold block">رقم العميل: #{sub?.subNumber || '---'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-5 text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          <span>
                            {new Date(pay.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(pay.date).toLocaleTimeString('ar-EG', { numberingSystem: 'latn',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Subscriber Group Tag */}
                      <td className="py-4 px-5 text-slate-400">
                        {sub?.groups && sub.groups.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-black border border-purple-100">
                            <Tags className="w-2.5 h-2.5" />
                            {sub.groups[0]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-bold">---</span>
                        )}
                      </td>

                      {/* Notes / Remarks */}
                      <td className="py-4 px-5 text-slate-400 font-medium">
                        {pay.notes || <span className="text-slate-300 italic text-[11px]">لا توجد ملاحظات</span>}
                      </td>

                      {/* Amount in Green */}
                      <td className="py-4 px-5 text-left font-black text-emerald-600 text-base font-mono">
                        {pay.amount.toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-center gap-2">
                          {/* Print Receipt Button */}
                          <button
                            onClick={() => handlePrintReceipt(pay)}
                            className="p-1.5 bg-slate-50 text-blue-600 hover:bg-blue-100 border-2 border-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                            title="طباعة سند القبض"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* WhatsApp sharing Button */}
                          {getWhatsAppReceiptUrl(pay) && (
                            <a
                              href={getWhatsAppReceiptUrl(pay)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-50 text-emerald-600 hover:bg-emerald-100 border-2 border-slate-700 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                              title="إرسال إشعار استلام بالواتساب"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          )}

                          {currentUserRole === 'admin' && (
                            isConfirmingDelete ? (
                              <div className="flex items-center gap-1 animate-in slide-in-from-left-2 duration-150">
                                <button
                                  onClick={() => onDeletePayment(pay.id)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black cursor-pointer"
                                >
                                  تأكيد حذف
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-extrabold cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(pay.id)}
                                className="p-1.5 bg-slate-50 text-rose-500 hover:bg-rose-100 border-2 border-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                title="حذف سند السداد"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
