/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { Subscriber, Invoice, Payment, User, Notification, ActivityLog } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId) 
  : getFirestore(app);

/**
 * Checks if Firebase service is fully configured and reachable
 */
export const isFirebaseAvailable = (): boolean => {
  return !!firebaseConfig.projectId && !!firebaseConfig.apiKey;
};

/**
 * Bulk Upload Local Data to Firebase Firestore
 */
export const uploadAllDataToFirebase = async (
  subscribers: Subscriber[],
  invoices: Invoice[],
  payments: Payment[],
  users: User[],
  notifications: Notification[],
  activityLogs: ActivityLog[],
  groups: string[]
): Promise<{ success: boolean; message: string }> => {
  if (!isFirebaseAvailable()) {
    return { success: false, message: 'مكونات فايربيس غير مهيأة بعد.' };
  }

  try {
    // 1. Save subscribers
    for (const sub of subscribers) {
      await setDoc(doc(db, 'subscribers', sub.id), sub);
    }

    // 2. Save invoices
    for (const inv of invoices) {
      await setDoc(doc(db, 'invoices', inv.id), inv);
    }

    // 3. Save payments
    for (const pay of payments) {
      await setDoc(doc(db, 'payments', pay.id), pay);
    }

    // 4. Save users
    for (const user of users) {
      await setDoc(doc(db, 'users', user.id), user);
    }

    // 5. Save notifications
    for (const notif of notifications) {
      await setDoc(doc(db, 'notifications', notif.id), notif);
    }

    // 6. Save activity logs
    for (const log of activityLogs) {
      await setDoc(doc(db, 'activity_logs', log.id), log);
    }

    // 7. Save general meta (like groups list)
    await setDoc(doc(db, 'system_meta', 'groups'), { list: groups });

    return { 
      success: true, 
      message: 'تم رفع ومزامنة كافة البيانات المحلية إلى السحابة بنجاح!' 
    };
  } catch (error: any) {
    console.error('Firebase upload error:', error);
    return { 
      success: false, 
      message: `فشل الرفع السحابي: ${error.message || error}` 
    };
  }
};

/**
 * Bulk Download Data from Firebase Firestore
 */
export interface FirebaseDownloadedData {
  subscribers: Subscriber[];
  invoices: Invoice[];
  payments: Payment[];
  users: User[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  groups: string[];
}

export const downloadAllDataFromFirebase = async (): Promise<{
  success: boolean;
  message: string;
  data?: FirebaseDownloadedData;
}> => {
  if (!isFirebaseAvailable()) {
    return { success: false, message: 'مكونات فايربيس غير مهيأة بعد.' };
  }

  try {
    // 1. Fetch subscribers
    const subSnap = await getDocs(collection(db, 'subscribers'));
    const subscribers: Subscriber[] = [];
    subSnap.forEach((docSnap) => {
      subscribers.push(docSnap.data() as Subscriber);
    });

    // 2. Fetch invoices
    const invSnap = await getDocs(collection(db, 'invoices'));
    const invoices: Invoice[] = [];
    invSnap.forEach((docSnap) => {
      invoices.push(docSnap.data() as Invoice);
    });

    // 3. Fetch payments
    const paySnap = await getDocs(collection(db, 'payments'));
    const payments: Payment[] = [];
    paySnap.forEach((docSnap) => {
      payments.push(docSnap.data() as Payment);
    });

    // 4. Fetch users
    const userSnap = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    userSnap.forEach((docSnap) => {
      users.push(docSnap.data() as User);
    });

    // 5. Fetch notifications
    const notifSnap = await getDocs(collection(db, 'notifications'));
    const notifications: Notification[] = [];
    notifSnap.forEach((docSnap) => {
      notifications.push(docSnap.data() as Notification);
    });

    // 6. Fetch activity logs
    const logSnap = await getDocs(collection(db, 'activity_logs'));
    const activityLogs: ActivityLog[] = [];
    logSnap.forEach((docSnap) => {
      activityLogs.push(docSnap.data() as ActivityLog);
    });

    // 7. Fetch groups list
    const metaSnap = await getDocs(collection(db, 'system_meta'));
    let groups: string[] = [];
    metaSnap.forEach((docSnap) => {
      if (docSnap.id === 'groups') {
        groups = docSnap.data().list || [];
      }
    });

    return {
      success: true,
      message: 'تم تنزيل البيانات ومزامنتها من السحابة بنجاح!',
      data: {
        subscribers,
        invoices,
        payments,
        users,
        notifications,
        activityLogs,
        groups
      }
    };
  } catch (error: any) {
    console.error('Firebase download error:', error);
    return { 
      success: false, 
      message: `فشل التنزيل السحابي: ${error.message || error}` 
    };
  }
};

/**
 * Individual Entity Save Handlers for Real-time auto sync
 */
export const syncSubscriberToFirestore = async (subscriber: Subscriber): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'subscribers', subscriber.id), subscriber);
  } catch (err) {
    console.error('Firestore saveSubscriber error:', err);
  }
};

export const deleteSubscriberFromFirestore = async (id: string): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await deleteDoc(doc(db, 'subscribers', id));
  } catch (err) {
    console.error('Firestore deleteSubscriber error:', err);
  }
};

export const syncInvoiceToFirestore = async (invoice: Invoice): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'invoices', invoice.id), invoice);
  } catch (err) {
    console.error('Firestore saveInvoice error:', err);
  }
};

export const deleteInvoiceFromFirestore = async (id: string): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await deleteDoc(doc(db, 'invoices', id));
  } catch (err) {
    console.error('Firestore deleteInvoice error:', err);
  }
};

export const syncPaymentToFirestore = async (payment: Payment): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'payments', payment.id), payment);
  } catch (err) {
    console.error('Firestore savePayment error:', err);
  }
};

export const deletePaymentFromFirestore = async (id: string): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await deleteDoc(doc(db, 'payments', id));
  } catch (err) {
    console.error('Firestore deletePayment error:', err);
  }
};

export const syncUserToFirestore = async (user: User): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (err) {
    console.error('Firestore saveUser error:', err);
  }
};

export const deleteUserFromFirestore = async (id: string): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await deleteDoc(doc(db, 'users', id));
  } catch (err) {
    console.error('Firestore deleteUser error:', err);
  }
};

export const syncNotificationToFirestore = async (notif: Notification): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
  } catch (err) {
    console.error('Firestore saveNotification error:', err);
  }
};

export const syncActivityLogToFirestore = async (log: ActivityLog): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'activity_logs', log.id), log);
  } catch (err) {
    console.error('Firestore saveActivityLog error:', err);
  }
};

export const syncGroupsToFirestore = async (groups: string[]): Promise<void> => {
  if (!isFirebaseAvailable()) return;
  try {
    await setDoc(doc(db, 'system_meta', 'groups'), { list: groups });
  } catch (err) {
    console.error('Firestore saveGroups error:', err);
  }
};
