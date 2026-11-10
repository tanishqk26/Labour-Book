import { TranslationKey } from './i18n';

export type TxnKind = 'expense' | 'income';
export type TxnStatus = 'paid' | 'partial' | 'credit' | 'price_pending';

export interface Txn {
  id: string;
  kind: TxnKind;
  txn_date: string;
  category: string;
  plot_id: string | null;
  plot_name: string | null;
  operation_id: string | null;
  party: string | null;
  amount: number | null;
  amount_paid: number;
  balance: number | null;
  status: TxnStatus;
  description: string | null;
}

export const EXPENSE_CATS = ['medicine', 'fertiliser', 'labour', 'fuel', 'machinery', 'electricity', 'transport', 'other'] as const;
export const INCOME_CATS = ['sale', 'other'] as const;

export const CAT_ICON: Record<TxnKind, Record<string, string>> = {
  expense: {
    medicine: 'spray-bottle', fertiliser: 'sack', labour: 'account-hard-hat-outline', fuel: 'gas-station-outline',
    machinery: 'tractor', electricity: 'flash-outline', transport: 'truck-outline', other: 'dots-horizontal-circle-outline',
  },
  income: { sale: 'fruit-grapes', other: 'cash-plus' },
};

export function catLabelKey(kind: TxnKind, cat: string): TranslationKey {
  if (kind === 'income') return (cat === 'sale' ? 'exp_cat_sale' : 'exp_cat_other_income') as TranslationKey;
  return `exp_cat_${cat}` as TranslationKey;
}

/** Farm year starts on 1 April and is named after the year it starts in. */
export function currentFarmYear(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
export function farmYearLabel(y: number): string {
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
}
