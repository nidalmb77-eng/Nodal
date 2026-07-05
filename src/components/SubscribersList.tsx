/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Subscriber, Invoice, Payment, BillCustomization, User, UserRole } from '../types';
import { calculateSubscriberStats, getSubscriberLedger } from '../utils/storage';
import { printSubscriberStatement, printSingleInvoice } from '../utils/print';
import {
  UserPlus,
  Coins,
  History,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  TrendingDown,
  CheckCircle,
  Calendar,
  DollarSign,
  Phone,
  Printer,
  MessageSquare,
  Hash,
  Tags,
  Edit,
  Edit2,
  X,
  Check,
  Settings,
  Users,
  FileText,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Shield,
  Key,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SubscribersListProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  usersList?: User[];
  onAddSubscriber: (
    name: string,
    phone?: string,
    whatsapp?: string,
    openingBalance?: number,
    groups?: string[],
    createUserAccount?: boolean,
    userUsername?: string,
    userPassword?: string,
    userRole?: UserRole
  ) => void;
  onDeleteSubscriber: (id: string) => void;
  onRecordPayment: (subscriberId: string, amount: number, notes?: string) => void;
  onUpdateSubscriber: (updatedSub: Subscriber) => void;
  groupsList: string[];
  onAddGroup: (groupName: string, subscriberIds?: string[]) => void;
  onEditGroup: (oldName: string, newName: string) => void;
  onDeleteGroup: (groupName: string) => void;
  defaultCurrency?: string;
  currentUserRole?: string;
  whatsappReminderEnabled?: boolean;
  whatsappReminderThreshold?: number;
  whatsappReminderTemplate?: string;
  billSettings?: BillCustomization;
  onDeleteInvoice?: (id: string) => void;
  onDeletePayment?: (id: string) => void;
}

