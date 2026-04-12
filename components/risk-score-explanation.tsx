'use client';

import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n/dictionaries';
import { formatVndDigits } from '@/lib/money';
import { cn } from '@/lib/utils';

export type ExplanationDetail = {
  income: number;
  debt: number;
  age: number;
  credit_history_months: number;
  credit_score: number;
  loan_type_code: string;
  loan_type_display: string | null;
  interest_rate: number;
  loan_term: number;
  collateral_value: number | null;
  employment_display: string | null;
  dti: number;
  dti_factor: number;
  age_factor: number;
  history_factor: number;
  credit_score_factor: number;
  loan_type_factor: number;
  interest_factor: number;
  term_factor: number;
  collateral_ratio: number;
  collateral_factor: number;
  employment_factor: number;
  contributions: Array<{ key: string; weight: number; factor: number; contrib: number }>;
  raw_risk: number;
  risk_score: number;
  label: string;
  cic_score: number;
  cic_group: string;
  cic_rating: string;
  clamped: boolean;
};

function fmtMoney(n: number) {
  return formatVndDigits(Math.round(n));
}

function Fraction({ num, den, compact }: { num: ReactNode; den: ReactNode; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center align-middle mx-0.5 rounded px-0.5 font-medium text-foreground',
        compact ? 'text-[11px]' : 'text-xs',
      )}
    >
      <span className="leading-tight tabular-nums">{num}</span>
      <span className="h-px w-full min-w-[1.25rem] bg-foreground/55" />
      <span className="leading-tight tabular-nums">{den}</span>
    </span>
  );
}

const FACTOR_TITLE: Record<string, { vi: string; en: string }> = {
  dti: { vi: 'DTI (dư nợ / thu nhập tháng)', en: 'DTI (debt / monthly income)' },
  age: { vi: 'Tuổi', en: 'Age' },
  history: { vi: 'Lịch sử tín dụng (tháng)', en: 'Credit history (months)' },
  credit_score: { vi: 'Điểm tín dụng nội bộ', en: 'Internal credit score' },
  loan_type: { vi: 'Loại vay', en: 'Loan type' },
  interest: { vi: 'Lãi suất (%/năm)', en: 'Interest rate (% p.a.)' },
  term: { vi: 'Kỳ hạn vay (tháng)', en: 'Loan term (months)' },
  collateral: { vi: 'Tài sản bảo đảm', en: 'Collateral' },
  employment: { vi: 'Việc làm', en: 'Employment' },
};

export function riskExplanationFrameClass(level: string) {
  return cn(
    'overflow-hidden rounded-xl border-2 bg-background/90 shadow-sm',
    level === 'low' && 'border-emerald-600',
    level === 'medium' && 'border-amber-500',
    level === 'high' && 'border-rose-600',
    !['low', 'medium', 'high'].includes(level) && 'border-border',
  );
}

export function riskBadgeOutlineClass(level: string) {
  return cn(
    'text-base px-4 py-2 font-semibold shadow-none',
    level === 'low' &&
      'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/30 dark:text-emerald-50',
    level === 'medium' &&
      'border-2 border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400/65 dark:bg-amber-500/30 dark:text-amber-50',
    level === 'high' &&
      'border-2 border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-400/60 dark:bg-rose-500/32 dark:text-rose-50',
    !['low', 'medium', 'high'].includes(level) &&
      'border-2 border-muted-foreground bg-background text-foreground dark:bg-zinc-600/35 dark:text-zinc-50',
  );
}

export function parseExplanationDetail(raw: unknown): ExplanationDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const contributions = Array.isArray(o.contributions) ? o.contributions : [];
  if (typeof o.income !== 'number' || typeof o.debt !== 'number' || typeof o.risk_score !== 'number') return null;
  return {
    income: o.income,
    debt: o.debt,
    age: Number(o.age ?? 0),
    credit_history_months: Number(o.credit_history_months ?? 0),
    credit_score: Number(o.credit_score ?? 0),
    loan_type_code: String(o.loan_type_code ?? ''),
    loan_type_display: o.loan_type_display != null ? String(o.loan_type_display) : null,
    interest_rate: Number(o.interest_rate ?? 0),
    loan_term: Number(o.loan_term ?? 0),
    collateral_value: o.collateral_value != null ? Number(o.collateral_value) : null,
    employment_display: o.employment_display != null ? String(o.employment_display) : null,
    dti: Number(o.dti ?? 0),
    dti_factor: Number(o.dti_factor ?? 0),
    age_factor: Number(o.age_factor ?? 0),
    history_factor: Number(o.history_factor ?? 0),
    credit_score_factor: Number(o.credit_score_factor ?? 0),
    loan_type_factor: Number(o.loan_type_factor ?? 0),
    interest_factor: Number(o.interest_factor ?? 0),
    term_factor: Number(o.term_factor ?? 0),
    collateral_ratio: Number(o.collateral_ratio ?? 0),
    collateral_factor: Number(o.collateral_factor ?? 0),
    employment_factor: Number(o.employment_factor ?? 0),
    contributions: contributions.map((c: any) => ({
      key: String(c.key),
      weight: Number(c.weight),
      factor: Number(c.factor),
      contrib: Number(c.contrib),
    })),
    raw_risk: Number(o.raw_risk ?? 0),
    risk_score: Number(o.risk_score ?? 0),
    label: String(o.label ?? 'medium'),
    cic_score: Number(o.cic_score ?? 0),
    cic_group: String(o.cic_group ?? ''),
    cic_rating: String(o.cic_rating ?? ''),
    clamped: Boolean(o.clamped),
  };
}

