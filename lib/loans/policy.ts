export type SupportedLoanType = 'unsecured' | 'mortgage';
export type SupportedLoanPurpose = 'installment' | 'overdraft' | 'credit_card';

export const MIN_LOAN_AMOUNT_BY_TYPE: Record<SupportedLoanType, number> = {
  unsecured: 10_000_000,
  mortgage: 50_000_000,
};

/**
 * Normalize loan type to supported product set.
 * Legacy values are mapped for backward compatibility.
 */
export function normalizeLoanTypePolicy(value: unknown): SupportedLoanType | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'unsecured' || normalized === 'mortgage') return normalized;
  if (normalized === 'secured') return 'mortgage';
  if (normalized === 'business') return 'unsecured';
  if (normalized.includes('tài sản')) return 'mortgage';
  if (normalized.includes('tín chấp')) return 'unsecured';
  if (normalized.includes('thế chấp')) return 'mortgage';
  if (normalized.includes('kinh doanh')) return 'unsecured';
  return '';
}

export function minimumLoanAmountByType(value: unknown): number | null {
  const type = normalizeLoanTypePolicy(value);
  if (!type) return null;
  return MIN_LOAN_AMOUNT_BY_TYPE[type];
}

export const INTEREST_RATE_RANGE_BY_PURPOSE: Record<
  SupportedLoanPurpose,
  { minAnnualRate: number; maxAnnualRate: number }
> = {
  installment: { minAnnualRate: 8, maxAnnualRate: 24 },
  overdraft: { minAnnualRate: 12, maxAnnualRate: 30 },
  credit_card: { minAnnualRate: 20, maxAnnualRate: 40 },
};

export function normalizeLoanPurposePolicy(value: unknown): SupportedLoanPurpose | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (
    normalized === 'installment' ||
    normalized === 'overdraft' ||
    normalized === 'credit_card'
  ) {
    return normalized;
  }
  if (normalized.includes('trả góp') || normalized.includes('installment')) return 'installment';
  if (normalized.includes('thấu chi') || normalized.includes('overdraft')) return 'overdraft';
  if (normalized.includes('thẻ') || normalized.includes('credit')) return 'credit_card';
  return '';
}

export function interestRateRangeByPurpose(value: unknown): { minAnnualRate: number; maxAnnualRate: number } | null {
  const purpose = normalizeLoanPurposePolicy(value);
  if (!purpose) return null;
  return INTEREST_RATE_RANGE_BY_PURPOSE[purpose];
}

