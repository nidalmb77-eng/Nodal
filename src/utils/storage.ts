/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subscriber, Invoice, Payment, SubscriberLedgerEntry, User, Notification, ActivityLog, UserRole } from '../types';

export const getInitialUsers = (): User[] => {
  const saved = localStorage.getItem('meter_system_users');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing system users', e);
    }
  }
  // Default system administrator account
  return [
    {
      id: 'user-admin',
      username: 'admin',
      password: 'admin',
      role: 'admin',
      name: 'مدير النظام العام',
    },
  ];
};

export const saveUsersToLocalStorage = (users: User[]) => {
  localStorage.setItem('meter_system_users', JSON.stringify(users));
};

export const getInitialSubscribers = (): Subscriber[] => {
  const saved = localStorage.getItem('meter_subscribers');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing subscribers', e);
    }
  }
  // Default beautiful starting subscribers for demonstration
  const now = new Date().toISOString();
  return [
    { id: '1', subNumber: 1001, name: 'أحمد محمد', createdAt: now, phone: '0599123456', whatsapp: '0599123456', openingBalance: 0, groups: ['المجموعة الأولى'] },
    { id: '2', subNumber: 1002, name: 'خالد مصطفى', createdAt: now, phone: '0599234567', whatsapp: '0599234567', openingBalance: 0, groups: ['المجموعة الثانية'] },
    { id: '3', subNumber: 1003, name: 'سعيد عبد الله', createdAt: now, phone: '0599345678', whatsapp: '0599345678', openingBalance: 0, groups: ['المجموعة الأولى'] },
  ];
};

export const getInitialInvoices = (): Invoice[] => {
  const saved = localStorage.getItem('meter_invoices');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing invoices', e);
    }
  }
  return [];
};

export const getInitialPayments = (): Payment[] => {
  const saved = localStorage.getItem('meter_payments');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing payments', e);
    }
  }
  return [];
};

export const saveToLocalStorage = (
  subscribers: Subscriber[],
  invoices: Invoice[],
  payments: Payment[]
) => {
  localStorage.setItem('meter_subscribers', JSON.stringify(subscribers));
  localStorage.setItem('meter_invoices', JSON.stringify(invoices));
  localStorage.setItem('meter_payments', JSON.stringify(payments));
};

// Calculate financial stats for a single subscriber
export const calculateSubscriberStats = (
  subscriber: Subscriber,
  invoices: Invoice[],
  payments: Payment[]
) => {
  if (!subscriber) {
    return {
      totalDebt: 0,
      totalPaid: 0,
      remainingDebt: 0,
    };
  }

  const opBal = typeof subscriber.openingBalance === 'number' ? subscriber.openingBalance : 0;

  // 1. Total Debt = openingBalance (if > 0) + sum of their share in all invoices where they are included
  const initialDebt = opBal > 0 ? opBal : 0;
  const invoicesDebt = (invoices || [])
    .filter((inv) => inv && inv.subscriberIds && inv.subscriberIds.includes(subscriber.id))
    .reduce((sum, inv) => sum + (inv.sharePerSubscriber || 0), 0);

  const totalDebt = initialDebt + invoicesDebt;

  // 2. Total Paid = openingBalance (if < 0, treated as initial credit/payment) + sum of all their payments
  const initialCredit = opBal < 0 ? Math.abs(opBal) : 0;
  const paymentsPaid = (payments || [])
    .filter((pay) => pay && pay.subscriberId === subscriber.id)
    .reduce((sum, pay) => sum + (pay.amount || 0), 0);

  const totalPaid = initialCredit + paymentsPaid;

  // 3. Current remaining debt
  const remainingDebt = totalDebt - totalPaid;

  return {
    totalDebt: isNaN(totalDebt) ? 0 : Math.round(totalDebt * 100) / 100,
    totalPaid: isNaN(totalPaid) ? 0 : Math.round(totalPaid * 100) / 100,
    remainingDebt: isNaN(remainingDebt) ? 0 : Math.round(remainingDebt * 100) / 100,
  };
};

// Generate a ledger/history for a single subscriber
export const getSubscriberLedger = (
  subscriber: Subscriber,
  invoices: Invoice[],
  payments: Payment[]
): SubscriberLedgerEntry[] => {
  const ledger: SubscriberLedgerEntry[] = [];

  // Add opening balance if non-zero
  if (subscriber.openingBalance && subscriber.openingBalance !== 0) {
    const isDebt = subscriber.openingBalance > 0;
    ledger.push({
      id: `opening-${subscriber.id}`,
      type: isDebt ? 'invoice' : 'payment',
      date: subscriber.createdAt,
      amount: Math.abs(subscriber.openingBalance),
      description: isDebt ? 'قيد افتتاحي (رصيد مستحق عليه)' : 'قيد افتتاحي (دفعة مقدمة / رصيد دائن)',
      referenceId: 'opening',
    });
  }

  // Add invoices
  invoices.forEach((inv) => {
    if (inv.subscriberIds.includes(subscriber.id)) {
      const description = inv.isExpense
        ? `مصروف مشترك: ${inv.notes || 'مصروف متنوع'}`
        : `فاتورة استهلاك: من قراءة ${inv.prevReading} إلى ${inv.currReading} (${inv.consumption} ك.و)`;
      ledger.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        date: inv.date,
        amount: inv.sharePerSubscriber,
        description,
        referenceId: inv.id,
      });
    }
  });

  // Add payments
  payments.forEach((pay) => {
    if (pay.subscriberId === subscriber.id) {
      ledger.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        date: pay.date,
        amount: pay.amount,
        description: pay.notes ? `سداد دفعة: ${pay.notes}` : 'سداد دفعة نقدية',
        referenceId: pay.id,
      });
    }
  });

  // Sort by date descending
  return ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Export all data as JSON