type TFn = (key: string) => string;

export function RiskScoreExplanationPanel(props: {
  d: ExplanationDetail;
  locale: Locale;
  t: TFn;
  riskLevelLabel: string;
  riskLevel: string;
}) {
  const { d, locale, t, riskLevelLabel, riskLevel } = props;

  const L = locale === 'vi' ? 'vi' : 'en';
  const ft = (key: string) => FACTOR_TITLE[key]?.[L] ?? key;

  const loanShow = d.loan_type_display || d.loan_type_code || (L === 'vi' ? '—' : '—');
  const empShow = d.employment_display || (L === 'vi' ? '—' : '—');

  const collNote =
    d.collateral_value != null && d.collateral_value > 0
      ? L === 'vi'
        ? `Tỷ lệ nợ / TSBD = ${d.collateral_ratio.toFixed(4)}.`
        : `Debt / collateral = ${d.collateral_ratio.toFixed(4)}.`
      : L === 'vi'
        ? 'Không có TSBD → dùng hệ số mặc định 0,8.'
        : 'No collateral → default factor 0.8.';

  return (
    <div className={cn('mx-auto w-full max-w-full', riskExplanationFrameClass(riskLevel))}>
      <div className="max-h-[min(75vh,640px)] space-y-5 overflow-y-auto overscroll-y-contain p-4 text-sm">
      <div>
        <p className="text-base leading-relaxed">
          <span className="font-semibold text-foreground">{t('risk.score.explain.intro')}</span>{' '}
          <span className="font-bold text-foreground">R ∈ [0, 1]</span>
          {t('risk.score.explain.intro_tail')}
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-foreground mb-2">{t('risk.score.explain.factors')}</p>
        <ul className="list-disc space-y-4 pl-5 marker:text-primary">
          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('dti')}</span>
            <ul className="mt-1.5 list-none space-y-1.5 pl-0 text-[13px] text-muted-foreground">
              <li className="flex flex-wrap items-center gap-x-1">
                <span className="font-medium text-foreground/90">DTI</span>
                <Fraction num={fmtMoney(d.debt)} den={fmtMoney(d.income)} />
                <span>
                  {t('risk.score.explain.equals')} {d.dti.toFixed(4)}
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-x-1">
                <span className="font-medium text-foreground/90">
                  f<sub>DTI</sub>
                </span>
                <Fraction num={<span className="tabular-nums">min(DTI, 4)</span>} den="4" compact />
                <span>
                  {t('risk.score.explain.equals')} {d.dti_factor.toFixed(4)}
                </span>
              </li>
            </ul>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('age')}</span>
            <ul className="mt-1.5 list-none space-y-1 pl-0 text-[13px] text-muted-foreground">
              <li className="flex flex-wrap items-center gap-x-1">
                <span>
                  {L === 'vi' ? 'Tuổi' : 'Age'} = {d.age};{' '}
                  <Fraction
                    num={<span className="tabular-nums">age − 18</span>}
                    den={<span className="tabular-nums">70 − 18</span>}
                    compact
                  />
                </span>
              </li>
              <li>
                f<sub>age</sub> = 1 − clip(·) = <span className="font-medium text-foreground">{d.age_factor.toFixed(4)}</span>
              </li>
            </ul>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('history')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              f<sub>hist</sub> = 1 − min({d.credit_history_months}/120, 1) ={' '}
              <span className="font-medium text-foreground">{d.history_factor.toFixed(4)}</span>
            </p>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('credit_score')}</span>
            <ul className="mt-1.5 list-none space-y-1 pl-0 text-[13px] text-muted-foreground">
              <li className="flex flex-wrap items-center gap-x-1">
                <span>score = {d.credit_score};</span>
                <Fraction num={<span className="tabular-nums">score − 300</span>} den={<span className="tabular-nums">900 − 300</span>} compact />
              </li>
              <li>
                f<sub>cs</sub> = 1 − clip(·) = <span className="font-medium text-foreground">{d.credit_score_factor.toFixed(4)}</span>
              </li>
            </ul>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('loan_type')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{loanShow}</span> → f ={' '}
              <span className="font-medium text-foreground">{d.loan_type_factor.toFixed(2)}</span>
            </p>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('interest')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              <Fraction num={<span className="tabular-nums">{d.interest_rate.toFixed(2)}%</span>} den="24" compact /> → f
              <sub>ir</sub> = <span className="font-medium text-foreground">{d.interest_factor.toFixed(4)}</span>
            </p>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('term')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              term = {d.loan_term.toFixed(0)} {L === 'vi' ? 'tháng' : 'mo.'}; f
              <sub>term</sub> = min(term/240, 1) ={' '}
              <span className="font-medium text-foreground">{d.term_factor.toFixed(4)}</span>
            </p>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('collateral')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {collNote} f<sub>col</sub> = <span className="font-medium text-foreground">{d.collateral_factor.toFixed(4)}</span>
              {d.collateral_value != null && d.collateral_value > 0 ? (
                <>
                  {' '}
                  ({L === 'vi' ? 'TSBD' : 'Collateral'}{' '}
                  <span className="tabular-nums">{fmtMoney(d.collateral_value)}</span> {L === 'vi' ? 'VND' : 'VND'})
                </>
              ) : null}
            </p>
          </li>

          <li className="pl-1">
            <span className="font-semibold text-foreground">{ft('employment')}</span>
            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{empShow}</span> → f
              <sub>emp</sub> = <span className="font-medium text-foreground">{d.employment_factor.toFixed(4)}</span>
            </p>
          </li>
        </ul>
      </div>

      <div>
        <p className="text-sm font-bold text-foreground mb-2">{t('risk.score.explain.formula')}</p>
        <p className="text-xs text-muted-foreground mb-2 font-mono leading-relaxed break-words">
          R<sub>raw</sub> = 0.28·f<sub>DTI</sub> + 0.10·f<sub>age</sub> + 0.12·f<sub>hist</sub> + 0.18·f<sub>cs</sub> +
          0.08·f<sub>loan</sub> + 0.08·f<sub>ir</sub> + 0.06·f<sub>term</sub> + 0.06·f<sub>col</sub> + 0.04·f<sub>emp</sub>
        </p>
        <p className="text-xs font-semibold text-foreground mb-1">{t('risk.score.explain.contrib_line')}</p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground marker:text-muted-foreground">
          {d.contributions.map((c) => (
            <li key={c.key}>
              <span className="font-medium text-foreground">{ft(c.key)}</span>: {c.weight} × {c.factor.toFixed(4)} ={' '}
              <span className="tabular-nums font-medium text-foreground">{c.contrib.toFixed(4)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <span className="font-semibold">R<sub>raw</sub></span> ={' '}
          <span className="tabular-nums font-bold text-foreground">{d.raw_risk.toFixed(4)}</span>
          {' → '}
          <span className="font-semibold">R</span> = min(max(R<sub>raw</sub>, 0), 1) ={' '}
          <span className="tabular-nums font-bold text-foreground">{d.risk_score.toFixed(4)}</span>
        </p>
        {d.clamped ? (
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {L === 'vi'
              ? 'Giá trị đã được cắt về khoảng [0, 1].'
              : 'Value was clipped to [0, 1].'}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-bold text-foreground mb-1">{t('risk.score.explain.threshold')}</p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
          <li>R &lt; 0,33 → {L === 'vi' ? 'rủi ro thấp' : 'low risk'}</li>
          <li>0,33 ≤ R &lt; 0,66 → {L === 'vi' ? 'trung bình' : 'medium'}</li>
          <li>R ≥ 0,66 → {L === 'vi' ? 'cao' : 'high'}</li>
        </ul>
        <p className="mt-2 text-sm">
          <span className="font-semibold">{L === 'vi' ? 'Kết quả' : 'Result'}:</span> R = {d.risk_score.toFixed(4)} →{' '}
          <span className="font-bold text-foreground">{riskLevelLabel}</span>
        </p>
      </div>

      <div className="border-t border-border/80 pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{t('risk.score.explain.cic')}</p>
        <p className="text-[13px] text-muted-foreground">
          {L === 'vi' ? 'Điểm' : 'Score'} <span className="font-semibold text-foreground">{d.cic_score}</span>, {L === 'vi' ? 'nhóm' : 'bucket'}{' '}
          <span className="font-semibold text-foreground">{d.cic_group}</span>, {t('risk.score.cic_rating')}:{' '}
          <span className="font-semibold text-foreground">{d.cic_rating}</span>
        </p>
      </div>
      </div>
    </div>
  );
}
