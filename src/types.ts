/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Subscriber {
  id: string;
  subNumber: number; // الرقم التلقائي للمشترك
  name: string;
  createdAt: string;
  phone?: string; // رقم الجوال
  whatsapp?: string; // رقم الواتس
  openingBalance: number; // القيد الافتتاحي (دين ابتدائي)
  groups: string[]; // المجموعات التي ينتمي إليها المشترك
}

export interface Invoice {
  id: string;
  date: string;
  prevReading: number;
  currReading: number;
  consumption: number; // currReading - prevReading
  pricePerKwh: number;
  totalCost: number;
  subscriberIds: string[]; // List of subscriber IDs sharing this bill
  sharePerSubscriber: number;
  notes?: string;
  isComposite?: boolean;
  mainMeterPrev?: number;
  mainMeterCurr?: number;
  mainMeterConsumption?: number;
  mainMeterPrice?: number;
  mainMeterTotal?: number;
  invoiceDay?: string;
  isExpense?: boolean;
  expenseType?: string;
}

export interface Payment {
  id: string;
  subscriberId: string;
  subscriberName: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface SubscriberLedgerEntry {
  id: string;
  type: 'invoice' | 'payment';
  date: string;
  amount: number;
  description: string;
  referenceId: string; // invoiceId or paymentId
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface BillCustomization {
  logo?: string; // Base64 data URL
  title?: string; // Custom company or system name
  subtitle?: string; // Custom subtitle or description
  paymentTerms?: string; // Custom payment terms/conditions
  contactDetails?: string; // Custom contact details (phone, email, address)
  footerText?: string; // Custom footer text
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  name: string;
  assignedSubscriberIds?: string[];
  billSettings?: BillCustomization;
}

export interface Notification {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  receiverId: string; // 'all-admins', 'all-users', or specific user id
  title: string;
  message: string;
  date: string;
  read: boolean;
  readAt?: string;
  communicationMethod?: 'internet' | 'hotspot' | 'wifidirect';
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: string;
  audioDuration?: number;
  readStatus?: Record<string, boolean>; // for multi-admin reads
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  date: string;
}



