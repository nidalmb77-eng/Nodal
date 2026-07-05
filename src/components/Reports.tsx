/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Subscriber, Invoice, Payment, BillCustomization } from '../types';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  FileBarChart2,
  TrendingUp,
  Coins,
  Users,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  ChevronDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Sparkles,
  PieChart,
  BarChart,
  ArrowUpDown,
  AlertCircle,
  BookmarkCheck,
  Percent,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateSubscriberStats, getSubscriberLedger } from '../utils/storage';
import ExpenseManagement from './ExpenseManagement';

interface ReportsProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  groupsList: string[];
  defaultCurrency?: string;
  billSettings?: BillCustomization;
  onAddExpense?: (name: string, amount: number, date: string, subscriberIds: string[], notes?: string) => void;
  onDeleteInvoice?: (id: string) => void;
  currentUserRole?: string;
}

type ReportType = 
  | 'overview' 
  | 'subscribers-balances' 
  | 'subscribers-ledger' 
  | 'invoices-period' 
  | 'subscribers-simple' 
  | 'monthly-analysis' 
  | 'group-summary'
  | 'expenses';

export default function Reports({
  subscribers,
  invoices,
  payments,
  groupsList,
  defaultCurrency = 'ش.ج',
  billSettings,
  onAddExpense = () => {},
  onDeleteInvoice = () => {},
  currentUserRole = 'operator',
}: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('overview');
  const [chartType, setChartType] = useState<'stacked' | 'grouped' | 'line'>('stacked');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'has-debt' | 'has-credit' | 'clear'>('all');

  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // --- NEW REPORTS STATE ---
  const [selectedSubId, setSelectedSubId] = useState<string>(subscribers[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // default to 1 month ago
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // --- NEW REPORTS CALCULATIONS ---
  const selectedSubscriber = useMemo(() => {
    return subscribers.find(s => s.id === selectedSubId) || subscribers[0] || null;
  }, [subscribers, selectedSubId]);

  const subscriberLedgerData = useMemo(() => {
    if (!selectedSubscriber) return [];
    const baseLedger = getSubscriberLedger(selectedSubscriber, invoices, payments);
    const sortedAsc = [...baseLedger].reverse();

    let balance = 0;
    return sortedAsc.map((entry) => {
      const debit = entry.type === 'invoice' ? entry.amount : 0;
      const credit = entry.type === 'payment' ? entry.amount : 0;
      balance = balance + debit - credit;
      
      const dateObj = new Date(entry.date);
      const dayName = dateObj.toLocaleDateString('ar-EG', { numberingSystem: 'latn', weekday: 'long' });
      const formattedDate = dateObj.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' });

      return {
        ...entry,
        dayName,
        formattedDate,
        debit,
        credit,
        runningBalance: balance
      };
    });
  }, [selectedSubscriber, invoices, payments]);

  const invoicesByPeriod = useMemo(() => {
    return (invoices || []).filter((inv) => {
      if (!inv || !inv.date) return false;
      const invTime = new Date(inv.date).getTime();
      const startTime = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const endTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      if (startTime && invTime < startTime) return false;
      if (endTime && invTime > endTime) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first
  }, [invoices, startDate, endDate]);

  const invoicesPeriodStats = useMemo(() => {
    const totalConsumption = invoicesByPeriod.reduce((sum, inv) => sum + (inv.consumption || 0), 0);
    const totalBilled = invoicesByPeriod.reduce((sum, inv) => sum + ((inv.sharePerSubscriber || 0) * (inv.subscriberIds?.length || 0)), 0);
    return {
      totalConsumption,
      totalBilled
    };
  }, [invoicesByPeriod]);

  const subscribersSimpleList = useMemo(() => {
    return (subscribers || []).map((sub) => {
      const subStats = calculateSubscriberStats(sub, invoices, payments);
      return {
        id: sub.id,
        name: sub.name || '',
        balance: subStats.remainingDebt, // positive is debt, negative is credit
      };
    }).sort((a, b) => b.balance - a.balance); // sort by highest debt first
  }, [subscribers, invoices, payments]);

  const totalSubscribersBalances = useMemo(() => {
    return subscribersSimpleList.reduce((sum, sub) => sum + sub.balance, 0);
  }, [subscribersSimpleList]);

  // --- GENERAL STATS CALCULATIONS ---
  const stats = useMemo(() => {
    const totalConsumption = (invoices || []).reduce((sum, inv) => sum + (inv?.consumption || 0), 0);
    const totalBilled = (invoices || []).reduce((sum, inv) => {
      if (!inv || !inv.subscriberIds) return sum;
      return sum + ((inv.sharePerSubscriber || 0) * inv.subscriberIds.length);
    }, 0);
    const totalPaid = (payments || []).reduce((sum, pay) => sum + (pay?.amount || 0), 0);
    const totalOpeningBal = (subscribers || []).reduce((sum, sub) => sum + (sub?.openingBalance || 0), 0);
    
    // Net Debt = (Opening balances + Total Distributed Billed) - Total Paid
    const netDebt = (totalOpeningBal + totalBilled) - totalPaid;
    
    const denominator = totalBilled + totalOpeningBal;
    let collectionRate = denominator > 0 ? (totalPaid / denominator) * 100 : 100;

    if (isNaN(collectionRate) || !isFinite(collectionRate)) {
      collectionRate = 100;
    }

    return {
      totalConsumption,
      totalBilled,
      totalPaid,
      totalOpeningBal,
      netDebt,
      collectionRate: Math.min(100, Math.max(0, collectionRate)),
    };
  }, [subscribers, invoices, payments]);

  // --- MONTHLY BILLING & COLLECTIONS GROUPING ---
  const monthlyData = useMemo(() => {
    const monthsMap: { [key: string]: { month: string; billed: number; collected: number; consumption: number } } = {};

    // Map invoices
    invoices.forEach((inv) => {
      const date = new Date(inv.date);
      const monthKey = date.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: 'long' });
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { month: monthKey, billed: 0, collected: 0, consumption: 0 };
      }
      monthsMap[monthKey].billed += inv.sharePerSubscriber * inv.subscriberIds.length;
      monthsMap[monthKey].consumption += inv.consumption;
    });

    // Map payments
    payments.forEach((pay) => {
      const date = new Date(pay.date);
      const monthKey = date.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: 'long' });
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { month: monthKey, billed: 0, collected: 0, consumption: 0 };
      }
      monthsMap[monthKey].collected += pay.amount;
    });

    // Convert map to array and sort chronologically (safely)
    return Object.values(monthsMap).reverse(); // Standard reverse to keep newest first or sort chronologically
  }, [invoices, payments]);

  // --- CHRONOLOGICAL DATA FOR RECHARTS ---
  const chronologicalChartData = useMemo(() => {
    const tempMap: { [key: string]: { yearMonth: string; month: string; billed: number; collected: number; consumption: number } } = {};

    invoices.forEach((inv) => {
      if (!inv.date) return;
      const date = new Date(inv.date);
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const sortKey = `${year}-${month}`;
      const monthLabel = date.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: 'long' });

      if (!tempMap[sortKey]) {
        tempMap[sortKey] = { yearMonth: sortKey, month: monthLabel, billed: 0, collected: 0, consumption: 0 };
      }
      tempMap[sortKey].billed += (inv.sharePerSubscriber || 0) * (inv.subscriberIds?.length || 0);
      tempMap[sortKey].consumption += (inv.consumption || 0);
    });

    payments.forEach((pay) => {
      if (!pay.date) return;
      const date = new Date(pay.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const sortKey = `${year}-${month}`;
      const monthLabel = date.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: 'long' });

      if (!tempMap[sortKey]) {
        tempMap[sortKey] = { yearMonth: sortKey, month: monthLabel, billed: 0, collected: 0, consumption: 0 };
      }
      tempMap[sortKey].collected += (pay.amount || 0);
    });

    return Object.values(tempMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [invoices, payments]);

  // --- SUBSCRIBERS BALANCES LEDGER ---
  const subscribersReportData = useMemo(() => {
    return (subscribers || []).map((sub) => {
      const subStats = calculateSubscriberStats(sub, invoices, payments);
      return {
        id: sub.id,
        subNumber: sub.subNumber || 0,
        name: sub.name || '',
        groups: sub.groups || [],
        phone: sub.phone,
        whatsapp: sub.whatsapp,
        openingBalance: sub.openingBalance || 0,
        totalBilled: subStats.totalDebt,
        totalPaid: subStats.totalPaid,
        balance: subStats.remainingDebt, // positive is debt (عليه), negative is credit (له)
      };
    });
  }, [subscribers, invoices, payments]);

  // Filtered subscribers list
  const filteredSubscribersReport = useMemo(() => {
    return subscribersReportData.filter((sub) => {
      const matchesSearch = (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (sub.subNumber || '').toString().includes(searchTerm);
      const matchesGroup = selectedGroup === 'all' || (sub.groups || []).includes(selectedGroup);
      
      let matchesDebt = true;
      if (debtFilter === 'has-debt') matchesDebt = sub.balance > 0;
      else if (debtFilter === 'has-credit') matchesDebt = sub.balance < 0;
      else if (debtFilter === 'clear') matchesDebt = Math.abs(sub.balance) < 0.1;

      return matchesSearch && matchesGroup && matchesDebt;
    });
  }, [subscribersReportData, searchTerm, selectedGroup, debtFilter]);

  // --- GROUP BALANCES & METRICS ---
  const groupMetrics = useMemo(() => {
    const metrics: { [key: string]: { groupName: string; subscribersCount: number; totalBilled: number; totalPaid: number; totalDebt: number } } = {};

    groupsList.forEach((group) => {
      metrics[group] = { groupName: group, subscribersCount: 0, totalBilled: 0, totalPaid: 0, totalDebt: 0 };
    });
    metrics['غير مصنف'] = { groupName: 'غير مصنف', subscribersCount: 0, totalBilled: 0, totalPaid: 0, totalDebt: 0 };

    subscribersReportData.forEach((sub) => {
      const subGroups = sub.groups && sub.groups.length > 0 ? sub.groups : ['غير مصنف'];
      subGroups.forEach((g) => {
        if (!metrics[g]) {
          metrics[g] = { groupName: g, subscribersCount: 0, totalBilled: 0, totalPaid: 0, totalDebt: 0 };
        }
        metrics[g].subscribersCount += 1;
        metrics[g].totalBilled += sub.totalBilled;
        metrics[g].totalPaid += sub.totalPaid;
        metrics[g].totalDebt += sub.balance;
      });
    });

    return Object.values(metrics).filter(m => m.subscribersCount > 0);
  }, [subscribersReportData, groupsList]);

  // --- GROUP MONTHLY CONSUMPTION DATA FOR RECHARTS ---
  const GROUP_COLORS = useMemo(() => [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#64748b'  // slate-500
  ], []);

  const allGroupNames = useMemo(() => {
    const list = [...groupsList];
    if (!list.includes('غير مصنف')) {
      list.push('غير مصنف');
    }
    return list;
  }, [groupsList]);

  const groupMonthlyConsumptionData = useMemo(() => {
    const tempMap: { 
      [yearMonth: string]: { 
        sortKey: string; 
        monthName: string; 
        [groupName: string]: any; 
      } 
    } = {};

    // Initialize group fields for all months to 0 to prevent Recharts rendering issues
    const initialGroupValues: { [group: string]: number } = {};
    allGroupNames.forEach(g => {
      initialGroupValues[g] = 0;
    });

    // Calculate each subscriber's group list for fast lookup
    const subscriberGroupsMap: { [subId: string]: string[] } = {};
    subscribers.forEach(sub => {
      subscriberGroupsMap[sub.id] = sub.groups && sub.groups.length > 0 ? sub.groups : ['غير مصنف'];
    });

    // Distribute invoice consumption
    invoices.forEach((inv) => {
      if (!inv.date) return;
      const date = new Date(inv.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const sortKey = `${year}-${month}`;
      const monthName = date.toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: 'long' });

      if (!tempMap[sortKey]) {
        tempMap[sortKey] = {
          sortKey,
          monthName,
          ...initialGroupValues
        };
      }

      const subIds = inv.subscriberIds || [];
      if (subIds.length === 0) return;

      const consumptionPerSubscriber = (inv.consumption || 0) / subIds.length;

      subIds.forEach((subId) => {
        const sGroups = subscriberGroupsMap[subId] || ['غير مصنف'];
        sGroups.forEach((g) => {
          const portion = consumptionPerSubscriber / sGroups.length;
          tempMap[sortKey][g] = (tempMap[sortKey][g] || 0) + portion;
        });
      });
    });

    // Convert to array and sort chronologically (oldest to newest for charts)
    return Object.values(tempMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(item => {
        const roundedItem: any = { ...item };
        allGroupNames.forEach(g => {
          if (roundedItem[g]) {
            roundedItem[g] = Math.round(roundedItem[g] * 10) / 10; // 1 decimal place
          }
        });
        return roundedItem;
      });
  }, [invoices, subscribers, allGroupNames]);

  // Recharts Helper Components
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white p-4 rounded-2xl shadow-xl text-right text-xs space-y-2 font-sans" dir="rtl">
          <p className="font-black border-b border-slate-800 pb-1.5 text-slate-300">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-400">مجموعة {entry.name}:</span>
                </div>
                <span className="font-extrabold font-mono text-emerald-400">
                  {entry.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh
                </span>
              </div>
            ))}
          </div>
          {payload.length > 1 && (
            <div className="border-t border-slate-800 pt-1.5 mt-1.5 flex justify-between items-center text-[10px] font-bold text-slate-300">
              <span>إجمالي الاستهلاك:</span>
              <span className="font-extrabold text-white font-mono">
                {payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs font-bold text-slate-600" dir="rtl">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>مجموعة {entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // --- EXPORT TO CSV FUNCTION ---
  const handleExportCSV = (type: ReportType) => {
    let csvContent = '';
    let fileName = '';

    if (type === 'subscribers-balances') {
      fileName = 'تقرير_أرصدة_المشتركين.csv';
      // UTF-8 BOM for Arabic support in Excel
      csvContent = '\uFEFF';
      csvContent += `رقم المشترك,اسم المشترك,المجموعة,الرصيد الافتتاحي (${defaultCurrency}),إجمالي الفواتير (${defaultCurrency}),إجمالي المسدد (${defaultCurrency}),الرصيد المستحق (${defaultCurrency}),الحالة\r\n`;
      
      subscribersReportData.forEach((sub) => {
        const groupStr = sub.groups.join(' | ') || 'بدون مجموعة';
        const statusStr = sub.balance > 0 ? 'عليه ديون' : sub.balance < 0 ? 'له رصيد دائن' : 'خالص';
        csvContent += `${sub.subNumber},"${sub.name}","${groupStr}",${sub.openingBalance},${sub.totalBilled},${sub.totalPaid},${sub.balance},"${statusStr}"\r\n`;
      });
    } else if (type === 'subscribers-ledger') {
      fileName = `كشف_حساب_${selectedSubscriber?.name || 'مشترك'}.csv`;
      csvContent = '\uFEFF';
      csvContent += `مسلسل,اليوم,التاريخ,البيان,مدين (${defaultCurrency}),دائن (${defaultCurrency}),الإجمالي المتراكم (${defaultCurrency})\r\n`;
      subscriberLedgerData.forEach((entry, index) => {
        csvContent += `${index + 1},"${entry.dayName}","${entry.formattedDate}","${entry.description}",${entry.debit},${entry.credit},${entry.runningBalance}\r\n`;
      });
      csvContent += `,,,,,الرصيد الإجمالي المتبقي:,${subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0}\r\n`;
    } else if (type === 'invoices-period') {
      fileName = `تقرير_الفواتير_من_${startDate}_إلى_${endDate}.csv`;
      csvContent = '\uFEFF';
      csvContent += `مسلسل,التاريخ,رقم الفاتورة,القراءة السابقة,القراءة الحالية,الاستهلاك (kWh),التكلفة الإجمالية (${defaultCurrency}),نصيب المشترك (${defaultCurrency})\r\n`;
      invoicesByPeriod.forEach((inv, index) => {
        csvContent += `${index + 1},"${new Date(inv.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}","${inv.title || 'فاتورة'}",${inv.prevReading},${inv.currReading},${inv.consumption},${inv.totalCost},${inv.sharePerSubscriber}\r\n`;
      });
      csvContent += `,,,,,إجمالي الاستهلاك الكلي:,${invoicesPeriodStats.totalConsumption},kWh\r\n`;
      csvContent += `,,,,,إجمالي المبيعات الموزعة:,${invoicesPeriodStats.totalBilled},${defaultCurrency}\r\n`;
    } else if (type === 'subscribers-simple') {
      fileName = 'كشف_أرصدة_المشتركين_العام.csv';
      csvContent = '\uFEFF';
      csvContent += `مسلسل,اسم المشترك,الرصيد (${defaultCurrency})\r\n`;
      subscribersSimpleList.forEach((sub, index) => {
        csvContent += `${index + 1},"${sub.name}",${sub.balance}\r\n`;
      });
      csvContent += `,,إجمالي الأرصدة والذمم المستحقة:,${totalSubscribersBalances}\r\n`;
    } else if (type === 'monthly-analysis') {
      fileName = 'تقرير_التحليل_الشهري.csv';
      csvContent = '\uFEFF';
      csvContent += `الشهر,إجمالي الفواتير الموزعة (${defaultCurrency}),إجمالي المبالغ المحصلة (${defaultCurrency}),الاستهلاك الإجمالي (kWh)\r\n`;
      monthlyData.forEach((row) => {
        csvContent += `"${row.month}",${row.billed},${row.collected},${row.consumption}\r\n`;
      });
    } else if (type === 'group-summary') {
      fileName = 'تقرير_مخلص_المجموعات.csv';
      csvContent = '\uFEFF';
      csvContent += `اسم المجموعة,عدد المشتركين,إجمالي الفواتير الموزعة (${defaultCurrency}),إجمالي المدفوعات (${defaultCurrency}),الذمم والديون المستحقة (${defaultCurrency})\r\n`;
      groupMetrics.forEach((row) => {
        csvContent += `"${row.groupName}",${row.subscribersCount},${row.totalBilled},${row.totalPaid},${row.totalDebt}\r\n`;
      });
    } else {
      fileName = 'تقرير_الاستهلاك_العام.csv';
      csvContent = '\uFEFF';
      csvContent += 'البند,القيمة\r\n';
      csvContent += `إجمالي الاستهلاك الكلي (kWh),${stats.totalConsumption}\r\n`;
      csvContent += `إجمالي الفواتير الصادرة الموزعة (${defaultCurrency}),${stats.totalBilled}\r\n`;
      csvContent += `إجمالي المبالغ المسددة (${defaultCurrency}),${stats.totalPaid}\r\n`;
      csvContent += `إجمالي الذمم والديون المستحقة (${defaultCurrency}),${stats.netDebt}\r\n`;
      csvContent += `نسبة التحصيل (%),${stats.collectionRate.toFixed(1)}%\r\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- GENERATE REPORT HTML CONTENT ---
  const generateReportHtmlContent = (type: ReportType, autoPrint: boolean = false): string => {
    const reportTitle = 
      type === 'overview' ? 'تقرير الأداء والاستهلاك العام' :
      type === 'subscribers-balances' ? 'تقرير أرصدة وذمم المشتركين التفصيلي' :
      type === 'subscribers-ledger' ? `كشف حساب تفصيلي: ${selectedSubscriber?.name || ''}` :
      type === 'invoices-period' ? 'تقرير الفواتير التفصيلي حسب الفترة' :
      type === 'subscribers-simple' ? 'تقرير أرصدة المشتركين العام' :
      type === 'monthly-analysis' ? 'تقرير المقارنة والتحليل الشهري' :
      'تقرير الملخص والمبيعات حسب المجموعات';

    let tableRows = '';
    if (type === 'subscribers-balances') {
      tableRows = `
        <table class="report-table">
          <thead>
            <tr>
              <th>رقم المشترك</th>
              <th>اسم المشترك</th>
              <th>المجموعة</th>
              <th>الافتتاحي</th>
              <th>إجمالي الفواتير</th>
              <th>إجمالي المسدد</th>
              <th>المستحق الحالي</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSubscribersReport.map(sub => `
              <tr>
                <td>#${sub.subNumber}</td>
                <td style="font-weight: bold;">${sub.name}</td>
                <td>${sub.groups.join(', ') || '---'}</td>
                <td>${sub.openingBalance.toFixed(1)} ${defaultCurrency}</td>
                <td>${sub.totalBilled.toFixed(1)} ${defaultCurrency}</td>
                <td>${sub.totalPaid.toFixed(1)} ${defaultCurrency}</td>
                <td class="${sub.balance > 0 ? 'debt-text' : sub.balance < 0 ? 'credit-text' : 'clear-text'}">
                  ${sub.balance > 0 ? `${sub.balance.toFixed(1)} ${defaultCurrency} (عليه)` : sub.balance < 0 ? `${Math.abs(sub.balance).toFixed(1)} ${defaultCurrency} (له)` : 'خالص'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'subscribers-ledger') {
      if (!selectedSubscriber) {
        tableRows = `<p style="text-align: center; font-weight: bold; padding: 20px;">الرجاء اختيار مشترك أولاً</p>`;
      } else {
        tableRows = `
          <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #f8fafc; font-size: 13px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; width: 100%;">
              <div style="float: right; width: 50%;"><strong>اسم المشترك:</strong> ${selectedSubscriber.name}</div>
              <div style="float: right; width: 50%;"><strong>رقم المشترك:</strong> #${selectedSubscriber.subNumber}</div>
              <div style="float: right; width: 50%; margin-top: 10px;"><strong>المجموعة:</strong> ${selectedSubscriber.groups?.join(', ') || 'بدون مجموعة'}</div>
              <div style="float: right; width: 50%; margin-top: 10px;"><strong>رقم الجوال:</strong> ${selectedSubscriber.phone || 'غير مسجل'}</div>
              <div style="clear: both;"></div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>مسلسل</th>
                <th>اليوم</th>
                <th>التاريخ</th>
                <th>البيان / التفاصيل</th>
                <th style="text-align: left;">مدين (${defaultCurrency})</th>
                <th style="text-align: left;">دائن (${defaultCurrency})</th>
                <th style="text-align: left;">الإجمالي (${defaultCurrency})</th>
              </tr>
            </thead>
            <tbody>
              ${subscriberLedgerData.map((entry, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${entry.dayName}</td>
                  <td>${entry.formattedDate}</td>
                  <td style="font-size: 11px; color: #475569;">${entry.description}</td>
                  <td style="text-align: left; font-family: monospace;">${entry.debit > 0 ? entry.debit.toFixed(1) : '0'}</td>
                  <td style="text-align: left; font-family: monospace; color: #059669;">${entry.credit > 0 ? entry.credit.toFixed(1) : '0'}</td>
                  <td style="text-align: left; font-family: monospace; font-weight: bold; color: ${entry.runningBalance > 0 ? '#dc2626' : '#059669'}">
                    ${entry.runningBalance.toFixed(1)} ${entry.runningBalance > 0 ? 'عليه' : entry.runningBalance < 0 ? 'له' : 'خالص'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 25px; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #fff; text-align: left; font-size: 14px;">
            <strong style="color: #475569;">الرصيد الإجمالي المتبقي:</strong>
            <span style="font-family: monospace; font-size: 16px; font-weight: 800; color: ${
              (subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) > 0 ? '#b91c1c' : '#047857'
            }; margin-right: 10px;">
              ${Math.abs(subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${defaultCurrency}
              ${(subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) > 0 ? '(مستحق عليه)' : (subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) < 0 ? '(رصيد دائن مقدم)' : '(خالص)'}
            </span>
          </div>
        `;
      }
    } else if (type === 'invoices-period') {
      tableRows = `
        <div style="margin-bottom: 20px; font-size: 13px; color: #475569;">
          الفترة المحددة: من <strong>${startDate || 'البداية'}</strong> إلى <strong>${endDate || 'اليوم'}</strong>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th>مسلسل</th>
              <th>التاريخ</th>
              <th>رقم / وصف الفاتورة</th>
              <th>القراءة السابقة</th>
              <th>القراءة الحالية</th>
              <th style="text-align: left;">الاستهلاك (kWh)</th>
              <th style="text-align: left;">التكلفة الإجمالية (${defaultCurrency})</th>
              <th style="text-align: left;">نصيب المشترك (${defaultCurrency})</th>
            </tr>
          </thead>
          <tbody>
            ${invoicesByPeriod.map((inv, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(inv.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</td>
                <td style="font-weight: bold;">${inv.title || 'فاتورة استهلاك'}</td>
                <td>${inv.prevReading}</td>
                <td>${inv.currReading}</td>
                <td style="text-align: left; font-family: monospace;">${inv.consumption.toLocaleString('en-US')} kWh</td>
                <td style="text-align: left; font-family: monospace;">${inv.totalCost.toFixed(1)} ${defaultCurrency}</td>
                <td style="text-align: left; font-family: monospace; font-weight: bold; color: #1e3a8a;">${inv.sharePerSubscriber.toFixed(1)} ${defaultCurrency}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 25px; width: 100%;">
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #f8fafc; text-align: center; float: right; width: 45%;">
            <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 5px;">إجمالي الاستهلاك للفترة</span>
            <span style="font-size: 18px; font-weight: 800; color: #0f172a;">${invoicesPeriodStats.totalConsumption.toLocaleString('en-US')} kWh</span>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #f8fafc; text-align: center; float: left; width: 45%;">
            <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 5px;">إجمالي الفواتير الصادرة الموزعة لفترة</span>
            <span style="font-size: 18px; font-weight: 800; color: #1e3a8a;">${invoicesPeriodStats.totalBilled.toLocaleString('en-US')} ${defaultCurrency}</span>
          </div>
          <div style="clear: both;"></div>
        </div>
      `;
    } else if (type === 'subscribers-simple') {
      tableRows = `
        <table class="report-table">
          <thead>
            <tr>
              <th>مسلسل</th>
              <th>اسم المشترك</th>
              <th style="text-align: left;">الرصيد المالي (${defaultCurrency})</th>
            </tr>
          </thead>
          <tbody>
            ${subscribersSimpleList.map((sub, index) => `
              <tr>
                <td>${index + 1}</td>
                <td style="font-weight: bold; font-size: 13px;">${sub.name}</td>
                <td style="text-align: left; font-family: monospace; font-weight: bold; color: ${sub.balance > 0 ? '#dc2626' : sub.balance < 0 ? '#059669' : '#475569'}">
                  ${sub.balance > 0 ? `${sub.balance.toFixed(1)} ${defaultCurrency} (عليه)` : sub.balance < 0 ? `${Math.abs(sub.balance).toFixed(1)} ${defaultCurrency} (له دائن)` : 'خالص'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 25px; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; text-align: left; font-size: 15px;">
          <strong style="color: #475569;">إجمالي الأرصدة والذمم المستحقة:</strong>
          <span style="font-family: monospace; font-size: 18px; font-weight: 900; color: ${
            totalSubscribersBalances > 0 ? '#b91c1c' : '#047857'
          }; margin-right: 10px;">
            ${totalSubscribersBalances.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${defaultCurrency}
          </span>
        </div>
      `;
    } else if (type === 'monthly-analysis') {
      tableRows = `
        <table class="report-table">
          <thead>
            <tr>
              <th>الشهر</th>
              <th>الاستهلاك الكلي (kWh)</th>
              <th>قيمة الفواتير الصادرة</th>
              <th>قيمة المبالغ المحصلة</th>
              <th>الفرق والمتبقي للتحصيل</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(row => {
              const diff = row.billed - row.collected;
              return `
                <tr>
                  <td style="font-weight: bold;">${row.month}</td>
                  <td>${row.consumption.toLocaleString('en-US')} kWh</td>
                  <td>${row.billed.toFixed(1)} ${defaultCurrency}</td>
                  <td>${row.collected.toFixed(1)} ${defaultCurrency}</td>
                  <td class="${diff > 0 ? 'debt-text' : 'clear-text'}">${diff.toFixed(1)} ${defaultCurrency}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'group-summary') {
      tableRows = `
        <table class="report-table">
          <thead>
            <tr>
              <th>اسم المجموعة</th>
              <th>عدد المشتركين</th>
              <th>إجمالي الفواتير الموزعة</th>
              <th>إجمالي المدفوعات</th>
              <th>إجمالي الذمم والديون</th>
            </tr>
          </thead>
          <tbody>
            ${groupMetrics.map(g => `
              <tr>
                <td style="font-weight: bold;">${g.groupName}</td>
                <td>${g.subscribersCount} مشترك</td>
                <td>${g.totalBilled.toFixed(1)} ${defaultCurrency}</td>
                <td>${g.totalPaid.toFixed(1)} ${defaultCurrency}</td>
                <td class="${g.totalDebt > 0 ? 'debt-text' : 'clear-text'}">${g.totalDebt.toFixed(1)} ${defaultCurrency}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      // Overview summary layout
      tableRows = `
        <div class="overview-grid">
          <div class="overview-card">
            <span class="card-label">إجمالي الاستهلاك الكلي</span>
            <span class="card-val">${stats.totalConsumption.toLocaleString('en-US')} kWh</span>
          </div>
          <div class="overview-card">
            <span class="card-label">إجمالي قيمة الفواتير الموزعة</span>
            <span class="card-val" style="color: #1e3a8a;">${stats.totalBilled.toLocaleString('en-US')} ${defaultCurrency}</span>
          </div>
          <div class="overview-card">
            <span class="card-label">إجمالي المبالغ المُسددة</span>
            <span class="card-val" style="color: #059669;">${stats.totalPaid.toLocaleString('en-US')} ${defaultCurrency}</span>
          </div>
          <div class="overview-card">
            <span class="card-label">الذمم والديون المستحقة</span>
            <span class="card-val" style="color: #dc2626;">${stats.netDebt.toLocaleString('en-US')} ${defaultCurrency}</span>
          </div>
        </div>

        <h3 style="margin-top: 30px; margin-bottom: 10px; font-size: 15px; color: #475569;">موجز كشف الحساب والتحصيل الإجمالي</h3>
        <table class="report-table">
          <tr>
            <td style="font-weight: bold;">إجمالي القيد الافتتاحي للعدادات الفرعية</td>
            <td>${stats.totalOpeningBal.toLocaleString('en-US')} ${defaultCurrency}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">إجمالي المبالغ المطالب بسدادها (الفواتير)</td>
            <td>${stats.totalBilled.toLocaleString('en-US')} ${defaultCurrency}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">إجمالي المبالغ المقبوضة فعلياً</td>
            <td style="color: #059669; font-weight: bold;">${stats.totalPaid.toLocaleString('en-US')} ${defaultCurrency}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">نسبة التحصيل وسرعة السداد الكلية</td>
            <td style="font-weight: bold;">${stats.collectionRate.toFixed(1)}%</td>
          </tr>
          <tr style="background-color: #fef2f2;">
            <td style="font-weight: bold; color: #991b1b;">صافي الذمم المستحقة للتحصيل</td>
            <td style="color: #b91c1c; font-weight: bold;">${stats.netDebt.toLocaleString('en-US')} ${defaultCurrency}</td>
          </tr>
        </table>
      `;
    }

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          body {
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
            margin: 20px;
            background-color: #fff;
          }
          .header {
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header h1 {
            font-size: 18px;
            margin: 0;
            color: #1e3a8a;
            font-weight: 800;
          }
          .header p {
            margin: 3px 0 0 0;
            font-size: 11px;
            color: #64748b;
          }
          .report-meta {
            font-size: 10px;
            color: #64748b;
            text-align: left;
          }
          .report-subtitle {
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 15px;
            border-right: 4px solid #3b82f6;
            padding-right: 8px;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11px;
          }
          .report-table th, .report-table td {
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            text-align: right;
          }
          .report-table th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 700;
          }
          .report-table tr:nth-child(even) {
            background-color: #fafafa;
          }
          .debt-text {
            color: #dc2626;
            font-weight: bold;
          }
          .credit-text {
            color: #059669;
            font-weight: bold;
          }
          .clear-text {
            color: #475569;
            font-weight: bold;
          }
          .overview-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 15px;
          }
          .overview-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px;
            background-color: #f8fafc;
          }
          .card-label {
            font-size: 9px;
            color: #64748b;
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
          }
          .card-val {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 12px;
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${billSettings?.logo ? `<img src="${billSettings.logo}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : ''}
            <div>
              <h1>${billSettings?.title || 'نظام إدارة وفواتير العداد الرئيسي'}</h1>
              <p>${billSettings?.subtitle || 'سندات الفوترة، السداد، ومتابعة مديونيات المشتركين'}</p>
              ${billSettings?.contactDetails ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${billSettings.contactDetails}</div>` : ''}
            </div>
          </div>
          <div class="report-meta">
            <div>تاريخ الطباعة: ${new Date().toLocaleString('en-US')}</div>
            <div>نوع الكشف: ${reportTitle}</div>
          </div>
        </div>

        <div class="report-subtitle">${reportTitle}</div>

        ${tableRows}

        <div class="footer">
          ${billSettings?.footerText || 'تم إصدار هذا الكشف وتوليده تلقائياً من نظام إدارة العداد الرئيسي للكهرباء.'}
        </div>

        ${autoPrint ? `
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.print();
              }, 500);
            });
          </script>
        ` : ''}
      </body>
      </html>
    `;
  };

  // --- PRINT REPORT FUNCTION ---
  const handlePrintReport = (type: ReportType) => {
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

    const htmlContent = generateReportHtmlContent(type, true);

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 10000);
  };

  // --- PREVIEW REPORT FUNCTION ---
  const handlePreviewReport = (type: ReportType) => {
    const htmlContent = generateReportHtmlContent(type, false);
    setPreviewHtml(htmlContent);
    setShowPreview(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 text-right">
      
      {/* Title Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-blue-500" />
            قسم التقارير والتحليلات البيانية
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">عرض إحصائيات الاستهلاك، مديونيات المشتركين، وتحليلات التحصيل المالي والمجموعات</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handlePreviewReport(activeReport)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/10 active:scale-95"
          >
            <Eye className="w-4 h-4" />
            معاينة قبل الطباعة
          </button>
          <button
            onClick={() => handlePrintReport(activeReport)}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            طباعة الكشف الحالي
          </button>
          <button
            onClick={() => handlePrintReport(activeReport)}
            className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-rose-100/40 shadow-sm"
            title="حفظ الكشف الحالي وتصديره كملف PDF"
          >
            <Download className="w-4 h-4 text-rose-600" />
            تصدير كـ PDF
          </button>
          <button
            onClick={() => handleExportCSV(activeReport)}
            className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-blue-100/40 shadow-sm"
          >
            <Download className="w-4 h-4" />
            تصدير Excel (CSV)
          </button>
        </div>
      </div>

      {/* Reports Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { id: 'overview', title: 'الأداء العام والاستهلاك', desc: 'إجمالي استهلاك الكيلوواط، التكلفة، والتحصيل', icon: TrendingUp },
          { id: 'subscribers-balances', title: 'أرصدة وذمم المشتركين', desc: 'تفاصيل الديون والتحصيل لكل مشترك', icon: Users },
          { id: 'subscribers-ledger', title: 'كشف حساب مشترك تفصيلي', desc: 'التقرير التفصيلي للحركات حسب اسم المشترك', icon: Coins },
          { id: 'invoices-period', title: 'تقرير الفواتير بفترة', desc: 'استعراض الفواتير من تاريخ إلى تاريخ', icon: Calendar },
          { id: 'subscribers-simple', title: 'كشف أرصدة المشتركين البسيط', desc: 'قائمة المشتركين والأرصدة المستحقة', icon: BookmarkCheck },
          { id: 'monthly-analysis', title: 'التحليل الشهري', desc: 'تطور الفواتير والمقبوضات شهرياً', icon: Calendar },
          { id: 'group-summary', title: 'توزيع المجموعات', desc: 'تحليل المبيعات حسب فئات وتصنيف المشتركين', icon: PieChart },
          { id: 'expenses', title: 'إدارة وتوزيع المصاريف', desc: 'إدخال المصاريف وتقسيمها كديون مستحقة آلياً', icon: Coins },
        ].map((report) => {
          const Icon = report.icon;
          const isActive = activeReport === report.id;
          return (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id as ReportType)}
              className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none relative flex flex-col gap-2 ${
                isActive
                  ? 'border-blue-500 bg-blue-50/20 text-slate-800 shadow-sm'
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isActive && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
              </div>
              <div>
                <span className={`text-xs sm:text-sm font-black block ${isActive ? 'text-blue-600' : 'text-slate-700'}`}>{report.title}</span>
                <span className="text-[10px] text-slate-400 font-semibold block leading-normal mt-0.5">{report.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Report Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeReport}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {/* 1. OVERVIEW PANEL */}
          {activeReport === 'overview' && (
            <div className="space-y-6">
              
              {/* Detailed metrics row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 block">إجمالي استهلاك الكهرباء للعدادات</span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-800">
                      {stats.totalConsumption.toLocaleString('en-US')} <span className="text-xs font-semibold text-slate-400">kWh</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">استهلاك كلي</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 block">إجمالي الفواتير الصادرة الموزعة</span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xl sm:text-2xl font-black text-blue-600">
                      {stats.totalBilled.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-blue-400">{defaultCurrency}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400">طلب السداد</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 block">إجمالي المبالغ المُسددة</span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xl sm:text-2xl font-black text-emerald-600">
                      {stats.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-emerald-400">{defaultCurrency}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">مقبوضات نقداً</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 block">الذمم والديون المتبقية للتحصيل</span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-xl sm:text-2xl font-black ${stats.netDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {stats.netDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-rose-400">{defaultCurrency}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">صافي معلق</span>
                  </div>
                </div>

              </div>

              {/* Progress and analysis block */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Collection Efficiency meter */}
                <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                  <div>
                    <h4 className="text-sm font-black text-slate-700">كفاءة وسرعة التحصيل المالي</h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">معدل تحصيل الأموال الصادرة بالنسبة للفواتير والافتتاحي الكلي</p>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-3 py-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      {/* SVG circular progress */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          stroke="#f1f5f9"
                          strokeWidth="10"
                          fill="transparent"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          stroke={stats.collectionRate > 80 ? '#10b981' : stats.collectionRate > 50 ? '#3b82f6' : '#f43f5e'}
                          strokeWidth="10"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 54}
                          strokeDashoffset={2 * Math.PI * 54 * (1 - stats.collectionRate / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-800">{stats.collectionRate.toFixed(1)}%</span>
                        <span className="text-[10px] text-slate-400 font-bold">نسبة التحصيل</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-2.5">
                    <Percent className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] text-slate-500 font-bold leading-relaxed">
                      تم تحصيل ما قيمته <strong className="text-slate-700">{stats.totalPaid.toLocaleString('en-US')} {defaultCurrency}</strong> من إجمالي مطالب السداد المتراكمة.
                    </span>
                  </div>
                </div>

                {/* Quick breakdown charts of monthly electricity bills */}
                <div className="lg:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-700">مخطط تطور الفوترة الشهرية والاستهلاك الكلي</h4>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">مقارنة مجموع الفواتير الشهرية الموزعة ({defaultCurrency}) واستهلاك الكيلوواط</p>
                    </div>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">رسم بياني تفاعلي</span>
                  </div>

                  {monthlyData.length === 0 ? (
                    <div className="py-12 text-center text-slate-300 font-bold text-xs">لا تتوفر فواتير مسجلة لإظهار المخطط</div>
                  ) : (
                    <div className="space-y-4 pt-3">
                      {monthlyData.slice(0, 4).map((row) => {
                        const maxBilled = Math.max(...monthlyData.map(m => m.billed)) || 1;
                        const pctBilled = (row.billed / maxBilled) * 100;
                        const maxCons = Math.max(...monthlyData.map(m => m.consumption)) || 1;
                        const pctCons = (row.consumption / maxCons) * 100;

                        return (
                          <div key={row.month} className="space-y-1.5 border-b border-slate-50 pb-3 last:border-none last:pb-0">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                              <span className="font-extrabold">{row.month}</span>
                              <div className="flex gap-4">
                                <span className="text-blue-600">الفواتير: {row.billed.toLocaleString('en-US')} ر.س</span>
                                <span className="text-amber-600">الاستهلاك: {row.consumption.toLocaleString('en-US')} kWh</span>
                              </div>
                            </div>
                            
                            {/* Billed bar */}
                            <div className="relative w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                              <div
                                className="absolute right-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${pctBilled}%` }}
                              />
                            </div>

                            {/* Consumption bar */}
                            <div className="relative w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                              <div
                                className="absolute right-0 top-0 h-full bg-amber-500 rounded-full transition-all duration-500"
                                style={{ width: `${pctCons}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Recharts Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Monthly Electricity Consumption Evolution Chart */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 text-right">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        تطور استهلاك الكهرباء شهرياً
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">معدل وكمية استهلاك الطاقة الكهربائية الكلية بالكيلوواط ساعة</p>
                    </div>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">خط بياني</span>
                  </div>

                  {chronologicalChartData.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold text-xs flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 animate-pulse" />
                      لا تتوفر بيانات استهلاك كافية لتوليد الخط البياني
                    </div>
                  ) : (
                    <div className="w-full h-[300px]" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chronologicalChartData} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="month" 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: '700' }} 
                          />
                          <YAxis 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: '700' }}
                            tickFormatter={(val) => `${val.toLocaleString('en-US')}`}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-xl text-right text-xs space-y-1 font-sans" dir="rtl">
                                    <p className="font-extrabold text-slate-300">{label}</p>
                                    <p className="text-blue-400 font-black">
                                      الاستهلاك: {payload[0].value?.toLocaleString('en-US')} kWh
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }} 
                          />
                          <Line
                            type="monotone"
                            dataKey="consumption"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 2. Collection Comparison Chart */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 text-right">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        مقارنة تحصيل الإيرادات المالية
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">مقارنة مجموع الفواتير الصادرة مقابل المقبوضات النقدية المحصلة</p>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">أعمدة بيانية</span>
                  </div>

                  {chronologicalChartData.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold text-xs flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 animate-pulse" />
                      لا تتوفر بيانات مالية كافية لتوليد الأعمدة البيانية
                    </div>
                  ) : (
                    <div className="w-full h-[300px]" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={chronologicalChartData} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="month" 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: '700' }} 
                          />
                          <YAxis 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: '700' }}
                            tickFormatter={(val) => `${val.toLocaleString('en-US')}`}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-xl text-right text-xs space-y-1.5 font-sans" dir="rtl">
                                    <p className="font-extrabold text-slate-300">{label}</p>
                                    <div className="space-y-0.5">
                                      <p className="text-blue-400 font-bold">
                                        الفواتير الصادرة: {payload[0]?.value?.toLocaleString('en-US')} {defaultCurrency}
                                      </p>
                                      <p className="text-emerald-400 font-bold">
                                        المبالغ المحصلة: {payload[1]?.value?.toLocaleString('en-US')} {defaultCurrency}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }} 
                          />
                          <Legend 
                            content={({ payload }) => {
                              return (
                                <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-bold text-slate-500" dir="rtl">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span>الفواتير الصادرة</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                    <span>المبالغ المحصلة</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="billed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* 2. DETAILED SUBSCRIBERS BALANCES LEDGER */}
          {activeReport === 'subscribers-balances' && (
            <div className="space-y-5">
              
              {/* Filter tools bar */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                
                {/* Search */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="ابحث باسم المشترك أو الرقم لتصفية الكشف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter by Group */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400">المجموعة:</span>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="all">الكل</option>
                      {groupsList.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* Filter by Debt status */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400">الحالة المالية:</span>
                    <select
                      value={debtFilter}
                      onChange={(e) => setDebtFilter(e.target.value as any)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="all">كل الأرصدة</option>
                      <option value="has-debt">عليه مديونية (مدين)</option>
                      <option value="has-credit">له رصيد دائن (دائن)</option>
                      <option value="clear">خالص ذمة مالية</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Main balances ledger table */}
              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                {filteredSubscribersReport.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-black text-slate-600">لا يوجد مشترك مطابق لمعايير البحث الحالية</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold text-xs">
                          <th className="py-3 px-5 font-black text-right">رقم العميل</th>
                          <th className="py-3 px-5 font-black text-right">اسم المشترك</th>
                          <th className="py-3 px-5 font-black text-right">المجموعة</th>
                          <th className="py-3 px-5 font-black text-left">قيد افتتاحي</th>
                          <th className="py-3 px-5 font-black text-left">إجمالي الفواتير</th>
                          <th className="py-3 px-5 font-black text-left">إجمالي المسدد</th>
                          <th className="py-3 px-5 font-black text-left">الرصيد المستحق الحالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSubscribersReport.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors font-semibold text-slate-700">
                            <td className="py-3.5 px-5 text-slate-400 font-mono font-bold text-[11px]">#{sub.subNumber}</td>
                            <td className="py-3.5 px-5 text-slate-800 font-black">{sub.name}</td>
                            <td className="py-3.5 px-5">
                              {sub.groups.map(g => (
                                <span key={g} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 text-[10px] ml-1">
                                  {g}
                                </span>
                              )) || <span className="text-slate-300">---</span>}
                            </td>
                            <td className="py-3.5 px-5 text-left font-mono text-slate-500">{(sub.openingBalance || 0).toLocaleString('en-US')} {defaultCurrency}</td>
                            <td className="py-3.5 px-5 text-left font-mono text-slate-500">{(sub.totalBilled || 0).toLocaleString('en-US')} {defaultCurrency}</td>
                            <td className="py-3.5 px-5 text-left font-mono text-emerald-600">{(sub.totalPaid || 0).toLocaleString('en-US')} {defaultCurrency}</td>
                            <td className="py-3.5 px-5 text-left font-mono">
                              {sub.balance > 0 ? (
                                <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100/30 text-[11px] inline-block">
                                  عليه {sub.balance.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                                </span>
                              ) : sub.balance < 0 ? (
                                <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/30 text-[11px] inline-block">
                                  له {Math.abs(sub.balance).toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency} (دائن)
                                </span>
                              ) : (
                                <span className="font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded text-[11px] inline-block">خالص ذمة</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 3. MONTHLY COMPARATIVE ANALYSIS */}
          {activeReport === 'monthly-analysis' && (
            <div className="space-y-5">
              
              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                {monthlyData.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 font-bold">لا تتوفر فواتير شهرية لعرض كشف المقارنة</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold text-xs">
                          <th className="py-3 px-5 font-black text-right">الشهر الميلادي / الدورة</th>
                          <th className="py-3 px-5 font-black text-left">الاستهلاك الكلي (kWh)</th>
                          <th className="py-3 px-5 font-black text-left">مجموع الموزع والمطالب سداده (الفواتير)</th>
                          <th className="py-3 px-5 font-black text-left">مجموع المبالغ المحصلة (المقبوضات)</th>
                          <th className="py-3 px-5 font-black text-left">الذمة والديون المتبقية لنفس الشهر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monthlyData.map((row) => {
                          const unpaid = row.billed - row.collected;
                          return (
                            <tr key={row.month} className="hover:bg-slate-50/50 transition-colors font-semibold text-slate-700">
                              <td className="py-3.5 px-5 font-black text-slate-800">{row.month}</td>
                              <td className="py-3.5 px-5 text-left font-mono text-slate-500">{row.consumption.toLocaleString('en-US')} kWh</td>
                              <td className="py-3.5 px-5 text-left font-mono text-slate-600">{row.billed.toLocaleString('en-US')} {defaultCurrency}</td>
                              <td className="py-3.5 px-5 text-left font-mono text-emerald-600">{row.collected.toLocaleString('en-US')} {defaultCurrency}</td>
                              <td className="py-3.5 px-5 text-left font-mono">
                                {unpaid > 0 ? (
                                  <span className="text-rose-600 font-extrabold bg-rose-50 px-2.5 py-0.5 rounded-lg text-xs">
                                    {unpaid.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency} معلق
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded-lg text-xs">
                                    تم التحصيل بالكامل
                                  </span>
                                )}
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
          )}

          {/* 4. GROUP BALANCES ANALYSIS */}
          {activeReport === 'group-summary' && (
            <div className="space-y-6">
              
              {/* Group bento metrics row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {groupMetrics.map((g) => {
                  const maxBilled = Math.max(...groupMetrics.map(gr => gr.totalBilled)) || 1;
                  const percentBilled = (g.totalBilled / maxBilled) * 100;

                  return (
                    <div key={g.groupName} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                          <BookmarkCheck className="w-4 h-4 text-purple-500" />
                          مجموعة {g.groupName}
                        </span>
                        <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {g.subscribersCount} مشتركين
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">إجمالي المطالبات الصادرة:</span>
                          <span className="font-extrabold text-slate-700">{g.totalBilled.toLocaleString('en-US')} {defaultCurrency}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">إجمالي السداد المحصل:</span>
                          <span className="font-extrabold text-emerald-600">{g.totalPaid.toLocaleString('en-US')} {defaultCurrency}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-slate-50 pt-2">
                          <span className="text-slate-400 font-bold">صافي المديونية المعلقة:</span>
                          <span className={`font-extrabold ${g.totalDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {g.totalDebt.toLocaleString('en-US')} {defaultCurrency}
                          </span>
                        </div>
                      </div>

                      {/* Distribution bar progress */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[9px] font-bold text-slate-400 block">مساهمة المجموعة من مبيعات العداد</span>
                        <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="absolute right-0 top-0 h-full bg-purple-500 rounded-full"
                            style={{ width: `${percentBilled}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Recharts Monthly Group Consumption Distribution */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-5">
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                      <BarChart className="w-5 h-5 text-purple-600" />
                      تحليل وتوزيع الاستهلاك الشهري للمجموعات
                    </h3>
                    <p className="text-xs text-slate-400">
                      مخطط بياني تفاعلي يوضح كمية استهلاك الكهرباء (kWh) شهرياً مقسمة حسب مجموعات المشتركين للمقارنة والتحليل.
                    </p>
                  </div>

                  {/* Chart Type Toggle Controls */}
                  <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-2xl self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setChartType('stacked')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        chartType === 'stacked'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      عمود متراكم
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('grouped')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        chartType === 'grouped'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      عواميد منفصلة
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('line')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        chartType === 'line'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      منحنى خطي
                    </button>
                  </div>
                </div>

                {groupMonthlyConsumptionData.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold border border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 animate-bounce" />
                    لا تتوفر فواتير أو بيانات استهلاك حالياً لإنشاء المخطط البياني للمجموعات.
                  </div>
                ) : (
                  <div className="w-full h-[380px] sm:h-[420px] pt-2" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'line' ? (
                        <LineChart data={groupMonthlyConsumptionData} margin={{ top: 15, right: 15, left: 15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="monthName" 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'sans-serif' }} 
                          />
                          <YAxis 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'sans-serif' }}
                            tickFormatter={(val) => `${val.toLocaleString('en-US')}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend content={<CustomLegend />} />
                          {allGroupNames.map((gName, index) => (
                            <Line
                              key={gName}
                              type="monotone"
                              dataKey={gName}
                              stroke={GROUP_COLORS[index % GROUP_COLORS.length]}
                              strokeWidth={3}
                              dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          ))}
                        </LineChart>
                      ) : (
                        <RechartsBarChart data={groupMonthlyConsumptionData} margin={{ top: 15, right: 15, left: 15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="monthName" 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'sans-serif' }} 
                          />
                          <YAxis 
                            tickLine={false} 
                            axisLine={false} 
                            stroke="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'sans-serif' }}
                            tickFormatter={(val) => `${val.toLocaleString('en-US')}`}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.04)', radius: 8 }} />
                          <Legend content={<CustomLegend />} />
                          {allGroupNames.map((gName, index) => (
                            <Bar
                              key={gName}
                              dataKey={gName}
                              stackId={chartType === 'stacked' ? 'a' : undefined}
                              fill={GROUP_COLORS[index % GROUP_COLORS.length]}
                              radius={chartType === 'stacked' && index === allGroupNames.length - 1 ? [4, 4, 0, 0] : chartType === 'grouped' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                          ))}
                        </RechartsBarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 3. DETAILED SUBSCRIBER LEDGER (كشف حساب مشترك تفصيلي) */}
          {activeReport === 'subscribers-ledger' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-blue-500" />
                  كشف حساب تفصيلي وحركة الذمم للمشترك
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 block">اختر اسم المشترك:</label>
                    <select
                      value={selectedSubId}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">-- اختر مشتركاً --</option>
                      {subscribers.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} (عداد #{sub.subNumber || ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedSubscriber ? (
                <div className="space-y-6">
                  {/* Subscriber Info Card */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-md">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-blue-100 block">اسم المشترك</span>
                        <span className="text-base sm:text-lg font-black">{selectedSubscriber.name}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-blue-100 block">رقم المشترك</span>
                        <span className="text-base sm:text-lg font-mono font-bold">#{selectedSubscriber.subNumber || ''}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-blue-100 block">رقم الجوال</span>
                        <span className="text-base sm:text-lg font-mono font-bold">{selectedSubscriber.phone || '---'}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-blue-100 block">المجموعة</span>
                        <span className="text-base sm:text-lg font-black">{selectedSubscriber.groups?.join(', ') || 'بدون مجموعة'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-black text-slate-700">كشف الحساب التفصيلي (من الأقدم إلى الأحدث)</span>
                      <span className="text-[10px] font-bold text-slate-400">إجمالي الحركات: {subscriberLedgerData.length}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                            <th className="py-3.5 px-5 font-black text-slate-500">مسلسل</th>
                            <th className="py-3.5 px-5 font-black text-slate-500">اليوم</th>
                            <th className="py-3.5 px-5 font-black text-slate-500">التاريخ</th>
                            <th className="py-3.5 px-5 font-black text-slate-500">البيان / تفاصيل العملية</th>
                            <th className="py-3.5 px-5 font-black text-left">مدين (ر.س)</th>
                            <th className="py-3.5 px-5 font-black text-left">دائن (ر.س)</th>
                            <th className="py-3.5 px-5 font-black text-left">الإجمالي (ر.س)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium font-sans">
                          {subscriberLedgerData.map((entry, index) => (
                            <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-5 text-slate-400 font-bold">{index + 1}</td>
                              <td className="py-3.5 px-5 text-slate-700 font-bold">{entry.dayName}</td>
                              <td className="py-3.5 px-5 text-slate-500 font-mono">{entry.formattedDate}</td>
                              <td className="py-3.5 px-5 text-slate-600 font-medium">{entry.description}</td>
                              <td className="py-3.5 px-5 text-left font-mono text-slate-800">
                                {entry.debit > 0 ? (
                                  <span className="text-rose-600 font-bold">
                                    {entry.debit.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                                  </span>
                                ) : '---'}
                              </td>
                              <td className="py-3.5 px-5 text-left font-mono text-emerald-600">
                                {entry.credit > 0 ? (
                                  <span className="text-emerald-600 font-bold">
                                    {entry.credit.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                                  </span>
                                ) : '---'}
                              </td>
                              <td className="py-3.5 px-5 text-left font-mono">
                                <span className={`font-black ${entry.runningBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {entry.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                                </span>
                              </td>
                            </tr>
                          ))}
                          
                          {subscriberLedgerData.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-300 font-bold">لا توجد حركات مسجلة لهذا المشترك</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom Invoice Total Balance block */}
                    <div className="bg-slate-50/50 p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">إجمالي رصيد الحساب المتبقي</span>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">القيمة النهائية المطلوبة للتحصيل أو المتبقية كدائن للمشترك</p>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm text-left">
                        <span className="text-xs font-black text-slate-500 block">الرصيد الإجمالي</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xl sm:text-2xl font-black ${
                            (subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {Math.abs(subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-400">{defaultCurrency}</span>
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            (subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {(subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) > 0 ? 'مستحق عليه' : (subscriberLedgerData[subscriberLedgerData.length - 1]?.runningBalance || 0) < 0 ? 'رصيد دائن مقدم له' : 'خالص'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 bg-white rounded-3xl border border-slate-100 text-center text-slate-400 font-bold">
                  الرجاء اختيار مشترك لعرض كشف الحساب والتقرير التفصيلي
                </div>
              )}
            </div>
          )}

          {/* 4. INVOICES BY PERIOD (تقرير الفواتير من تاريخ إلى تاريخ) */}
          {activeReport === 'invoices-period' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  تقرير الفواتير الموزعة خلال فترة محددة
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 block">من تاريخ:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 block">إلى تاريخ:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-black text-slate-700">سجل فواتير الاستهلاك للفترة المحددة</span>
                  <span className="text-[10px] font-bold text-slate-400">عدد الفواتير: {invoicesByPeriod.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="py-3.5 px-5 font-black text-slate-500">مسلسل</th>
                        <th className="py-3.5 px-5 font-black text-slate-500">التاريخ</th>
                        <th className="py-3.5 px-5 font-black text-slate-500">وصف / عنوان الفاتورة</th>
                        <th className="py-3.5 px-5 font-black text-slate-500">القراءة السابقة</th>
                        <th className="py-3.5 px-5 font-black text-slate-500">القراءة الحالية</th>
                        <th className="py-3.5 px-5 font-black text-left">الاستهلاك (kWh)</th>
                        <th className="py-3.5 px-5 font-black text-left">التكلفة الإجمالية (ر.س)</th>
                        <th className="py-3.5 px-5 font-black text-left">نصيب المشترك (ر.س)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {invoicesByPeriod.map((inv, index) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 text-slate-400 font-bold">{index + 1}</td>
                          <td className="py-3.5 px-5 text-slate-500 font-mono">
                            {new Date(inv.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-5 text-slate-700 font-bold">{inv.title || 'فاتورة استهلاك كهرباء'}</td>
                          <td className="py-3.5 px-5 text-slate-500 font-mono">{inv.prevReading}</td>
                          <td className="py-3.5 px-5 text-slate-500 font-mono">{inv.currReading}</td>
                          <td className="py-3.5 px-5 text-left font-mono text-slate-800">
                            {inv.consumption.toLocaleString('en-US')} kWh
                          </td>
                          <td className="py-3.5 px-5 text-left font-mono text-slate-600">
                            {inv.totalCost.toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                          </td>
                          <td className="py-3.5 px-5 text-left font-mono text-blue-600 font-extrabold">
                            {inv.sharePerSubscriber.toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                          </td>
                        </tr>
                      ))}
                      
                      {invoicesByPeriod.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-300 font-bold">لا تتوفر فواتير مسجلة في هذا النطاق الزمني المحدد</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Sum blocks */}
                <div className="bg-slate-50/50 p-6 border-t-2 border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 shadow-sm text-center">
                      <span className="text-xs font-black text-slate-500 block mb-1">إجمالي الاستهلاك للفترة المحددة</span>
                      <span className="text-lg sm:text-2xl font-black text-slate-800 font-mono">
                        {invoicesPeriodStats.totalConsumption.toLocaleString('en-US')} <span className="text-xs font-black text-slate-400">kWh</span>
                      </span>
                    </div>
                    
                    <div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 shadow-sm text-center">
                      <span className="text-xs font-black text-slate-500 block mb-1">إجمالي الفواتير الموزعة للفترة المحددة</span>
                      <span className="text-lg sm:text-2xl font-black text-blue-700 font-mono">
                        {invoicesPeriodStats.totalBilled.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-black text-blue-500">{defaultCurrency}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. SIMPLE SUBSCRIBERS LIST (تقرير المشتركين البسيط والأرصدة) */}
          {activeReport === 'subscribers-simple' && (
            <div className="space-y-6">
              {/* Header Title bar */}
              <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  تقرير كشف أرصدة المشتركين العام والذمم المالية
                </h3>
                <p className="text-sm text-slate-500 font-bold">عرض إجمالي أرصدة جميع المشتركين ومستحقات السداد والمديونيات بشكل مخلص ومبسط</p>
              </div>

              {/* Simple subscribers table */}
              <div className="bg-white border-2 border-slate-100 rounded-3xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-100 text-slate-500 font-bold">
                        <th className="py-3.5 px-5 font-black text-slate-600 text-sm">مسلسل</th>
                        <th className="py-3.5 px-5 font-black text-slate-600 text-sm">اسم المشترك</th>
                        <th className="py-3.5 px-5 font-black text-left text-sm">الرصيد المالي الحالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {subscribersSimpleList.map((sub, index) => (
                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 text-slate-400 font-bold text-sm">{index + 1}</td>
                          <td className="py-3.5 px-5 text-slate-800 font-black text-base">{sub.name}</td>
                          <td className="py-3.5 px-5 text-left font-mono">
                            {sub.balance > 0 ? (
                              <span className="text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-black text-xs sm:text-sm inline-block font-sans shadow-sm">
                                عليه: {sub.balance.toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                              </span>
                            ) : sub.balance < 0 ? (
                              <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-black text-xs sm:text-sm inline-block font-sans shadow-sm">
                                له دائن: {Math.abs(sub.balance).toLocaleString('en-US', { minimumFractionDigits: 1 })} {defaultCurrency}
                              </span>
                            ) : (
                              <span className="text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-black text-xs sm:text-sm inline-block font-sans shadow-sm">
                                خالص / مسدد
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom simple footer totals */}
                <div className="bg-slate-50/50 p-6 border-t-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-black text-slate-700 block">إجمالي أرصدة جميع المشتركين الكلية</span>
                    <p className="text-xs text-slate-500 font-bold mt-1">صافي المديونية المعلقة في النظام المستحقة للتحصيل للعداد الفرعي</p>
                  </div>

                  <div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 shadow-sm text-left">
                    <span className="text-xs font-black text-slate-500 block mb-1">إجمالي الأرصدة (اجمالي الذمم والديون)</span>
                    <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight block ${totalSubscribersBalances > 0 ? 'text-rose-700 animate-pulse' : 'text-emerald-700'}`}>
                      {totalSubscribersBalances.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-black text-slate-400">{defaultCurrency}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'expenses' && (
            <ExpenseManagement
              subscribers={subscribers}
              invoices={invoices}
              groupsList={groupsList}
              defaultCurrency={defaultCurrency}
              onAddExpense={onAddExpense}
              onDeleteInvoice={onDeleteInvoice}
              currentUserRole={currentUserRole}
            />
          )}

        </motion.div>
      </AnimatePresence>

      {/* --- REPORT PREVIEW MODAL --- */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-800">معاينة التقرير قبل الطباعة</h3>
                    <p className="text-xs text-slate-400 font-bold">يمكنك مراجعة تنسيق وأرقام التقرير بدقة قبل توجيه أمر الطباعة</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintReport(activeReport)}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/10 active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة التقرير الآن
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                  >
                    إغلاق المعاينة
                  </button>
                </div>
              </div>

              {/* Modal Body with IFrame Live Preview */}
              <div className="p-4 sm:p-6 bg-slate-100 flex-1 overflow-auto flex items-center justify-center">
                <div className="w-full h-[65vh] bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden relative">
                  <iframe
                    title="معاينة التقرير"
                    srcDoc={previewHtml}
                    className="w-full h-full border-none"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between text-xs text-slate-400 font-bold">
                <span>تاريخ التوليد: {new Date().toLocaleString('ar-EG', { numberingSystem: 'latn' })}</span>
                <span>نظام فواتير العداد الرئيسي المتقدم</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
