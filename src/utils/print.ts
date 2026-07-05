/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subscriber, Invoice, Payment, BillCustomization } from '../types';
import { calculateSubscriberStats, getSubscriberLedger } from './storage';
import { getActiveCurrency } from './currency';

export const printSubscriberStatement = (
  subscriber: Subscriber,
  invoices: Invoice[],
  payments: Payment[],
  settings?: BillCustomization
) => {
  const stats = calculateSubscriberStats(subscriber, invoices, payments);
  const ledger = getSubscriberLedger(subscriber, invoices, payments);
  const defaultCurrency = getActiveCurrency();

  // Create printable iframe
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

  const title = `كشف حساب - ${subscriber.name}`;
  const formattedDate = new Date().toLocaleString('en-US', {
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const ledgerRows = ledger.map((entry) => {
    const isInvoice = entry.type === 'invoice';
    const amountClass = isInvoice ? 'amount-debit' : 'amount-credit';
    const typeLabel = isInvoice ? 'فاتورة استهلاك (+)' : 'سداد دفعة (-)';
    const dateFormatted = new Date(entry.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    return `
      <tr>
        <td style="font-weight: 600;">${dateFormatted}</td>
        <td><span class="badge ${isInvoice ? 'badge-debit' : 'badge-credit'}">${typeLabel}</span></td>
        <td>${entry.description}</td>
        <td class="${amountClass}" style="text-align: left; font-size: 14px;">
          ${isInvoice ? '+' : '-'} ${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${defaultCurrency}
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        
        @media print {
          body {
            margin: 20px;
            color: #1e293b;
            background: #fff;
          }
          .no-print {
            display: none !important;
          }
        }

        body {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          direction: rtl;
          text-align: right;
          color: #1e293b;
          margin: 40px;
          line-height: 1.6;
          background-color: #fff;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-b: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .logo-section h1 {
          font-size: 24px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
        }

        .logo-section p {
          font-size: 13px;
          color: #4b5563;
          margin: 5px 0 0 0;
          font-weight: 600;
        }

        .meta-info {
          text-align: left;
          font-size: 12px;
          color: #64748b;
        }

        .meta-info p {
          margin: 3px 0;
        }

        .report-title {
          text-align: center;
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 20px 0 30px 0;
          background: #f1f5f9;
          padding: 10px;
          border-radius: 8px;
        }

        .subscriber-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
        }

        .subscriber-info h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #1e3a8a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 5px;
        }

        .info-item {
          font-size: 13px;
          margin: 5px 0;
          color: #334155;
        }

        .info-label {
          font-weight: 700;
          color: #475569;
          display: inline-block;
          width: 100px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 15px;
          text-align: center;
        }

        .stat-card.debt { border-color: #fee2e2; background-color: #fef2f2; }
        .stat-card.paid { border-color: #d1fae5; background-color: #ecfdf5; }
        .stat-card.remaining { border-color: #dbeafe; background-color: #eff6ff; }
        
        .stat-label {
          font-size: 11px;
          color: #64748b;
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 800;
        }

        .stat-card.debt .stat-value { color: #dc2626; }
        .stat-card.paid .stat-value { color: #16a34a; }
        .stat-card.remaining .stat-value { color: #2563eb; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }

        th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          font-size: 13px;
          padding: 12px 15px;
          border-bottom: 2px solid #cbd5e1;
          text-align: right;
        }

        td {
          padding: 12px 15px;
          font-size: 13px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }

        tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .badge {
          display: inline-block;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 9999px;
        }

        .badge-debit {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .badge-credit {
          background-color: #d1fae5;
          color: #065f46;
        }

        .amount-debit {
          color: #dc2626;
          font-weight: 700;
        }

        .amount-credit {
          color: #16a34a;
          font-weight: 700;
        }

        .footer {
          text-align: center;
          margin-top: 60px;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px dashed #e2e8f0;
          padding-top: 20px;
        }

        .stamp-area {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding: 0 20px;
        }

        .stamp-box {
          text-align: center;
          width: 150px;
        }

        .stamp-line {
          margin-top: 40px;
          border-top: 1px solid #94a3b8;
          font-size: 12px;
          color: #475569;
          padding-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${settings?.logo ? `<img src="${settings.logo}" style="max-height: 55px; max-width: 160px; object-fit: contain; margin-bottom: 8px; display: block;" />` : ''}
          <h1>${settings?.title || 'حسابات العداد المشترك'}</h1>
          <p>${settings?.subtitle || 'نظام إدارة وتوزيع تكلفة العداد الرئيسي للكهرباء'}</p>
        </div>
        <div class="meta-info">
          <p><strong>تاريخ الطباعة:</strong> ${formattedDate}</p>
          <p><strong>حالة التقرير:</strong> كشف حساب مالي تفصيلي</p>
          ${settings?.contactDetails ? `<p><strong>تفاصيل الاتصال:</strong> ${settings.contactDetails}</p>` : ''}
        </div>
      </div>

      <div class="report-title">كشف حساب مستحقات المشترك التفصيلي</div>

      <div class="subscriber-info">
        <div>
          <h3>بيانات المشترك</h3>
          <div class="info-item"><span class="info-label">اسم المشترك:</span> <strong>${subscriber.name}</strong></div>
          <div class="info-item"><span class="info-label">رقم الهاتف:</span> <span dir="ltr">${subscriber.phone || 'غير مسجل'}</span></div>
        </div>
        <div>
          <h3>بيانات التسجيل</h3>
          <div class="info-item"><span class="info-label">تاريخ التسجيل:</span> ${new Date(subscriber.createdAt).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}</div>
          <div class="info-item"><span class="info-label">مُعرّف المشترك:</span> <code style="font-size: 11px; color:#64748b;">${subscriber.id}</code></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card debt">
          <span class="stat-label">إجمالي الديون (الحصص)</span>
          <span class="stat-value">${stats.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${defaultCurrency}</span>
        </div>
        <div class="stat-card paid">
          <span class="stat-label">إجمالي الدفعات (المسدد)</span>
          <span class="stat-value">${stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${defaultCurrency}</span>
        </div>
        <div class="stat-card remaining">
          <span class="stat-label">الرصيد المتبقي (المستحق حالياً)</span>
          <span class="stat-value">${stats.remainingDebt > 0 ? stats.remainingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ' + defaultCurrency : 'مُسدد بالكامل'}</span>
        </div>
      </div>

      <h3 style="font-size: 15px; color: #1e3a8a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px;">جدول تفاصيل العمليات المالية</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">التاريخ</th>
            <th style="width: 20%;">نوع العملية</th>
            <th style="width: 45%;">البيان / تفاصيل الاستهلاك</th>
            <th style="width: 20%; text-align: left;">القيمة المالية</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRows}
        </tbody>
      </table>

      <div class="stamp-area">
        <div class="stamp-box">
          <div class="stamp-line">توقيع المسؤول</div>
        </div>
        <div class="stamp-box">
          <div class="stamp-line">توقيع المشترك</div>
        </div>
      </div>

      <div class="footer">
        ${settings?.footerText || 'تم استخراج هذا الكشف تلقائياً عبر تطبيق حسابات العداد الرئيسي المشترك للكهرباء.'}
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

  // Clean up iframe after print dialog completes
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 10000); // 10 seconds is usually enough for printing dialog initialization
};

export const printSingleInvoice = (
  invoice: Invoice,
  subscribers: Subscriber[],
  settings?: BillCustomization
) => {
  const defaultCurrency = getActiveCurrency();

  // Create printable iframe
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

  const invoiceNumber = invoice.id.substring(0, 8).toUpperCase();
  const title = `فاتورة كهرباء - ${invoiceNumber}`;
  
  const formattedDate = new Date(invoice.date).toLocaleString('en-US', {
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const printDate = new Date().toLocaleString('en-US', {
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get names of subscribers covered by this invoice
  const coveredSubs = invoice.subscriberIds.map(id => {
    const s = subscribers.find(sub => sub.id === id);
    return s ? `رقم #${s.subNumber} - ${s.name}` : 'مشترك محذوف';
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        
        @page {
          size: A4;
          margin: 15mm;
        }

        @media print {
          body {
            margin: 0;
            color: #0f172a;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .invoice-card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
        }

        body {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          direction: rtl;
          text-align: right;
          color: #1e293b;
          margin: 0;
          padding: 10px;
          line-height: 1.5;
          background-color: #fff;
        }

        .invoice-card {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px double #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }

        .logo-section h1 {
          font-size: 26px;
          font-weight: 800;
          color: #1d4ed8;
          margin: 0 0 5px 0;
        }

        .logo-section p {
          font-size: 13px;
          color: #475569;
          margin: 0;
          font-weight: 600;
        }

        .meta-info {
          text-align: left;
          font-size: 13px;
          color: #334155;
        }

        .meta-info p {
          margin: 4px 0;
        }

        .meta-value {
          font-weight: 700;
          color: #0f172a;
        }

        .badge-type {
          display: inline-block;
          background-color: #dbeafe;
          color: #1e40af;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 800;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          margin-top: 5px;
        }

        .badge-composite {
          background-color: #f3e8ff;
          color: #6b21a8;
          border-color: #e9d5ff;
        }

        .section-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 25px 0 12px 0;
          border-right: 4px solid #3b82f6;
          padding-right: 10px;
          background: #f8fafc;
          padding-top: 4px;
          padding-bottom: 4px;
        }

        /* Meter readings block */
        .readings-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .reading-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }

        .reading-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          display: block;
          margin-bottom: 4px;
        }

        .reading-value {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        /* Main meter block for composite */
        .main-meter-details {
          background-color: #f5f3ff;
          border: 1px solid #ddd6fe;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }

        /* Cost breakdown list */
        .cost-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }

        .cost-card {
          border-radius: 10px;
          padding: 15px;
          text-align: right;
          border: 1px solid #e2e8f0;
        }

        .cost-card.total {
          background-color: #eff6ff;
          border-color: #bfdbfe;
        }

        .cost-card.share {
          background-color: #ecfdf5;
          border-color: #a7f3d0;
        }

        .cost-label {
          font-size: 12px;
          color: #475569;
          font-weight: 700;
          display: block;
          margin-bottom: 5px;
        }

        .cost-value {
          font-size: 22px;
          font-weight: 800;
        }

        .cost-card.total .cost-value {
          color: #1d4ed8;
        }

        .cost-card.share .cost-value {
          color: #047857;
        }

        /* Tables and details */
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .details-table th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          font-size: 12px;
          padding: 10px;
          border-bottom: 2px solid #cbd5e1;
          text-align: right;
        }

        .details-table td {
          padding: 10px;
          font-size: 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }

        .covered-subs-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .covered-sub-badge {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .notes-box {
          border: 1px solid #e2e8f0;
          background: #fafaf9;
          padding: 12px;
          border-radius: 8px;
          font-size: 12px;
          color: #44403c;
          margin-top: 15px;
          white-space: pre-line;
        }

        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding: 0 10px;
        }

        .sig-box {
          text-align: center;
          width: 180px;
        }

        .sig-line {
          margin-top: 45px;
          border-top: 1.5px solid #64748b;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          padding-top: 6px;
        }

        .footer {
          text-align: center;
          margin-top: 50px;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px dashed #e2e8f0;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <div class="logo-section">
            ${settings?.logo ? `<img src="${settings.logo}" style="max-height: 55px; max-width: 160px; object-fit: contain; margin-bottom: 8px; display: block;" />` : ''}
            <h1>${settings?.title || 'فاتورة احتساب الكهرباء'}</h1>
            <p>${settings?.subtitle || 'نظام إدارة وتوزيع تكلفة العداد الرئيسي للكهرباء'}</p>
          </div>
          <div class="meta-info">
            <p>رقم الفاتورة: <span class="meta-value" style="font-family: monospace; font-size: 14px;">${invoiceNumber}</span></p>
            <p>تاريخ الإصدار: <span class="meta-value">${formattedDate}</span></p>
            <p>تاريخ الطباعة: <span class="meta-value">${printDate}</span></p>
            ${settings?.contactDetails ? `<p>تواصل ومتابعة: <span class="meta-value">${settings.contactDetails}</span></p>` : ''}
            <div>
              <span class="badge-type ${invoice.isComposite ? 'badge-composite' : ''}">
                ${invoice.isComposite ? 'فاتورة فرعية (مركبة)' : 'فاتورة مشتركة'}
              </span>
            </div>
          </div>
        </div>

        ${invoice.isComposite ? `
          <div class="section-title">بيانات العداد الرئيسي الكهربائي للتحقق</div>
          <div class="main-meter-details">
            <table class="details-table" style="margin-top:0;">
              <thead>
                <tr>
                  <th>القراءة السابقة (الرئيسي)</th>
                  <th>القراءة الحالية (الرئيسي)</th>
                  <th>الاستهلاك الكلي (الرئيسي)</th>
                  <th>التكلفة الكلية (الرئيسي)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:700;">${invoice.mainMeterPrev ?? '-'} ك.و</td>
                  <td style="font-weight:700;">${invoice.mainMeterCurr ?? '-'} ك.و</td>
                  <td style="font-weight:800; color:#1d4ed8;">${(invoice.mainMeterConsumption ?? 0).toLocaleString('en-US')} ك.و</td>
                  <td style="font-weight:800; color:#1d4ed8;">${(invoice.mainMeterTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${defaultCurrency}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="section-title">تفاصيل القراءة والاحتساب للعداد</div>
        <div class="readings-grid">
          <div class="reading-box">
            <span class="reading-label">القراءة السابقة</span>
            <span class="reading-value">${invoice.prevReading.toLocaleString('en-US')} ك.و</span>
          </div>
          <div class="reading-box">
            <span class="reading-label">القراءة الحالية</span>
            <span class="reading-value">${invoice.currReading.toLocaleString('en-US')} ك.و</span>
          </div>
          <div class="reading-box" style="background-color: #eff6ff; border-color: #bfdbfe;">
            <span class="reading-label" style="color: #1e40af;">الاستهلاك الصافي</span>
            <span class="reading-value" style="color: #1d4ed8;">${invoice.consumption.toLocaleString('en-US')} ك.و</span>
          </div>
          <div class="reading-box">
            <span class="reading-label">سعر الكيلوواط</span>
            <span class="reading-value">${invoice.pricePerKwh.toLocaleString('en-US')} ${defaultCurrency}</span>
          </div>
        </div>

        <div class="cost-summary">
          <div class="cost-card total">
            <span class="cost-label">
              ${invoice.isComposite ? 'قيمة استهلاك العداد الفرعي' : 'المبلغ الإجمالي الكلي للفاتورة'}
            </span>
            <span class="cost-value">
              ${invoice.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${defaultCurrency}
            </span>
          </div>
          <div class="cost-card share">
            <span class="cost-label">
              ${invoice.isComposite ? 'المبلغ المستحق والمقيد كدين' : 'نصيب الفرد المترتب كدين'}
            </span>
            <span class="cost-value">
              ${invoice.sharePerSubscriber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${defaultCurrency}
            </span>
          </div>
        </div>

        <div class="section-title">المشتركون المشمولون والمطالبون بالفاتورة</div>
        <div class="covered-subs-list">
          ${coveredSubs.map(name => `<div class="covered-sub-badge">${name}</div>`).join('')}
        </div>

        ${invoice.notes ? `
          <div class="section-title">ملاحظات إضافية</div>
          <div class="notes-box">${invoice.notes}</div>
        ` : ''}

        ${settings?.paymentTerms ? `
          <div class="section-title">شروط الدفع والتحصيل</div>
          <div class="notes-box" style="background-color: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: bold;">${settings.paymentTerms}</div>
        ` : ''}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">توقيع المسؤول / المحاسب</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">الختم الرسمي</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">توقيع المستلم / المشترك</div>
          </div>
        </div>

        <div class="footer">
          ${settings?.footerText || 'صدرت هذه الفاتورة كوثيقة مالية رسمية ومؤرشفة إلكترونياً. تم الاحتساب وتوزيع الاستهلاك تلقائياً بالكامل.'}
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

  // Clean up iframe after print dialog completes
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 10000);
};
