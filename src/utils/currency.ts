/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const getActiveCurrency = (): string => {
  return localStorage.getItem('meter_default_currency') || 'ش.ج';
};

export const getActivePricePerKwh = (): string => {
  return localStorage.getItem('meter_default_price_per_kwh') || '0.5';
};

export const getActiveCurrencies = (): string[] => {
  const saved = localStorage.getItem('meter_currencies_list');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {}
  }
  return ['ش.ج', 'ر.س', 'دولار'];
};

export const formatCurrency = (
  amount: number,
  options?: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string => {
  const currency = options?.currency || getActiveCurrency();
  const minDigits = options?.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 1;
  const maxDigits = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;

  const formatted = (amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
  return `${formatted} ${currency}`;
};