export default function SubscribersList({
  subscribers,
  invoices,
  payments,
  usersList = [],
  onAddSubscriber,
  onDeleteSubscriber,
  onRecordPayment,
  onUpdateSubscriber,
  groupsList,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  defaultCurrency = 'ش.ج',
  currentUserRole = 'operator',
  whatsappReminderEnabled = false,
  whatsappReminderThreshold = 500,
  whatsappReminderTemplate = '',
  billSettings,
  onDeleteInvoice,
  onDeletePayment,
}: SubscribersListProps) {
  // Active Tab: Subscribers ledger vs Groups management vs Bulk Reminders
  const [activeTab, setActiveTab] = useState<'subs' | 'groups' | 'bulk_reminders'>('subs');

  // Active Ledger / Selected Subscriber Details ID
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  // Sub-tabs inside each subscriber expanded view
  const [subTabs, setSubTabs] = useState<{ [subId: string]: 'ledger' | 'transactions' }>({});

  // Bulk Reminders State
  const [bulkDebtThreshold, setBulkDebtThreshold] = useState<number>(whatsappReminderThreshold);
  const [bulkMessageTemplate, setBulkMessageTemplate] = useState<string>(
    whatsappReminderTemplate || 'السلام عليكم {name}، نود تذكيركم بأن رصيدكم المستحق لقيمة استهلاك الكهرباء هو {debt} {currency}. يرجى التكرم بالسداد في أقرب وقت ممكن. شاكرين تعاونكم.'
  );
  const [selectedPreviewSubId, setSelectedPreviewSubId] = useState<string | null>(null);
  const [sentSubscribersList, setSentSubscribersList] = useState<string[]>([]); // Array of subscriber IDs sent in this session
  const [bulkSelectedSubIds, setBulkSelectedSubIds] = useState<string[]>([]); // Array of subscriber IDs currently checked for sending

  // New Subscriber Form State
  const [newSubName, setNewSubName] = useState('');
  const [newSubPhone, setNewSubPhone] = useState('');
  const [newSubWhatsapp, setNewSubWhatsapp] = useState('');
  const [newSubOpeningBalance, setNewSubOpeningBalance] = useState('');
  const [newSubOpeningType, setNewSubOpeningType] = useState<'debt' | 'credit'>('debt');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [customGroup, setCustomGroup] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // States for Linked User Account
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('viewer');
  const [addFormError, setAddFormError] = useState('');

  const defaultGroupsList = [
    'المجموعة الأولى',
    'المجموعة الثانية',
    'الدور الأرضي',
    'الدور الأول',
    'المحلات التجارية',
  ];

  // Mobile details expansion state per subscriber
  const [mobileExpandedSubs, setMobileExpandedSubs] = useState<{ [subId: string]: boolean }>({});

  const toggleMobileExpand = (subId: string) => {
    setMobileExpandedSubs((prev) => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };

  const getTrendStats = (subId: string) => {
    let latestDate = new Date();
    let foundAny = false;

    (invoices || []).forEach((inv) => {
      if (inv && inv.date) {
        const d = new Date(inv.date);
        if (!foundAny || d > latestDate) {
          latestDate = d;
          foundAny = true;
        }
      }
    });

    (payments || []).forEach((pay) => {
      if (pay && pay.date) {
        const d = new Date(pay.date);
        if (!foundAny || d > latestDate) {
          latestDate = d;
          foundAny = true;
        }
      }
    });

    const curYear = latestDate.getFullYear();
    const curMonth = latestDate.getMonth();

    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const curMonthInvoices = (invoices || []).filter((inv) => {
      if (!inv || !inv.date || !inv.subscriberIds) return false;
      const d = new Date(inv.date);
      return d.getFullYear() === curYear && d.getMonth() === curMonth && inv.subscriberIds.includes(subId);
    });
    const prevMonthInvoices = (invoices || []).filter((inv) => {
      if (!inv || !inv.date || !inv.subscriberIds) return false;
      const d = new Date(inv.date);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth && inv.subscriberIds.includes(subId);
    });

    const curMonthPayments = (payments || []).filter((pay) => {
      if (!pay || !pay.date || !pay.subscriberId) return false;
      const d = new Date(pay.date);
      return d.getFullYear() === curYear && d.getMonth() === curMonth && pay.subscriberId === subId;
    });
    const prevMonthPayments = (payments || []).filter((pay) => {
      if (!pay || !pay.date || !pay.subscriberId) return false;
      const d = new Date(pay.date);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth && pay.subscriberId === subId;
    });

    const curDebt = curMonthInvoices.reduce((sum, inv) => sum + (inv.sharePerSubscriber || 0), 0);
    const prevDebt = prevMonthInvoices.reduce((sum, inv) => sum + (inv.sharePerSubscriber || 0), 0);

    const curPaid = curMonthPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    const prevPaid = prevMonthPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);

    const rawDebtDiff = curDebt - prevDebt;
    const rawPaidDiff = curPaid - prevPaid;

    const debtDiff = Math.round(rawDebtDiff * 100) / 100;
    const paidDiff = Math.round(rawPaidDiff * 100) / 100;

    return {
      curDebt,
      prevDebt,
      debtDiff,
      curPaid,
      prevPaid,
      paidDiff,
      curMonthName: latestDate.toLocaleDateString('ar-EG', { month: 'long' }),
      prevMonthName: prevDate.toLocaleDateString('ar-EG', { month: 'long' }),
    };
  };

  // Groups Manager Modal State
  const [isGroupsManagerOpen, setIsGroupsManagerOpen] = useState(false);
  const [editingGroupOldName, setEditingGroupOldName] = useState<string | null>(null);
  const [editingGroupNewName, setEditingGroupNewName] = useState('');
  const [newGroupInputName, setNewGroupInputName] = useState('');
  const [newGroupSelectedSubIds, setNewGroupSelectedSubIds] = useState<string[]>([]);
  const [groupSubSearchTerm, setGroupSubSearchTerm] = useState('');

  // Subscriber Edit Modal State
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubPhone, setEditSubPhone] = useState('');
  const [editSubWhatsapp, setEditSubWhatsapp] = useState('');
  const [editSubOpeningBalance, setEditSubOpeningBalance] = useState('');
  const [editSubOpeningType, setEditSubOpeningType] = useState<'debt' | 'credit'>('debt');
  const [editSubGroups, setEditSubGroups] = useState<string[]>([]);
  const [editCustomGroup, setEditCustomGroup] = useState('');

  const startEditingSubscriber = (sub: Subscriber) => {
    setEditingSub(sub);
    setEditSubName(sub.name);
    setEditSubPhone(sub.phone || '');
    setEditSubWhatsapp(sub.whatsapp || '');
    
    const balance = sub.openingBalance || 0;
    setEditSubOpeningBalance(Math.abs(balance) > 0 ? Math.abs(balance).toString() : '');
    setEditSubOpeningType(balance >= 0 ? 'debt' : 'credit');
    setEditSubGroups(sub.groups || []);
    setEditCustomGroup('');
  };

  const handleEditSubscriberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !editSubName.trim()) return;

    const rawBalance = parseFloat(editSubOpeningBalance) || 0;
    const openingBalance = editSubOpeningType === 'debt' ? rawBalance : -rawBalance;

    onUpdateSubscriber({
      ...editingSub,
      name: editSubName.trim(),
      phone: editSubPhone.trim() || undefined,
      whatsapp: editSubWhatsapp.trim() || undefined,
      openingBalance,
      groups: editSubGroups,
    });

    setEditingSub(null);
  };

  // Payment Recording Modal-like state per subscriber
  const [paymentAmount, setPaymentAmount] = useState<{ [subId: string]: string }>({});
  const [paymentNotes, setPaymentNotes] = useState<{ [subId: string]: string }>({});
  const [recordingPaymentId, setRecordingPaymentId] = useState<string | null>(null);

  // Add Subscriber Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');

    if (!newSubName.trim()) return;

    if (createUserAccount) {
      if (!userUsername.trim()) {
        setAddFormError('الرجاء إدخال اسم المستخدم للدخول.');
        return;
      }
      if (!userPassword.trim()) {
        setAddFormError('الرجاء إدخال كلمة المرور.');
        return;
      }
      if (userPassword.length < 4) {
        setAddFormError('يجب أن تكون كلمة المرور مكونة من 4 أحرف أو أرقام على الأقل.');
        return;
      }
      // Check if username already exists in usersList
      const usernameExists = (usersList || []).some(
        (u) => u.username.toLowerCase() === userUsername.trim().toLowerCase()
      );
      if (usernameExists) {
        setAddFormError('اسم المستخدم هذا مستخدم بالفعل في النظام. الرجاء اختيار اسم مستخدم آخر.');
        return;
      }
    }

    const rawBalance = parseFloat(newSubOpeningBalance) || 0;
    const openingBalance = newSubOpeningType === 'debt' ? rawBalance : -rawBalance;

    onAddSubscriber(
      newSubName.trim(),
      newSubPhone.trim() || undefined,
      newSubWhatsapp.trim() || undefined,
      openingBalance,
      selectedGroups,
      createUserAccount,
      userUsername.trim(),
      userPassword.trim(),
      userRole
    );

    setNewSubName('');
    setNewSubPhone('');
    setNewSubWhatsapp('');
    setNewSubOpeningBalance('');
    setNewSubOpeningType('debt');
    setSelectedGroups([]);
    setCustomGroup('');
    setCreateUserAccount(false);
    setUserUsername('');
    setUserPassword('');
    setUserRole('viewer');
    setAddFormError('');
    setIsAdding(false);
  };

  // Payment Submit
  const handlePaymentSubmit = (subId: string, e: React.FormEvent) => {
    e.preventDefault();
    const amountStr = paymentAmount[subId] || '';
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    onRecordPayment(subId, amount, paymentNotes[subId]?.trim() || undefined);

  // Reset payment inputs
    setPaymentAmount((prev) => ({ ...prev, [subId]: '' }));
    setPaymentNotes((prev) => ({ ...prev, [subId]: '' }));
    setRecordingPaymentId(null);
  };

  const [selectedFilterGroup, setSelectedFilterGroup] = useState<string>('all');

  const allGroupsInSystem = Array.from(
    new Set([...(groupsList || []), ...subscribers.flatMap((s) => s.groups || [])])
  );

  const filteredSubscribers = selectedFilterGroup === 'all'
    ? subscribers
    : subscribers.filter((s) => s.groups && s.groups.includes(selectedFilterGroup));

  React.useEffect(() => {
    const handleOpenAddSub = () => {
      setActiveTab('subs');
      setIsAdding(true);
      setTimeout(() => {
        const el = document.getElementById('input-new-sub-name');
        if (el) {
          el.focus();
        }
      }, 300);
    };
    const handleOpenAddGroup = () => {
      setActiveTab('groups');
      setIsAdding(false);
      setTimeout(() => {
        const el = document.getElementById('input-manage-new-group');
        if (el) {
          el.focus();
        }
      }, 300);
    };
    const handleHighlightGroups = (e: Event) => {
      setActiveTab('groups');
      setIsAdding(false);
    };

    window.addEventListener('open-add-subscriber', handleOpenAddSub);
    window.addEventListener('open-add-group', handleOpenAddGroup);
    window.addEventListener('highlight-groups', handleHighlightGroups);

    return () => {
      window.removeEventListener('open-add-subscriber', handleOpenAddSub);
      window.removeEventListener('open-add-group', handleOpenAddGroup);
      window.removeEventListener('highlight-groups', handleHighlightGroups);
    };
  }, []);

  return (
    <>
      <div id="subscribers-section" className="space-y-6">
      {/* Header and Quick stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">إدارة المشتركين والذمم المالية</h2>
          <p className="text-sm text-slate-500">متابعة المبالغ المستحقة والمدفوعات والديون المتراكمة لكل مشترك والمجموعات</p>
        </div>
        {activeTab === 'subs' && (
          <button
            id="btn-toggle-add-sub"
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            {isAdding ? 'إغلاق النموذج' : 'إضافة مشترك جديد'}
          </button>
        )}
      </div>

      {/* Tabs Switcher Bar */}
      <div className="flex border-b border-slate-200/60" dir="rtl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('subs');
            setIsAdding(false);
          }}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'subs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>المشتركين والذمم ({subscribers.length})</span>
        </button>
        <button
          type="button"
          id="tab-btn-groups"
          onClick={() => {
            setActiveTab('groups');
            setIsAdding(false);
          }}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'groups'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tags className="w-4 h-4 text-purple-500" />
          <span>مجموعات المشتركين ({allGroupsInSystem.length})</span>
        </button>
        <button
          type="button"
          id="tab-btn-bulk-reminders"
          onClick={() => {
            setActiveTab('bulk_reminders');
            setIsAdding(false);
          }}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'bulk_reminders'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span>التذكير الجماعي بالديون ⚠️</span>
        </button>
      </div>

      {/* Add Subscriber Form Collapsible */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddSubmit} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  تسجيل مشترك جديد في النظام
                </h3>
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-extrabold border border-blue-100">
                  رقم المشترك التلقائي: #{subscribers.reduce((max, s) => {
                    const num = typeof s.subNumber === 'number' ? s.subNumber : 1000;
                    return num > max ? num : max;
                  }, 1000) + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم المشترك بالكامل <span className="text-red-500">*</span></label>
                  <input
                    id="input-new-sub-name"
                    type="text"
                    required
                    placeholder="مثال: صالح محمد الهاشمي"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                  />
                </div>

                {/* Group Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">المجموعات (اختر واحدة أو أكثر)</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-xl max-h-32 overflow-y-auto">
                    {allGroupsInSystem.map((g) => {
                      const isSelected = selectedGroups.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroups(selectedGroups.filter((x) => x !== g));
                            } else {
                              setSelectedGroups([...selectedGroups, g]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom Group Add */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="input-new-sub-group-custom"
                      type="text"
                      placeholder="إضافة مجموعة مخصصة..."
                      value={customGroup}
                      onChange={(e) => setCustomGroup(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = customGroup.trim();
                        if (val) {
                          onAddGroup(val);
                          if (!selectedGroups.includes(val)) {
                            setSelectedGroups([...selectedGroups, val]);
                          }
                          setCustomGroup('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم الجوال (اختياري)</label>
                  <input
                    id="input-new-sub-phone"
                    type="text"
                    placeholder="مثال: 05XXXXXXXX"
                    value={newSubPhone}
                    onChange={(e) => setNewSubPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-left"
                    dir="ltr"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم الواتساب (اختياري)</label>
                  <input
                    id="input-new-sub-whatsapp"
                    type="text"
                    placeholder="مثال: 05XXXXXXXX"
                    value={newSubWhatsapp}
                    onChange={(e) => setNewSubWhatsapp(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-100/50 p-4 rounded-xl border border-slate-200/50">
                {/* Opening Balance */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">القيد الافتتاحي / رصيد أول المدة (اختياري)</label>
                  <div className="relative">
                    <input
                      id="input-new-sub-opening"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newSubOpeningBalance}
                      onChange={(e) => setNewSubOpeningBalance(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-left"
                      dir="ltr"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                      {defaultCurrency}
                    </div>
                  </div>
                </div>

                {/* Opening Balance Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">حالة القيد الافتتاحي</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewSubOpeningType('debt')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        newSubOpeningType === 'debt'
                          ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      مستحق عليه (مدين / ذمة)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSubOpeningType('credit')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        newSubOpeningType === 'credit'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      له رصيد (دائن / دفعة مسبقة)
                    </button>
                  </div>
                </div>
              </div>

              {/* Linked User Account Creation Option */}
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createUserAccount}
                      onChange={(e) => {
                        setCreateUserAccount(e.target.checked);
                        if (e.target.checked && !userUsername && newSubName) {
                          // Propose a default username from the subscriber name
                          const sanitized = newSubName.trim()
                            .replace(/\s+/g, '_')
                            .toLowerCase();
                          setUserUsername(sanitized);
                          setUserPassword('123456'); // default password
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-800 block">إنشاء حساب مستخدم مرتبط في المنظومة</span>
                      <span className="text-[10px] text-slate-400 font-bold block">تفعيل هذا الخيار يتيح للمشترك الدخول والاطلاع على فواتيره أو إدارتها</span>
                    </div>
                  </label>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>

                <AnimatePresence>
                  {createUserAccount && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-3 pt-3 border-t border-slate-100"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Username */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">اسم المستخدم للدخول <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            placeholder="مثال: ahmed_123"
                            value={userUsername}
                            onChange={(e) => setUserUsername(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none text-xs font-medium text-left"
                            dir="ltr"
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            placeholder="لا تقل عن 4 خانات"
                            value={userPassword}
                            onChange={(e) => setUserPassword(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none text-xs font-medium text-left font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* User Role */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">مستوى الصلاحية لهذا المستخدم</label>
                        <select
                          value={userRole}
                          onChange={(e) => setUserRole(e.target.value as UserRole)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none text-xs font-bold"
                        >
                          <option value="viewer">مشاهد فقط (Viewer - يمكنه فقط استعراض فواتيره المرتبطة)</option>
                          <option value="operator">مدخل بيانات / محاسب (Operator - يمتلك صلاحيات المحاسب)</option>
                          <option value="admin">مدير نظام كامل (Admin - صلاحيات تحكم كاملة)</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {addFormError && (
                <div className="p-3 bg-red-50 border-2 border-red-100 text-red-700 rounded-xl font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 animate-bounce" />
                  <span>{addFormError}</span>
                </div>
              )}

              {/* Display Chosen Groups Preview */}
              {selectedGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/20 border border-blue-100/40 rounded-xl">
                  <span className="text-[11px] font-bold text-blue-700">المجموعات المختارة:</span>
                  {selectedGroups.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200/50 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-semibold"
                    >
                      {g}
                      <button
                        type="button"
                        onClick={() => setSelectedGroups(selectedGroups.filter((x) => x !== g))}
                        className="text-[10px] text-blue-400 hover:text-blue-700 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/40">
                <button
                  id="btn-cancel-add-sub"
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-white text-slate-500 font-semibold text-xs rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="btn-save-new-sub"
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm shadow-emerald-500/10 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  حفظ وتسجيل المشترك
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Contents */}
      {activeTab === 'subs' && (
        <>
          {/* Subscribers Grid / Table List */}
          {subscribers.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-slate-200 bg-white rounded-2xl">
          <p className="text-slate-500 font-medium mb-4">لا يوجد أي مشتركين مسجلين في النظام بعد.</p>
          <button
            id="btn-show-add-sub-empty"
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            أضف أول مشترك الآن لبدء تقسيم الفواتير
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Groups Filter Container */}
          <div
            id="groups-filter-container"
            className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                <Tags className="w-4 h-4 text-purple-500" />
                تصفية المشتركين حسب المجموعة
              </span>
              {selectedFilterGroup !== 'all' && (
                <button
                  onClick={() => setSelectedFilterGroup('all')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors cursor-pointer"
                >
                  عرض الكل
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              <button
                onClick={() => setSelectedFilterGroup('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  selectedFilterGroup === 'all'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/10'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                الكل ({subscribers.length})
              </button>
              {allGroupsInSystem.map((g) => {
                const count = subscribers.filter((s) => s.groups && s.groups.includes(g)).length;
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedFilterGroup(g)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      selectedFilterGroup === g
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-500/10'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {g} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredSubscribers.length === 0 ? (
            <div className="text-center p-12 border border-dashed border-slate-200 bg-white rounded-2xl">
              <p className="text-slate-400 text-sm font-medium">لا يوجد أي مشتركين مسجلين في المجموعة المحددة.</p>
              <button
                onClick={() => setSelectedFilterGroup('all')}
                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                إلغاء التصفية وعرض جميع المشتركين
              </button>
            </div>
          ) : (
            filteredSubscribers.map((sub) => {
            const stats = calculateSubscriberStats(sub, invoices, payments);
            const isExpanded = expandedSubId === sub.id;
            const isRecordingPayment = recordingPaymentId === sub.id;
            const trend = getTrendStats(sub.id);

            const renderDebtTrend = () => {
              if (trend.debtDiff > 0) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200/50 cursor-help"
                    title={`ارتفعت ديون هذا الشهر (${trend.curMonthName}) مقارنة بالشهر السابق (${trend.prevMonthName}) بقيمة +${trend.debtDiff} ${defaultCurrency}`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    <span>+{trend.debtDiff}</span>
                  </span>
                );
              } else if (trend.debtDiff < 0) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200/50 cursor-help"
                    title={`انخفضت ديون هذا الشهر (${trend.curMonthName}) مقارنة بالشهر السابق (${trend.prevMonthName}) بقيمة ${trend.debtDiff} ${defaultCurrency}`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    <span>{trend.debtDiff}</span>
                  </span>
                );
              } else {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-50 text-slate-400 border border-slate-200/40 cursor-help"
                    title={`لم تتغير قيمة الديون مقارنة بالشهر السابق (${trend.prevMonthName})`}
                  >
                    <Minus className="w-3 h-3 shrink-0" />
                    <span>ثابت</span>
                  </span>
                );
              }
            };

            const renderPaidTrend = () => {
              if (trend.paidDiff > 0) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200/50 cursor-help"
                    title={`ارتفعت المدفوعات هذا الشهر (${trend.curMonthName}) مقارنة بالشهر السابق (${trend.prevMonthName}) بقيمة +${trend.paidDiff} ${defaultCurrency}`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    <span>+{trend.paidDiff}</span>
                  </span>
                );
              } else if (trend.paidDiff < 0) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200/50 cursor-help"
                    title={`انخفضت المدفوعات هذا الشهر (${trend.curMonthName}) مقارنة بالشهر السابق (${trend.prevMonthName}) بقيمة ${trend.paidDiff} ${defaultCurrency}`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    <span>{trend.paidDiff}</span>
                  </span>
                );
              } else {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-50 text-slate-400 border border-slate-200/40 cursor-help"
                    title={`لم تتغير قيمة المدفوعات مقارنة بالشهر السابق (${trend.prevMonthName})`}
                  >
                    <Minus className="w-3 h-3 shrink-0" />
                    <span>ثابت</span>
                  </span>
                );
              }
            };

            return (
              <div
                id={`sub-card-${sub.id}`}
                key={sub.id}
                className={`bg-white rounded-2xl border-2 transition-all ${
                  isExpanded ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500/20' : 'border-indigo-50/80 hover:border-indigo-300 dark:border-indigo-950/40 dark:hover:border-indigo-800/80 shadow-md hover:shadow-lg'
                }`}
              >
                {/* Desktop View: Main Row Card (Shown on medium and large screens) */}
                <div className="hidden md:flex md:items-center justify-between gap-4 p-4 sm:p-5">
                  {/* Subscriber Left Panel: Profile info */}
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-base border border-blue-100 flex-shrink-0">
                        {sub.name.charAt(0)}
                      </div>
                      {sub.subNumber && (
                        <span className="absolute -bottom-1 -right-1 bg-slate-700 text-white text-[9px] font-mono font-bold px-1 rounded border border-white">
                          #{sub.subNumber}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-bold text-slate-800 text-base">{sub.name}</h4>
                        {sub.subNumber && (
                          <>
                            <div className="h-4 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 dark:from-blue-600 dark:to-indigo-700 rounded-full mx-2 shadow-sm animate-pulse" /> {/* خط فاصل ملون جميل وجذاب */}
                            <span className="text-xs font-mono font-black text-slate-500">رقم المشترك: #{sub.subNumber}</span>
                          </>
                        )}
                        {/* Group Chips next to name */}
                        {sub.groups && sub.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sub.groups.map((group) => (
                              <span
                                key={group}
                                className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded text-[10px] font-extrabold"
                              >
                                {group}
                              </span>
                            ))}
                          </div>
                        )}
                        {whatsappReminderEnabled && stats.remainingDebt > whatsappReminderThreshold && (
                          <span className="inline-flex items-center bg-rose-50 border border-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-extrabold animate-pulse">
                            ⚠️ ذمة متجاوزة للحد ({stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1 mt-1">
                        {sub.phone ? (
                          <a
                            href={`tel:${sub.phone}`}
                            className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            {sub.phone}
                          </a>
                        ) : (
                          <p className="text-xs text-slate-400 italic">لا يوجد هاتف</p>
                        )}

                        {sub.whatsapp && (
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 transition-colors font-semibold animate-fade-in"
                              dir="ltr"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-500" />
                              {sub.whatsapp} (واتس)
                            </a>
                            {whatsappReminderEnabled && stats.remainingDebt > whatsappReminderThreshold && (
                              <a
                                href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  whatsappReminderTemplate
                                    .replace(/{name}/g, sub.name)
                                    .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                                    .replace(/{currency}/g, defaultCurrency)
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                title="إرسال تذكير الدفع بالصيغة المخصصة عبر الواتساب"
                              >
                                <span>إرسال تذكير بالدين ⚠️</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial metrics column indicators */}
                  <div className="grid grid-cols-3 gap-3 md:w-[480px]">
                    <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 shadow-sm">
                      <span className="text-xs font-black text-slate-500 block mb-1">إجمالي الحصص (دين)</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                          {stats.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-black text-slate-400">{defaultCurrency}</span>
                        </span>
                        {renderDebtTrend()}
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-3 rounded-2xl border-2 border-blue-50 shadow-sm">
                      <span className="text-xs font-black text-blue-700 block mb-1">إجمالي المدفوع (سداد)</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base sm:text-lg font-black text-blue-700 font-mono">
                          {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-black text-blue-500">{defaultCurrency}</span>
                        </span>
                        {renderPaidTrend()}
                      </div>
                    </div>

                    <div className={`p-3 rounded-2xl border-2 shadow-sm ${
                      stats.remainingDebt > 0 
                        ? 'bg-rose-50 border-rose-200 shadow-rose-50/50' 
                        : 'bg-emerald-50 border-emerald-200 shadow-emerald-50/50'
                    }`}>
                      <span className="text-xs font-black text-slate-600 block mb-1">الرصيد المتبقي</span>
                      <span className={`text-base sm:text-lg font-black font-mono ${stats.remainingDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {stats.remainingDebt > 0 
                          ? `${stats.remainingDebt.toLocaleString('en-US', { minimumFractionDigits: 1 })} ${defaultCurrency}` 
                          : 'مُسدد بالكامل'}
                      </span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 md:justify-end">
                    <button
                      id={`btn-ledger-${sub.id}`}
                      onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      كشف الحساب
                    </button>

                    <button
                      id={`btn-pay-${sub.id}`}
                      onClick={() => setRecordingPaymentId(isRecordingPayment ? null : sub.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isRecordingPayment
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      تسجيل دفعة
                    </button>

                    <button
                      id={`btn-edit-${sub.id}`}
                      onClick={() => startEditingSubscriber(sub)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                      title="تعديل المشترك"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {currentUserRole !== 'viewer' && (
                      <button
                        id={`btn-delete-${sub.id}`}
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف المشترك "${sub.name}"؟ سيتم حذف جميع المبالغ المستحقة والمسجلة باسمه!`)) {
                            onDeleteSubscriber(sub.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer ml-auto md:ml-0"
                        title="حذف المشترك"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile View: Responsive Card (Shown on small screens) */}
                <div className="flex md:hidden flex-col p-4 space-y-3.5">
                  {/* Top Header: Initial avatar, Name, SubNumber, Group, and Net Balance Pill */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      <div className="relative mt-0.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
                          {sub.name.charAt(0)}
                        </div>
                        {sub.subNumber && (
                          <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[8px] font-mono font-bold px-1 rounded border border-white">
                            #{sub.subNumber}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                          <h4 className="font-black text-slate-800 text-sm leading-tight">{sub.name}</h4>
                          {sub.subNumber && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="hidden sm:block h-3 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full mx-1.5" /> {/* خط فاصل عمودي ملون */}
                              <div className="sm:hidden w-8 h-0.5 bg-gradient-to-r from-blue-400/80 to-transparent my-1 rounded-full" /> {/* خط فاصل أفقي ملون */}
                              <span className="text-[10px] font-mono font-black text-slate-500">رقم المشترك: #{sub.subNumber}</span>
                            </div>
                          )}
                        </div>
                        {/* Group tag */}
                        {sub.groups && sub.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sub.groups.map((group) => (
                              <span
                                key={group}
                                className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-100/60 px-1.5 py-0.5 rounded-lg text-[9px] font-black"
                              >
                                {group}
                              </span>
                            ))}
                          </div>
                        )}
                        {whatsappReminderEnabled && stats.remainingDebt > whatsappReminderThreshold && (
                          <span className="inline-flex items-center bg-rose-50 border border-rose-100 text-rose-700 px-1.5 py-0.5 rounded-lg text-[9px] font-black animate-pulse mt-1">
                            ⚠️ ذمة متجاوزة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Net Balance Pill and Expand button */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black font-mono shadow-sm ${
                        stats.remainingDebt > 0 
                          ? 'bg-rose-50 border-rose-200 text-rose-700' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        {stats.remainingDebt > 0 
                          ? `${stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${defaultCurrency}` 
                          : 'مُسدد'}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMobileExpand(sub.id)}
                        className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700 border border-slate-200/50 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {mobileExpandedSubs[sub.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible details for mobile screen */}
                  <AnimatePresence>
                    {mobileExpandedSubs[sub.id] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4 pt-2 border-t border-slate-100"
                      >
                        {/* Contact details */}
                        {(sub.phone || sub.whatsapp) ? (
                          <div className="flex flex-col gap-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/70">
                            {sub.phone && (
                              <a
                                href={`tel:${sub.phone}`}
                                className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-2 transition-colors font-semibold"
                                dir="ltr"
                              >
                                <Phone className="w-3.5 h-3.5 text-blue-500" />
                                {sub.phone}
                              </a>
                            )}
                            {sub.whatsapp && (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <a
                                  href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-2 transition-colors font-bold"
                                  dir="ltr"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                                  {sub.whatsapp} (واتس اب للاتصال الفوري)
                                </a>
                                {whatsappReminderEnabled && stats.remainingDebt > whatsappReminderThreshold && (
                                  <a
                                    href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      whatsappReminderTemplate
                                        .replace(/{name}/g, sub.name)
                                        .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                                        .replace(/{currency}/g, defaultCurrency)
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-black self-start mt-1"
                                  >
                                    <span>إرسال تذكير بالدين ⚠️</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}

                         {/* Financial Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 text-center flex flex-col items-center justify-between min-h-[75px]">
                            <span className="text-[9px] font-black text-slate-400 block mb-0.5">الحصص (دين)</span>
                            <span className="text-xs font-black text-slate-700 font-mono highlight-val mb-1">
                              {stats.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                            {renderDebtTrend()}
                          </div>
                          <div className="bg-blue-50/40 p-2 rounded-xl border border-blue-100/50 text-center flex flex-col items-center justify-between min-h-[75px]">
                            <span className="text-[9px] font-black text-blue-500 block mb-0.5">المدفوع (سداد)</span>
                            <span className="text-xs font-black text-blue-700 font-mono highlight-val mb-1">
                              {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                            {renderPaidTrend()}
                          </div>
                          <div className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[75px] ${
                            stats.remainingDebt > 0 ? 'bg-rose-50/50 border-rose-200/50' : 'bg-emerald-50/50 border-emerald-200/50'
                          }`}>
                            <span className="text-[9px] font-black text-slate-500 block mb-0.5">الرصيد</span>
                            <span className={`text-xs font-black font-mono highlight-val ${stats.remainingDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {stats.remainingDebt > 0 ? stats.remainingDebt.toLocaleString('en-US', { minimumFractionDigits: 1 }) : '0.0'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-extrabold px-1 bg-white/40 rounded border border-slate-200/20">المجموع</span>
                          </div>
                        </div>

                        {/* Action buttons list */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-slate-100">
                          <button
                            type="button"
                            onClick={() => setRecordingPaymentId(isRecordingPayment ? null : sub.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                              isRecordingPayment
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5" />
                            دفعة
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                              isExpanded
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            كشف الحساب
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditingSubscriber(sub)}
                            className="p-2 text-slate-500 hover:text-blue-600 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer animate-fade-in"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {currentUserRole !== 'viewer' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف المشترك "${sub.name}"؟ سيتم حذف جميع المبالغ المستحقة والمسجلة باسمه!`)) {
                                  onDeleteSubscriber(sub.id);
                                }
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl bg-slate-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Inline Payment form Collapsible */}
                <AnimatePresence>
                  {isRecordingPayment && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-slate-50 bg-emerald-50/15"
                    >
                      <form
                        onSubmit={(e) => handlePaymentSubmit(sub.id, e)}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row items-end gap-3 border-b border-slate-50"
                      >
                        <div className="w-full sm:w-1/3">
                          <label className="block text-xs font-bold text-emerald-700 mb-1 flex items-center justify-between gap-2">
                            <span>مبلغ الدفعة ({defaultCurrency}) <span className="text-red-500">*</span></span>
                            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2 py-1 rounded-xl shadow-sm">
                              {stats.remainingDebt > 0 
                                ? `المستحق حالياً: ${stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${defaultCurrency}` 
                                : stats.remainingDebt < 0 
                                  ? `دائن مسبقاً: ${Math.abs(stats.remainingDebt).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${defaultCurrency}` 
                                  : 'مُسدد بالكامل'}
                            </span>
                          </label>
                          <input
                            id={`input-pay-amount-${sub.id}`}
                            type="number"
                            step="any"
                            required
                            placeholder="مثال: 150"
                            value={paymentAmount[sub.id] || ''}
                            onChange={(e) => setPaymentAmount((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                            dir="ltr"
                          />
                        </div>
                        <div className="w-full sm:flex-1">
                          <label className="block text-xs font-bold text-emerald-700 mb-1">ملاحظة أو طريقة الدفع (اختياري)</label>
                          <input
                            id={`input-pay-notes-${sub.id}`}
                            type="text"
                            placeholder="مثال: نقدي، تحويل بنكي، دفعة جزئية"
                            value={paymentNotes[sub.id] || ''}
                            onChange={(e) => setPaymentNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            id={`btn-submit-pay-${sub.id}`}
                            type="submit"
                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            تأكيد الدفع
                          </button>
                          <button
                            id={`btn-cancel-pay-${sub.id}`}
                            type="button"
                            onClick={() => setRecordingPaymentId(null)}
                            className="px-3 py-2 bg-white text-slate-500 font-semibold text-xs rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                          >
                            إلغاء
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ledger entries history list Collapsible */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 mb-3 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                              كشف الحساب وحركة الديون التفصيلية لـ {sub.name}
                            </h5>
                            <button
                              id={`btn-print-statement-${sub.id}`}
                              type="button"
                              onClick={() => printSubscriberStatement(sub, invoices, payments, billSettings)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="طباعة كشف الحساب وتصديره كـ PDF"
                            >
                              <Printer className="w-3 h-3" />
                              تحميل / طباعة كشف الحساب (PDF)
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400">تاريخ تسجيل المشترك: {new Date(sub.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>

                        {/* Sub-tabs selector for Expanded View */}
                        <div className="flex border-b border-slate-200/80 mb-4 gap-2 overflow-x-auto pb-px">
                          <button
                            type="button"
                            onClick={() => setSubTabs((prev) => ({ ...prev, [sub.id]: 'ledger' }))}
                            className={`px-4 py-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                              (subTabs[sub.id] || 'ledger') === 'ledger'
                                ? 'border-blue-600 text-blue-600 bg-blue-50/30 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            كشف الحساب الموحد
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubTabs((prev) => ({ ...prev, [sub.id]: 'transactions' }))}
                            className={`px-4 py-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                              subTabs[sub.id] === 'transactions'
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            تاريخ الحركة المالية (الفواتير والدفعات)
                          </button>
                        </div>

                        {(subTabs[sub.id] || 'ledger') === 'ledger' ? (
                          getSubscriberLedger(sub, invoices, payments).length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs italic">
                              لا يوجد أي حركات مالية مسجلة بعد لهذا المشترك (لم يشترك في فواتير ولم يسجل دفعات).
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                              {getSubscriberLedger(sub, invoices, payments).map((entry) => {
                                const isInvoice = entry.type === 'invoice';
                                return (
                                  <div
                                    id={`ledger-entry-${entry.id}`}
                                    key={entry.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                                      isInvoice 
                                        ? 'bg-rose-50/20 border-rose-100/50 text-slate-700' 
                                        : 'bg-emerald-50/20 border-emerald-100/50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                                        isInvoice ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                      }`}>
                                        {isInvoice ? (
                                          <TrendingDown className="w-3.5 h-3.5" />
                                        ) : (
                                          <CheckCircle className="w-3.5 h-3.5" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-800">{entry.description}</p>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                          <Calendar className="w-3 h-3" />
                                          {new Date(entry.date).toLocaleString('ar-EG', {
                                            numberingSystem: 'latn',
                                            year: 'numeric',
                                            month: 'numeric',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                      {isInvoice && entry.referenceId !== 'opening' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const inv = invoices.find((i) => i.id === entry.referenceId);
                                            if (inv) {
                                              printSingleInvoice(inv, subscribers, billSettings);
                                            }
                                          }}
                                          className="p-1.5 bg-slate-100/80 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/50 hover:border-blue-200 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                          title="طباعة هذه الفاتورة الفردية"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <div className="text-left font-bold text-sm">
                                        <span className={isInvoice ? 'text-rose-600' : 'text-emerald-600'}>
                                          {isInvoice ? '+' : '-'} {entry.amount.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium mr-1">{defaultCurrency}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          /* Financial Transactions Tab (Invoices & Payments side by side) */
                          (() => {
                            const subInvoices = invoices.filter((inv) => inv.subscriberIds.includes(sub.id));
                            const subPayments = payments.filter((pay) => pay.subscriberId === sub.id);
                            return (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Invoices List Column */}
                                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <h6 className="text-xs font-black text-rose-700 flex items-center gap-1.5 border-b border-rose-50 pb-2 mb-2">
                                    <FileText className="w-4 h-4 text-rose-500" />
                                    سجل الفواتير والمستحقات الخاصة به ({subInvoices.length})
                                  </h6>
                                  
                                  {subInvoices.length === 0 ? (
                                    <p className="text-slate-400 text-xs italic text-center py-8">لا توجد فواتير مسجلة لهذا المشترك.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                      {subInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (
                                        <div key={inv.id} className="p-3 bg-rose-50/15 border border-rose-100/50 rounded-xl flex items-center justify-between gap-3 text-xs transition-all hover:bg-rose-50/25">
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-slate-800">
                                                {inv.isExpense ? 'مصروف مشترك ⚠️' : 'فاتورة كهرباء'}
                                              </span>
                                              <span className="text-[10px] bg-rose-100/60 text-rose-700 px-2 py-0.5 rounded-lg font-extrabold font-mono">
                                                {inv.sharePerSubscriber.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                                              </span>
                                            </div>
                                            {inv.isExpense ? (
                                              <p className="text-slate-500 font-medium text-[11px] leading-relaxed">{inv.notes || 'مصروف عام مشترك'}</p>
                                            ) : (
                                              <p className="text-slate-500 font-medium text-[11px] leading-relaxed">
                                                القراءات: {inv.prevReading} ← {inv.currReading} ({inv.consumption} ك.و)
                                              </p>
                                            )}
                                            <span className="text-[10px] text-slate-400 block font-mono">
                                              {new Date(inv.date).toLocaleDateString('ar-EG', {numberingSystem: 'latn'})} {new Date(inv.date).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit', numberingSystem: 'latn'})}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {!inv.isExpense && (
                                              <button
                                                type="button"
                                                onClick={() => printSingleInvoice(inv, subscribers, billSettings)}
                                                className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200/50 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                                title="طباعة الفاتورة الفردية"
                                              >
                                                <Printer className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            {onDeleteInvoice && currentUserRole !== 'viewer' && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة حساب ديون جميع المشتركين المرتبطين بها!')) {
                                                    onDeleteInvoice(inv.id);
                                                  }
                                                }}
                                                className="p-1.5 bg-white hover:bg-red-50 text-rose-500 hover:text-red-600 border border-slate-200/50 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                                                title="حذف الفاتورة"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Payments List Column */}
                                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <h6 className="text-xs font-black text-emerald-700 flex items-center gap-1.5 border-b border-emerald-50 pb-2 mb-2">
                                    <Coins className="w-4 h-4 text-emerald-500" />
                                    سجل الدفعات والوصولات النقدية ({subPayments.length})
                                  </h6>
                                  
                                  {subPayments.length === 0 ? (
                                    <p className="text-slate-400 text-xs italic text-center py-8">لا توجد دفعات مالية مسجلة لهذا المشترك.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                      {subPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pay => (
                                        <div key={pay.id} className="p-3 bg-emerald-50/15 border border-emerald-100/50 rounded-xl flex items-center justify-between gap-3 text-xs transition-all hover:bg-emerald-50/25">
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-slate-800">إيصال سداد دفعة</span>
                                              <span className="text-[10px] bg-emerald-100/60 text-emerald-700 px-2 py-0.5 rounded-lg font-extrabold font-mono">
                                                {pay.amount.toLocaleString('en-US', { maximumFractionDigits: 1 })} {defaultCurrency}
                                              </span>
                                            </div>
                                            <p className="text-slate-500 font-medium text-[11px] leading-relaxed">
                                              {pay.notes || 'سداد دفعة نقدية مقبوضة'}
                                            </p>
                                            <span className="text-[10px] text-slate-400 block font-mono">
                                              {new Date(pay.date).toLocaleDateString('ar-EG', {numberingSystem: 'latn'})} {new Date(pay.date).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit', numberingSystem: 'latn'})}
                                            </span>
                                          </div>
                                          {onDeletePayment && currentUserRole !== 'viewer' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (confirm('هل أنت متأكد من حذف هذه الدفعة المالية؟ سيتم إعادتها إلى ديون المشترك!')) {
                                                  onDeletePayment(pay.id);
                                                }
                                              }}
                                              className="p-1.5 bg-white hover:bg-red-50 text-rose-500 hover:text-red-600 border border-slate-200/50 hover:border-red-200 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                                              title="حذف هذه الدفعة"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }))}
        </div>
      )}
        </>
      )}

      {activeTab === 'groups' && (
        /* ==================== GROUPS DASHBOARD TAB ==================== */
        <div className="space-y-6">
          {/* Add/Create Group Card Form */}
          <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">إضافة مجموعة جديدة وتحديد المشاركين فيها</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">قم بتسجيل مجموعة جديدة وتحديد المشتركين المنتمين إليها مباشرة لتسهيل توزيع الفواتير</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group Name input */}
              <div className="space-y-1.5 text-right">
                <label className="block text-xs font-bold text-slate-700">اسم المجموعة الجديدة <span className="text-red-500">*</span></label>
                <input
                  id="input-manage-new-group-inline"
                  type="text"
                  placeholder="مثال: سكان عمارة أ، الدور الأول، المحلات"
                  value={newGroupInputName}
                  onChange={(e) => setNewGroupInputName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-right"
                />
              </div>

              {/* Members selection panel */}
              <div className="space-y-1.5 text-right flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">المشاركون في المجموعة ({newGroupSelectedSubIds.length})</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (newGroupSelectedSubIds.length === subscribers.length) {
                        setNewGroupSelectedSubIds([]);
                      } else {
                        setNewGroupSelectedSubIds(subscribers.map((s) => s.id));
                      }
                    }}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-extrabold transition-colors cursor-pointer"
                  >
                    {newGroupSelectedSubIds.length === subscribers.length ? 'إلغاء تحديد الجميع' : 'تحديد جميع المشتركين'}
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="البحث عن مشترك وتضمينه في هذه المجموعة..."
                  value={groupSubSearchTerm}
                  onChange={(e) => setGroupSubSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-right"
                />
              </div>
            </div>

            {/* List of subscribers to select */}
            <div className="space-y-1 text-right">
              <span className="text-[10px] text-slate-400 font-bold">اضغط لتحديد أو إلغاء تحديد المشتركين:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50/50 border border-slate-100 rounded-2xl max-h-36 overflow-y-auto">
                {subscribers.length === 0 ? (
                  <p className="col-span-full text-center text-xs text-slate-400 font-bold py-4">الرجاء تسجيل المشتركين أولاً في نظام المشتركين لتتمكن من إضافتهم للمجموعات.</p>
                ) : (
                  subscribers
                    .filter((s) => s.name.toLowerCase().includes(groupSubSearchTerm.toLowerCase()))
                    .map((sub) => {
                      const isSelected = newGroupSelectedSubIds.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewGroupSelectedSubIds(newGroupSelectedSubIds.filter((id) => id !== sub.id));
                            } else {
                              setNewGroupSelectedSubIds([...newGroupSelectedSubIds, sub.id]);
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-right transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-purple-300 bg-purple-50/70 text-purple-950 font-bold shadow-sm'
                              : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                          <span className="text-xs truncate">{sub.name}</span>
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const val = newGroupInputName.trim();
                  if (!val) {
                    alert('الرجاء إدخال اسم المجموعة أولاً!');
                    return;
                  }
                  onAddGroup(val, newGroupSelectedSubIds);
                  setNewGroupInputName('');
                  setNewGroupSelectedSubIds([]);
                  setGroupSubSearchTerm('');
                }}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-500/10 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                حفظ المجموعة الجديدة ومشاركيها
              </button>
            </div>
          </div>

          {/* Current Groups List Section */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Tags className="w-4 h-4 text-purple-500" />
              المجموعات الحالية وتفاصيل المشتركين فيها ({allGroupsInSystem.length})
            </h3>

            {allGroupsInSystem.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-slate-200 bg-white rounded-3xl">
                <p className="text-slate-400 text-sm font-medium">لا توجد أي مجموعات مسجلة في النظام حالياً.</p>
                <p className="text-slate-400 text-xs font-medium mt-1">يمكنك إنشاء مجموعتك الأولى الآن باستخدام النموذج أعلاه.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {allGroupsInSystem.map((g) => {
                  const groupSubs = subscribers.filter((s) => s.groups && s.groups.includes(g));
                  const isEditingThis = editingGroupOldName === g;

                  return (
                    <div
                      key={g}
                      className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-3.5 transition-all hover:border-slate-200"
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingGroupNewName}
                              onChange={(e) => setEditingGroupNewName(e.target.value)}
                              className="flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-purple-300 bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onEditGroup(g, editingGroupNewName);
                                  setEditingGroupOldName(null);
                                } else if (e.key === 'Escape') {
                                  setEditingGroupOldName(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                onEditGroup(g, editingGroupNewName);
                                setEditingGroupOldName(null);
                              }}
                              className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer"
                              title="حفظ التعديل"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingGroupOldName(null)}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 cursor-pointer"
                              title="إلغاء"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800">{g}</span>
                            <span className="text-[10px] font-extrabold bg-purple-50 border border-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                              {groupSubs.length} مشتركين
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {!isEditingThis && (
                            <button
                              onClick={() => {
                                setEditingGroupOldName(g);
                                setEditingGroupNewName(g);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title="تعديل اسم المجموعة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentUserRole !== 'viewer' && (
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف المجموعة "${g}"؟ سيتم إزالتها من جميع المشتركين المنتمين إليها!`)) {
                                  onDeleteGroup(g);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف المجموعة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Group Participants List */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold block text-right">أعضاء المجموعة:</span>
                        
                        {groupSubs.length === 0 ? (
                          <p className="text-[11px] text-slate-400 font-semibold text-right py-1">لا يوجد أي مشتركين ينتمون لهذه المجموعة حالياً.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {groupSubs.map((sub) => (
                              <div
                                key={sub.id}
                                className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors"
                              >
                                <span>{sub.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من رغبتك في إزالة "${sub.name}" من مجموعة "${g}"؟`)) {
                                      const currentGroups = sub.groups || [];
                                      onUpdateSubscriber({
                                        ...sub,
                                        groups: currentGroups.filter((groupName) => groupName !== g)
                                      });
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-500 font-bold mr-1 text-[11px] cursor-pointer"
                                  title="إزالة من المجموعة"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Direct Add Member dropdown/selector for convenience */}
                      <div className="pt-2 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">إضافة عضو للمجموعة:</span>
                        <select
                          value=""
                          onChange={(e) => {
                            const subId = e.target.value;
                            if (subId) {
                              const selectedSub = subscribers.find((s) => s.id === subId);
                              if (selectedSub) {
                                const currentGroups = selectedSub.groups || [];
                                if (!currentGroups.includes(g)) {
                                  onUpdateSubscriber({
                                    ...selectedSub,
                                    groups: [...currentGroups, g]
                                  });
                                }
                              }
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                        >
                          <option value="">اختر مشترك للإضافة...</option>
                          {subscribers
                            .filter((sub) => !sub.groups || !sub.groups.includes(g))
                            .map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bulk_reminders' && (
        <div id="bulk-reminders-section" className="space-y-6 animate-fade-in text-right" dir="rtl">
          {/* Header Card */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">تذكير الديون الجماعي عبر واتساب</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">أرسل رسائل تذكير مخصصة دفعة واحدة للمشتركين الذين تجاوزت ذممهم المالية حداً معيناً</p>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-100 p-2 px-3 rounded-2xl flex items-center gap-4 text-xs font-bold text-slate-600 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                  <span>المستهدفين: {
                    subscribers.filter(sub => {
                      const stats = calculateSubscriberStats(sub, invoices, payments);
                      return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                    }).length
                  }</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>تم الإرسال: {sentSubscribersList.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <p>
                <strong>تنويه تقني:</strong> نظراً للقيود المفروضة على متصفحات الويب وإطار العمل، يتم فتح نافذة دردشة واتساب (WhatsApp Web / App) آلياً لكل مشترك بشكل منفصل ومحملة مسبقاً بالنص المخصص، مما يتيح لك إرسالها فوراً بنقرة زر واحدة دون الحاجة لتكرار الكتابة أو نسخ الأرقام، وهي الطريقة الأكثر أماناً لحسابك من الحظر.
              </p>
            </div>
          </div>

          {/* Configuration and Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Filter Configuration */}
            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4 lg:col-span-1">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">١. إعداد الفلترة والحد الأدنى</h4>
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">تصفية المشتركين الذين تتجاوز ديونهم مبلغ:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={bulkDebtThreshold}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setBulkDebtThreshold(val);
                    }}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-sans font-black text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-sans">{defaultCurrency}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">سيتم إدراج أي مشترك رصيده المستحق أكبر من هذا المبلغ ولديه رقم واتساب مدخل في النظام.</p>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span>إجمالي المشتركين المسجلين:</span>
                  <span className="font-mono text-slate-800">{subscribers.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span>مشتركون لديهم واتساب:</span>
                  <span className="font-mono text-slate-800">{subscribers.filter(s => s.whatsapp).length}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-600 bg-rose-50/50 p-2 rounded-lg">
                  <span className="text-rose-700">مستحقين للتذكير (متجاوزين):</span>
                  <span className="font-mono font-black text-rose-700">{
                    subscribers.filter(sub => {
                      const stats = calculateSubscriberStats(sub, invoices, payments);
                      return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                    }).length
                  }</span>
                </div>
              </div>
            </div>

            {/* Template Editor */}
            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">٢. صياغة قالب الرسالة الجماعية</h4>
                <button
                  type="button"
                  onClick={() => {
                    setBulkMessageTemplate('السلام عليكم {name}، نود تذكيركم بأن رصيدكم المستحق لقيمة استهلاك الكهرباء هو {debt} {currency}. يرجى التكرم بالسداد في أقرب وقت ممكن. شاكرين تعاونكم.');
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-black"
                >
                  إعادة القالب الافتراضي
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={bulkMessageTemplate}
                  onChange={(e) => setBulkMessageTemplate(e.target.value)}
                  placeholder="اكتب نص الرسالة هنا..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-sans text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 leading-relaxed text-right"
                />
                
                {/* Variable Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold ml-1">انقر لإدراج متغير:</span>
                  <button
                    type="button"
                    onClick={() => setBulkMessageTemplate(prev => prev + ' {name} ')}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 transition-all flex items-center gap-1"
                  >
                    <span className="text-blue-500 font-mono">{"{"}name{"}"}</span>
                    <span>اسم المشترك</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMessageTemplate(prev => prev + ' {debt} ')}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 transition-all flex items-center gap-1"
                  >
                    <span className="text-rose-500 font-mono">{"{"}debt{"}"}</span>
                    <span>الدين المستحق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMessageTemplate(prev => prev + ' {currency} ')}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 transition-all flex items-center gap-1"
                  >
                    <span className="text-emerald-500 font-mono">{"{"}currency{"}"}</span>
                    <span>العملة الافتراضية</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Matching list & Live Preview Column */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* List & checklist */}
            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4 xl:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  ٣. المشتركون المستحقون للتذكير بالحد الحالي ({
                    subscribers.filter(sub => {
                      const stats = calculateSubscriberStats(sub, invoices, payments);
                      return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                    }).length
                  })
                </h4>
              </div>

              {/* Sequential Wizard Mini-Panel */}
              {(() => {
                const matched = subscribers.filter(sub => {
                  const stats = calculateSubscriberStats(sub, invoices, payments);
                  return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                });
                const unsent = matched.filter(sub => !sentSubscribersList.includes(sub.id));
                if (matched.length > 0) {
                  return (
                    <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-700 block">معالج الإرسال الذكي والمستمر</span>
                        <span className="text-[11px] text-slate-500 font-semibold">متبقي {unsent.length} مشتركين من أصل {matched.length} بحاجة لإرسال التذكير.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sentSubscribersList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSentSubscribersList([])}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            إعادة تعيين 🔄
                          </button>
                        )}
                        {unsent.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const nextSub = unsent[0];
                              const stats = calculateSubscriberStats(nextSub, invoices, payments);
                              const compiledMessage = bulkMessageTemplate
                                .replace(/{name}/g, nextSub.name)
                                .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                                .replace(/{currency}/g, defaultCurrency);
                              
                              const url = `https://wa.me/${nextSub.whatsapp!.replace(/\D/g, '')}?text=${encodeURIComponent(compiledMessage)}`;
                              window.open(url, '_blank');
                              
                              setSentSubscribersList(prev => [...prev, nextSub.id]);
                              if (unsent.length > 1) {
                                setSelectedPreviewSubId(unsent[1].id);
                              } else {
                                setSelectedPreviewSubId(nextSub.id);
                              }
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>إرسال التذكير التالي (متتالي) 🚀</span>
                          </button>
                        ) : (
                          <span className="text-xs font-black text-emerald-600 bg-emerald-100/50 px-3 py-1.5 rounded-lg">
                            🎉 تم تذكير جميع المشتركين بنجاح!
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {(() => {
                const matched = subscribers.filter(sub => {
                  const stats = calculateSubscriberStats(sub, invoices, payments);
                  return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                });

                if (matched.length === 0) {
                  return (
                    <div className="text-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                      <p className="text-xs text-slate-400 font-extrabold">لا يوجد أي مشتركين ديونهم متجاوزة للمبلغ ({bulkDebtThreshold} {defaultCurrency}) حالياً ولديهم رقم واتساب.</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">جرب خفض قيمة الحد الأدنى للمديونية لإدراج مشتركين أكثر.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                    {matched.map(sub => {
                      const stats = calculateSubscriberStats(sub, invoices, payments);
                      const isSent = sentSubscribersList.includes(sub.id);
                      const isSelectedPreview = selectedPreviewSubId === sub.id || (!selectedPreviewSubId && matched[0]?.id === sub.id);

                      const compiledMessage = bulkMessageTemplate
                        .replace(/{name}/g, sub.name)
                        .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                        .replace(/{currency}/g, defaultCurrency);

                      return (
                        <div
                          key={sub.id}
                          onClick={() => setSelectedPreviewSubId(sub.id)}
                          className={`p-3.5 border rounded-2xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isSelectedPreview
                              ? 'border-indigo-200 bg-indigo-50/20 ring-2 ring-indigo-500/10'
                              : 'border-slate-100 bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Name and Meta */}
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${isSent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 text-right">
                              <h5 className="text-xs font-black text-slate-800">{sub.name}</h5>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-bold font-mono">#{sub.subNumber}</span>
                                <span className="text-[10px] text-slate-500 font-semibold">{sub.whatsapp}</span>
                                {sub.groups && sub.groups.length > 0 && (
                                  <span className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded font-bold">{sub.groups[0]}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Debt and Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-50 pt-2 sm:pt-0">
                            <div className="text-right sm:text-left">
                              <span className="text-[10px] font-bold text-slate-400 block sm:hidden">الذمة المستحقة</span>
                              <span className="text-sm font-black text-rose-600 font-mono">
                                {stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                                <span className="text-[10px] text-slate-400 mr-1 font-bold">{defaultCurrency}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isSent ? (
                                <span className="px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black rounded-lg flex items-center gap-1 shrink-0">
                                  <Check className="w-3 h-3" />
                                  تم الإرسال
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-bold rounded-lg shrink-0">
                                  لم يُرسل
                                </span>
                              )}

                              <a
                                href={`https://wa.me/${sub.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(compiledMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!sentSubscribersList.includes(sub.id)) {
                                    setSentSubscribersList(prev => [...prev, sub.id]);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                title="فتح دردشة واتساب لهذا المشترك بالرسالة المخصصة"
                              >
                                إرسال 📱
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* WhatsApp Live Preview Mockup Column */}
            <div className="xl:col-span-5 space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider text-right pr-2">معاينة الرسالة المخصصة قبل الإرسال</h4>
              
              {(() => {
                const matched = subscribers.filter(sub => {
                  const stats = calculateSubscriberStats(sub, invoices, payments);
                  return stats.remainingDebt > bulkDebtThreshold && sub.whatsapp;
                });

                // Get current sub for preview
                const currentPreviewSub = subscribers.find(s => s.id === selectedPreviewSubId) || matched[0];

                if (!currentPreviewSub) {
                  return (
                    <div className="bg-slate-50 rounded-3xl p-8 text-center border border-slate-100 text-slate-400 text-xs font-bold">
                      يرجى تحديد مشترك من القائمة الجانبية لعرض معاينة الرسالة المخصصة له هنا.
                    </div>
                  );
                }

                const stats = calculateSubscriberStats(currentPreviewSub, invoices, payments);
                const compiledMessage = bulkMessageTemplate
                  .replace(/{name}/g, currentPreviewSub.name)
                  .replace(/{debt}/g, stats.remainingDebt.toLocaleString('en-US', { maximumFractionDigits: 1 }))
                  .replace(/{currency}/g, defaultCurrency);

                const isSent = sentSubscribersList.includes(currentPreviewSub.id);

                return (
                  <div className="bg-slate-900 rounded-[36px] p-4 pt-10 pb-6 border-4 border-slate-800 shadow-xl relative max-w-[340px] mx-auto overflow-hidden">
                    {/* Phone Notch/Ear speaker */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                      <span className="w-1.5 h-1.5 bg-slate-900 rounded-full"></span>
                      <span className="w-8 h-1 bg-slate-900 rounded-full mr-2"></span>
                    </div>

                    {/* Chat Window Screen Container */}
                    <div className="bg-[#efeae2] rounded-[24px] overflow-hidden min-h-[380px] flex flex-col font-sans relative border border-slate-950">
                      
                      {/* WhatsApp Mock Header */}
                      <div className="bg-[#075e54] text-white p-3 flex items-center justify-between gap-2" dir="rtl">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200/20 flex items-center justify-center font-black text-xs text-white uppercase">
                            {currentPreviewSub.name.substring(0, 2)}
                          </div>
                          <div>
                            <h5 className="text-[11px] font-black leading-tight text-white">{currentPreviewSub.name}</h5>
                            <span className="text-[8px] text-emerald-100 font-bold block">متصل الآن</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-100 text-[10px] font-mono">
                          <span>واتساب</span>
                        </div>
                      </div>

                      {/* Conversation Area with Bubbles */}
                      <div className="flex-1 p-3 flex flex-col justify-end space-y-3 bg-[#e5ddd5] relative overflow-y-auto">
                        {/* Overlay pattern representation */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                        
                        {/* Received Hello Mock Message */}
                        <div className="bg-white text-slate-800 rounded-2xl rounded-tr-none p-2.5 max-w-[85%] self-start text-[10px] font-medium shadow-sm leading-relaxed relative z-10 text-right">
                          مرحباً، أرجو تزويدي بمستحقاتي المتأخرة للعداد.
                          <span className="text-[7px] text-slate-400 block text-left mt-1 font-mono">08:15 ص</span>
                        </div>

                        {/* Sent Custom Reminder Message Bubble */}
                        <div className="bg-[#dcf8c6] text-slate-800 rounded-2xl rounded-tl-none p-3 max-w-[85%] self-end text-xs font-semibold shadow-sm leading-relaxed text-right relative z-10 whitespace-pre-wrap">
                          {compiledMessage}
                          <span className="text-[7px] text-slate-500 flex items-center gap-0.5 justify-end mt-1 font-mono">
                            {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            <span className="text-sky-500 font-extrabold font-mono">✓✓</span>
                          </span>
                        </div>
                      </div>

                      {/* Mock Chat Input Footer */}
                      <div className="bg-[#f0f0f0] p-2 flex items-center gap-2 border-t border-slate-200/50">
                        <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-slate-400 text-right pointer-events-none">
                          اكتب رسالة...
                        </div>
                        <div className="w-7 h-7 bg-[#075e54] text-white rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    {/* Action trigger button */}
                    <div className="mt-4 pt-2">
                      <a
                        href={`https://wa.me/${currentPreviewSub.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(compiledMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (!sentSubscribersList.includes(currentPreviewSub.id)) {
                            setSentSubscribersList(prev => [...prev, currentPreviewSub.id]);
                          }
                        }}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>إرسال التذكير للمشترك الحالي 🚀</span>
                      </a>
                      
                      <div className="text-center mt-2">
                        <span className="text-[9px] text-slate-400 font-semibold block">المشترك المحدد: {currentPreviewSub.name}</span>
                        <span className="text-[9px] text-slate-400 font-semibold block font-mono">الحالة: {isSent ? '✅ تم الإرسال مسبقاً' : '⏳ بانتظار الإرسال'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* 1. Group Management Modal */}
      <AnimatePresence>
        {isGroupsManagerOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsGroupsManagerOpen(false);
                setEditingGroupOldName(null);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Tags className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 text-right">إدارة مجموعات المشتركين</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 text-right">إضافة، تعديل أو حذف مجموعات التصفية</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsGroupsManagerOpen(false);
                      setEditingGroupOldName(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
                  {/* Add Group Form */}
                  <div className="space-y-3 bg-purple-50/20 p-4 rounded-2xl border border-purple-100/40">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 text-right">اسم المجموعة الجديدة <span className="text-red-500">*</span></label>
                      <input
                        id="input-manage-new-group"
                        type="text"
                        placeholder="مثال: الدور الثاني، فيلا 3..."
                        value={newGroupInputName}
                        onChange={(e) => setNewGroupInputName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-right"
                      />
                    </div>

                    {/* Participant Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-600 text-right">المشاركون في هذه المجموعة ({newGroupSelectedSubIds.length}):</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (newGroupSelectedSubIds.length === subscribers.length) {
                                setNewGroupSelectedSubIds([]);
                              } else {
                                setNewGroupSelectedSubIds(subscribers.map((s) => s.id));
                              }
                            }}
                            className="text-[10px] text-purple-600 hover:text-purple-700 font-bold"
                          >
                            {newGroupSelectedSubIds.length === subscribers.length ? 'إلغاء تحديد الجميع' : 'تحديد الجميع'}
                          </button>
                        </div>
                      </div>

                      {/* Search Subscribers */}
                      <input
                        type="text"
                        placeholder="البحث عن مشترك لتضمينه..."
                        value={groupSubSearchTerm}
                        onChange={(e) => setGroupSubSearchTerm(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-right"
                      />

                      {/* Scrollable list of subscribers */}
                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-white border border-slate-200 rounded-xl max-h-32 overflow-y-auto">
                        {subscribers
                          .filter((s) => s.name.toLowerCase().includes(groupSubSearchTerm.toLowerCase()))
                          .map((sub) => {
                            const isSelected = newGroupSelectedSubIds.includes(sub.id);
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setNewGroupSelectedSubIds(newGroupSelectedSubIds.filter((id) => id !== sub.id));
                                  } else {
                                    setNewGroupSelectedSubIds([...newGroupSelectedSubIds, sub.id]);
                                  }
                                }}
                                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-right transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'border-purple-300 bg-purple-50/50 text-purple-950 font-bold'
                                    : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600 text-[11px]'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                  isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                                </div>
                                <span className="text-[11px] truncate">{sub.name}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const val = newGroupInputName.trim();
                          if (!val) {
                            alert('الرجاء إدخال اسم المجموعة!');
                            return;
                          }
                          onAddGroup(val, newGroupSelectedSubIds);
                          setNewGroupInputName('');
                          setNewGroupSelectedSubIds([]);
                          setGroupSubSearchTerm('');
                        }}
                        className="w-full px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        حفظ المجموعة ومشاركيها
                      </button>
                    </div>
                  </div>

                  {/* Existing Groups List */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-400 block text-right">المجموعات الحالية في النظام</span>
                    
                    {allGroupsInSystem.length === 0 ? (
                      <p className="text-center text-slate-400 text-xs py-6">لا يوجد أي مجموعات مسجلة حالياً.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-slate-50/20 max-h-60 overflow-y-auto">
                        {allGroupsInSystem.map((g) => {
                          const subscriberCount = subscribers.filter((s) => s.groups && s.groups.includes(g)).length;
                          const isEditingThis = editingGroupOldName === g;

                          return (
                            <div key={g} className="p-3.5 flex items-center justify-between gap-3 bg-white" dir="rtl">
                              {isEditingThis ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editingGroupNewName}
                                    onChange={(e) => setEditingGroupNewName(e.target.value)}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-purple-300 bg-white text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-right"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        onEditGroup(g, editingGroupNewName);
                                        setEditingGroupOldName(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingGroupOldName(null);
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      onEditGroup(g, editingGroupNewName);
                                      setEditingGroupOldName(null);
                                    }}
                                    className="p-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer"
                                    title="حفظ التعديل"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingGroupOldName(null)}
                                    className="p-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 cursor-pointer"
                                    title="إلغاء"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 overflow-hidden flex-1 justify-start">
                                    <span className="text-xs font-bold text-slate-700 truncate">{g}</span>
                                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      {subscriberCount} مشتركين
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingGroupOldName(g);
                                        setEditingGroupNewName(g);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                      title="تعديل اسم المجموعة"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {currentUserRole === 'admin' && (
                                      <button
                                        onClick={() => {
                                          if (confirm(`هل أنت متأكد من حذف المجموعة "${g}"؟ سيتم إزالتها من جميع المشتركين المنتمين إليها!`)) {
                                            onDeleteGroup(g);
                                          }
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                        title="حذف المجموعة"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button
                    onClick={() => {
                      setIsGroupsManagerOpen(false);
                      setEditingGroupOldName(null);
                    }}
                    className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Edit Subscriber Modal */}
      <AnimatePresence>
        {editingSub && (
          <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSub(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 text-right">تعديل بيانات المشترك</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 text-right">الرقم المرجعي التلقائي: #{editingSub.subNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingSub(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleEditSubscriberSubmit} className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 overflow-y-auto space-y-4 flex-1 text-right">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 text-right">اسم المشترك بالكامل <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={editSubName}
                        onChange={(e) => setEditSubName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right"
                      />
                    </div>

                    {/* Phones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 text-right">رقم الجوال (اختياري)</label>
                        <input
                          type="text"
                          value={editSubPhone}
                          onChange={(e) => setEditSubPhone(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-left"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 text-right">رقم الواتساب (اختياري)</label>
                        <input
                          type="text"
                          value={editSubWhatsapp}
                          onChange={(e) => setEditSubWhatsapp(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Opening Balance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-right">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 text-right">القيد الافتتاحي (اختياري)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.0"
                          value={editSubOpeningBalance}
                          onChange={(e) => setEditSubOpeningBalance(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 text-right">حالة القيد الافتتاحي</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setEditSubOpeningType('debt')}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              editSubOpeningType === 'debt'
                                ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-500/10'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            مستحق عليه (دين)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSubOpeningType('credit')}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              editSubOpeningType === 'credit'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/10'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            له رصيد (دائن)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Group Selection */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 text-right">المجموعات (اختر واحدة أو أكثر)</label>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-slate-200 rounded-2xl max-h-32 overflow-y-auto">
                        {allGroupsInSystem.map((g) => {
                          const isSelected = editSubGroups.includes(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setEditSubGroups(editSubGroups.filter((x) => x !== g));
                                } else {
                                  setEditSubGroups([...editSubGroups, g]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Group Add inline */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="إضافة مجموعة جديدة..."
                          value={editCustomGroup}
                          onChange={(e) => setEditCustomGroup(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none text-xs font-semibold text-right"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = editCustomGroup.trim();
                            if (val) {
                              onAddGroup(val);
                              if (!editSubGroups.includes(val)) {
                                setEditSubGroups([...editSubGroups, val]);
                              }
                              setEditCustomGroup('');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          + إضافة
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingSub(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                    >
                      حفظ التغييرات
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