export const exportDataAsJSON = (
  subscribers: Subscriber[],
  invoices: Invoice[],
  payments: Payment[]
): string => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    subscribers,
    invoices,
    payments,
  };
  return JSON.stringify(data, null, 2);
};

// Import all data from JSON
export interface ImportResult {
  success: boolean;
  message: string;
  subscribers?: Subscriber[];
  invoices?: Invoice[];
  payments?: Payment[];
}

export const importDataFromJSON = (jsonString: string): ImportResult => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.subscribers || !Array.isArray(parsed.subscribers)) {
      return { success: false, message: 'ملف غير صالح: لا يحتوي على قائمة المشتركين' };
    }
    return {
      success: true,
      message: 'تم استيراد البيانات بنجاح!',
      subscribers: parsed.subscribers,
      invoices: parsed.invoices || [],
      payments: parsed.payments || [],
    };
  } catch (error) {
    return { success: false, message: 'فشل في قراءة الملف، يرجى التأكد من اختيار ملف صالح.' };
  }
};

export const getNotifications = (): Notification[] => {
  const saved = localStorage.getItem('meter_notifications');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing notifications', e);
    }
  }
  return [
    {
      id: 'default-1',
      senderId: 'user-admin',
      senderName: 'مدير النظام العام',
      senderRole: 'admin',
      receiverId: 'all-users',
      title: 'أهلاً بك في نظام العداد الرئيسي',
      message: 'تم تفعيل نظام الإشعارات المتبادلة. يمكنك الآن إرسال واستلام الإشعارات بين المشغلين والمدراء والمدراء الفرعيين.',
      date: new Date().toISOString(),
      read: false
    }
  ];
};

export const saveNotifications = (notifications: Notification[]) => {
  localStorage.setItem('meter_notifications', JSON.stringify(notifications));
};

export const getInitialActivityLogs = (): ActivityLog[] => {
  const saved = localStorage.getItem('meter_activity_logs');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing activity logs', e);
    }
  }
  return [
    {
      id: 'log-initial',
      userId: 'user-admin',
      userName: 'مدير النظام العام',
      userRole: 'admin',
      action: 'تهيئة النظام',
      details: 'تم بدء تشغيل نظام فواتير الكهرباء وتأسيس قواعد البيانات الافتراضية بنجاح.',
      date: new Date().toISOString(),
    }
  ];
};

export const saveActivityLogs = (logs: ActivityLog[]) => {
  localStorage.setItem('meter_activity_logs', JSON.stringify(logs));
};

export const logSystemActivity = (
  user: User,
  action: string,
  details: string
): ActivityLog[] => {
  const logs = getInitialActivityLogs();
  const newLog: ActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: user.id,
    userName: user.name || user.username,
    userRole: user.role,
    action,
    details,
    date: new Date().toISOString(),
  };
  const updated = [newLog, ...logs].slice(0, 500); // limit to last 500 logs
  saveActivityLogs(updated);
  return updated;
};

// Google Drive API Integration Helpers
export const uploadToGoogleDrive = async (
  accessToken: string,
  fileContent: string,
  fileName: string
): Promise<any> => {
  // 1. Search for existing file with same name
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name='${fileName}' and trashed = false`
  )}`;
  const searchResponse = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let fileId: string | null = null;
  if (searchResponse.ok) {
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
      fileId = searchResult.files[0].id;
    }
  }

  // 2. Perform multipart upload (Create new or Update existing)
  const boundary = 'meter_system_boundary';
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (fileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
    method = 'PATCH';
  }

  const multipartBody = [
    `\r\n--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${JSON.stringify(metadata)}\r\n`,
    `\r\n--${boundary}\r\n`,
    `Content-Type: application/json\r\n\r\n`,
    `${fileContent}\r\n`,
    `\r\n--${boundary}--`,
  ].join('');

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Google Drive Upload Error:', errText);
    throw new Error('فشل الرفع إلى Google Drive. يرجى التحقق من أذونات الاتصال.');
  }

  return await response.json();
};

export const fetchBackupFilesFromGoogleDrive = async (
  accessToken: string
): Promise<any[]> => {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "mimeType='application/json' and name contains 'العداد' and trashed = false"
  )}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Google Drive List Error:', errText);
    throw new Error('فشل جلب ملفات النسخ من Google Drive. قد يكون الرمز منتهي الصلاحية.');
  }

  const result = await response.json();
  return result.files || [];
};

export const downloadFileFromGoogleDrive = async (
  accessToken: string,
  fileId: string
): Promise<string> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('فشل تحميل ملف النسخة الاحتياطية من Google Drive.');
  }

  return await response.text();
};


