'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError } from '@/lib/api/format-api-error';
import { formatVnd } from '@/lib/money';
import { riskBadgeOutlineClass } from '@/components/risk-score-explanation';
import { cn } from '@/lib/utils';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Same mapping as risk score page: API `risk_score` is R∈[0,1], UI điểm = (1−R)×100. */
function apiRiskToUiScore(rawRisk: unknown): number {
  const r = Number(rawRisk);
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.min(100, (r <= 1 ? 1 - r : r / 100) * 100));
}

function formatUiRiskScore(n: number): string {
  return n.toFixed(2);
}

/** Hiển thị chênh lệch điểm (không dùng toFixed(1) — sẽ làm 0.18 → 0.2). */
function formatScoreDelta(base: number, adjusted: number): string {
  const d = adjusted - base;
  if (Math.abs(d) < 1e-9) return '0';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(2)}`;
}

function normalizeRiskLevel(level: unknown): string {
  const s = String(level || 'medium').trim().toLowerCase();
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  return 'medium';
}

function parsePercentInput(raw: string, min: number, max: number) {
  const normalized = raw.replace(',', '.').trim();
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.' || normalized === '-.' || normalized === '+.') {
    return clamp(0, min, max);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return clamp(0, min, max);
  return clamp(parsed, min, max);
}

/** Cho phép gõ số thập phân; chỉ chấp nhận ký tự hợp lệ khi đang nhập. */
function sanitizePercentTyping(raw: string): string {
  return raw.replace(',', '.');
}

function isValidPercentTyping(s: string): boolean {
  return s === '' || /^-?\d*\.?\d*$/.test(s);
}

function formatPctDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10000) / 10000;
  if (Object.is(r, -0) || r === 0) return '0';
  return String(r);
}

export default function RiskSimulationPage() {
  const { locale, t } = useI18n();
  const [customerId, setCustomerId] = useState('');
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [baseData, setBaseData] = useState<Record<string, any> | null>(null);
  const [scenario, setScenario] = useState({
    customerName: '-',
    baseScore: 0,
    incomeChange: 0,
    debtChange: 0,
    interestRateChange: 0,
  });

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [scenarioData, setScenarioData] = useState<Array<{ change: string; score: number; riskLevel: string }>>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  /** Chuỗi ô nhập % — tách khỏi số để gõ được `4.` hoặc `-` mà không bị ép ngay. */
  const [pctDraft, setPctDraft] = useState({ income: '0', debt: '0', rate: '0' });

  const resolveCustomerByInput = async (rawInput: string) => {
    const input = rawInput.trim();
    if (!input) return null;
    const numericId = Number(input);
    if (Number.isFinite(numericId) && numericId > 0) {
      return browserApiFetchAuth<any>(`/customers/${numericId}`, { method: 'GET' });
    }
    const searchResp = await browserApiFetchAuth<{ items?: Array<Record<string, any>> }>(`/customers?page=1&search_name=${encodeURIComponent(input)}`, { method: 'GET' });
    const items = searchResp?.items || [];
    const normalizedInput = input.toLowerCase();
    const exactRef = items.find((item) => String(item?.external_customer_ref || '').toLowerCase() === normalizedInput);
    if (exactRef?.customer_id) return browserApiFetchAuth<any>(`/customers/${exactRef.customer_id}`, { method: 'GET' });
    if (items[0]?.customer_id) return browserApiFetchAuth<any>(`/customers/${items[0].customer_id}`, { method: 'GET' });
    return null;
  };

  const loadCustomerById = async () => {
    const input = customerId.trim();
    if (!input) {
      notifyError(t('powerbi.customer_id_required'));
      return;
    }
    setIsLoadingCustomer(true);
    setSimulationResult(null);
    setScenarioData([]);
    try {
      const customer = await resolveCustomerByInput(input);
      if (!customer?.customer_id) {
        notifyError(locale === 'vi' ? 'Không tìm thấy khách hàng theo mã/ID đã nhập.' : 'Customer not found by the provided ID/reference.');
        return;
      }
      const historyMonths = Number(customer?.credit_history_months);
      const preparedBaseData = {
        income: Number(customer?.monthly_income || 0),
        debt: Number(customer?.requested_loan_amount || 0),
        age: Number(customer?.age || 30),
        credit_history_months: Number.isFinite(historyMonths) && historyMonths >= 0 ? Math.round(historyMonths) : 60,
        credit_score: customer?.credit_score != null ? Number(customer.credit_score) : undefined,
        loan_type: customer?.loan_type || undefined,
        interest_rate: customer?.annual_interest_rate != null ? Number(customer.annual_interest_rate) : undefined,
        loan_term_months: customer?.requested_term_months != null ? Number(customer.requested_term_months) : undefined,
        collateral_value: customer?.collateral_value != null ? Number(customer.collateral_value) : undefined,
        employment_status: customer?.employment_status || undefined,
      };
      const baseScoreResp = await browserApiFetchAuth<any>('/risk/score', { method: 'POST', body: preparedBaseData });
      const baseScore = apiRiskToUiScore(baseScoreResp?.risk_score);
      setSelectedCustomer(customer);
      setBaseData(preparedBaseData);
      setScenario((prev) => ({
        ...prev,
        customerName: String(customer?.full_name || customer?.external_customer_ref || `${t('customers.customer')} #${customer.customer_id}`),
        baseScore,
        incomeChange: 0,
        debtChange: 0,
        interestRateChange: 0,
      }));
      setPctDraft({ income: '0', debt: '0', rate: '0' });
    } catch (err) {
      notifyError(formatUserFacingApiError(err));
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const handleSimulate = async () => {
    if (!baseData) {
      notifyError(t('powerbi.customer_id_required'));
      return;
    }
    setIsSimulating(true);
    try {
      const baseRate = baseData.interest_rate != null ? Number(baseData.interest_rate) : null;
      const adjustedPayload: Record<string, any> = {
        ...baseData,
        income: Math.max(0, Number(baseData.income || 0) * (1 + scenario.incomeChange / 100)),
        debt: Math.max(0, Number(baseData.debt || 0) * (1 + scenario.debtChange / 100)),
        /* Thay đổi lãi suất: điểm phần trăm tuyệt đối (+2.8 → 4.5% + 2.8% = 7.3%), không nhân (1+r%). */
        interest_rate:
          baseRate != null && Number.isFinite(baseRate)
            ? clamp(baseRate + scenario.interestRateChange, 0, 100)
            : undefined,
      };
      const adjustedScoreResp = await browserApiFetchAuth<any>('/risk/score', { method: 'POST', body: adjustedPayload });
      const adjustedScore = apiRiskToUiScore(adjustedScoreResp?.risk_score);
      const adjustedRiskLevel = normalizeRiskLevel(adjustedScoreResp?.risk_label);

      const baseScoreNum = Number(scenario.baseScore);
      setSimulationResult({
        baseScore: baseScoreNum,
        adjustedScore,
        baseScoreDisplay: formatUiRiskScore(baseScoreNum),
        adjustedScoreDisplay: formatUiRiskScore(adjustedScore),
        scoreDeltaDisplay: formatScoreDelta(baseScoreNum, adjustedScore),
        riskLevel: adjustedRiskLevel,
        simulatedData: {
          income: adjustedPayload.income,
          debt: adjustedPayload.debt,
          interestRate: adjustedPayload.interest_rate,
          age: adjustedPayload.age,
          creditScore: adjustedPayload.credit_score,
          loanTermMonths: adjustedPayload.loan_term_months,
        },
        changes: { income: scenario.incomeChange, debt: scenario.debtChange, interestRate: scenario.interestRateChange },
      });

      const sensitivityChanges = [-50, -25, 0, 25, 50, 100];
      const scenarios = sensitivityChanges.map((change) => ({ debt: Math.max(0, Number(baseData.debt || 0) * (1 + change / 100)) }));
      const response = await browserApiFetchAuth<{ scenario_results: Array<{ risk_score?: number; risk_label?: string }> }>('/risk/simulation', { method: 'POST', body: { base_data: baseData, scenarios } });
      const rows = (response?.scenario_results || []).map((item, idx) => ({
        change: `${(sensitivityChanges[idx] || 0) > 0 ? '+' : ''}${sensitivityChanges[idx] || 0}%`,
        score: apiRiskToUiScore(item.risk_score),
        riskLevel: normalizeRiskLevel(item.risk_label),
      }));
      if (rows.length > 0) setScenarioData(rows);
    } catch (err) {
      notifyError(formatUserFacingApiError(err));
    } finally {
      setIsSimulating(false);
    }
  };

  const riskLevelLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.sim.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.sim.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Simulation Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('risk.sim.card_title')}</CardTitle>
            <CardDescription>
              {t('risk.sim.card_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customerIdInput">{t('customers.customer_id')}</Label>
              <div className="flex gap-2">
                <Input id="customerIdInput" value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="VD: 123 hoặc CUST0500" />
                <Button type="button" variant="outline" onClick={loadCustomerById} disabled={isLoadingCustomer}>{isLoadingCustomer ? t('common.loading') : t('common.search')}</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('risk.sim.customer')}: {scenario.customerName}</Label>
              <div className="bg-secondary p-3 rounded-lg">
                <p className="text-sm font-medium">
                  {t('risk.sim.base_score')}: {formatUiRiskScore(Number(scenario.baseScore))}
                </p>
              </div>
            </div>
            {selectedCustomer && (
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-2">{locale === 'vi' ? 'Dữ liệu gốc khách hàng' : 'Customer baseline data'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <p>{locale === 'vi' ? 'Thu nhập tháng' : 'Monthly income'}: {formatVnd(Number(selectedCustomer.monthly_income || 0), locale === 'vi' ? 'vi' : 'en')}</p>
                  <p>{locale === 'vi' ? 'Khoản vay' : 'Loan amount'}: {formatVnd(Number(selectedCustomer.requested_loan_amount || 0), locale === 'vi' ? 'vi' : 'en')}</p>
                  <p>{locale === 'vi' ? 'Tuổi' : 'Age'}: {selectedCustomer.age ?? '-'}</p>
                  <p>{locale === 'vi' ? 'Điểm tín dụng' : 'Credit score'}: {selectedCustomer.credit_score ?? '-'}</p>
                  <p>{locale === 'vi' ? 'Lãi suất' : 'Interest rate'}: {selectedCustomer.annual_interest_rate ?? '-'}%</p>
                  <p>{locale === 'vi' ? 'Thời hạn vay' : 'Loan term'}: {selectedCustomer.requested_term_months ?? '-'} {locale === 'vi' ? 'tháng' : 'months'}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {t('risk.sim.income_change')}: {scenario.incomeChange > 0 ? '+' : ''}
                    {formatPctDraftFromNumber(scenario.incomeChange)}%
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={pctDraft.income}
                    onChange={(event) => {
                      const raw = sanitizePercentTyping(event.target.value);
                      if (!isValidPercentTyping(raw)) return;
                      setPctDraft((p) => ({ ...p, income: raw }));
                      if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.' && !/^-?\d+\.$/.test(raw)) {
                        const n = Number(raw);
                        if (Number.isFinite(n)) setScenario((prev) => ({ ...prev, incomeChange: clamp(n, -50, 50) }));
                      }
                    }}
                    onBlur={() => {
                      const n = parsePercentInput(pctDraft.income, -50, 50);
                      setScenario((prev) => ({ ...prev, incomeChange: n }));
                      setPctDraft((p) => ({ ...p, income: formatPctDraftFromNumber(n) }));
                    }}
                    className="min-w-[5.5rem] w-28 h-8 text-right tabular-nums"
                  />
                </div>
                <Slider
                  value={[scenario.incomeChange]}
                  onValueChange={(value) => {
                    const v = value[0];
                    setScenario((prev) => ({ ...prev, incomeChange: v }));
                    setPctDraft((p) => ({ ...p, income: formatPctDraftFromNumber(v) }));
                  }}
                  min={-50}
                  max={50}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {t('risk.sim.debt_change')}: {scenario.debtChange > 0 ? '+' : ''}
                    {formatPctDraftFromNumber(scenario.debtChange)}%
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={pctDraft.debt}
                    onChange={(event) => {
                      const raw = sanitizePercentTyping(event.target.value);
                      if (!isValidPercentTyping(raw)) return;
                      setPctDraft((p) => ({ ...p, debt: raw }));
                      if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.' && !/^-?\d+\.$/.test(raw)) {
                        const n = Number(raw);
                        if (Number.isFinite(n)) setScenario((prev) => ({ ...prev, debtChange: clamp(n, -30, 50) }));
                      }
                    }}
                    onBlur={() => {
                      const n = parsePercentInput(pctDraft.debt, -30, 50);
                      setScenario((prev) => ({ ...prev, debtChange: n }));
                      setPctDraft((p) => ({ ...p, debt: formatPctDraftFromNumber(n) }));
                    }}
                    className="min-w-[5.5rem] w-28 h-8 text-right tabular-nums"
                  />
                </div>
                <Slider
                  value={[scenario.debtChange]}
                  onValueChange={(value) => {
                    const v = value[0];
                    setScenario((prev) => ({ ...prev, debtChange: v }));
                    setPctDraft((p) => ({ ...p, debt: formatPctDraftFromNumber(v) }));
                  }}
                  min={-30}
                  max={50}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {t('risk.sim.rate_change')}: {scenario.interestRateChange > 0 ? '+' : ''}
                    {formatPctDraftFromNumber(scenario.interestRateChange)}%
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={pctDraft.rate}
                    onChange={(event) => {
                      const raw = sanitizePercentTyping(event.target.value);
                      if (!isValidPercentTyping(raw)) return;
                      setPctDraft((p) => ({ ...p, rate: raw }));
                      if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.' && !/^-?\d+\.$/.test(raw)) {
                        const n = Number(raw);
                        if (Number.isFinite(n)) setScenario((prev) => ({ ...prev, interestRateChange: clamp(n, -5, 10) }));
                      }
                    }}
                    onBlur={() => {
                      const n = parsePercentInput(pctDraft.rate, -5, 10);
                      setScenario((prev) => ({ ...prev, interestRateChange: n }));
                      setPctDraft((p) => ({ ...p, rate: formatPctDraftFromNumber(n) }));
                    }}
                    className="min-w-[5.5rem] w-28 h-8 text-right tabular-nums"
                  />
                </div>
                <Slider
                  value={[scenario.interestRateChange]}
                  onValueChange={(value) => {
                    const v = value[0];
                    setScenario((prev) => ({ ...prev, interestRateChange: v }));
                    setPctDraft((p) => ({ ...p, rate: formatPctDraftFromNumber(v) }));
                  }}
                  min={-5}
                  max={10}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>

            <Button onClick={handleSimulate} className="w-full" size="lg" disabled={!baseData || isSimulating}>
              <Zap className="mr-2 h-4 w-4" />
              {isSimulating ? t('common.processing') : t('risk.sim.run')}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {simulationResult && (
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.sim.result_title')}</CardTitle>
              <CardDescription>
                {t('risk.sim.result_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('risk.sim.base_score_short')}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{simulationResult.baseScoreDisplay}</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('risk.sim.adjusted_score')}</p>
                      <p className="text-3xl font-bold mt-1 text-accent tabular-nums">
                        {simulationResult.adjustedScoreDisplay}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-base px-4 py-2 font-semibold shadow-none', riskBadgeOutlineClass(simulationResult.riskLevel))}
                    >
                      {riskLevelLabel(simulationResult.riskLevel)}
                    </Badge>
                  </div>

                  <div className="mt-4 text-sm">
                    <p className="text-muted-foreground tabular-nums">
                      {t('common.change')}: {simulationResult.scoreDeltaDisplay}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t('risk.sim.breakdown')}</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• {t('risk.sim.income_change')}: {simulationResult.changes.income > 0 ? '+' : ''}{simulationResult.changes.income}%</p>
                  <p>• {t('risk.sim.debt_change')}: {simulationResult.changes.debt > 0 ? '+' : ''}{simulationResult.changes.debt}%</p>
                  <p>• {t('risk.sim.rate_change')}: {simulationResult.changes.interestRate > 0 ? '+' : ''}{simulationResult.changes.interestRate}%</p>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">
                  {locale === 'vi' ? 'Dữ liệu đã mô phỏng (sau tăng/giảm)' : 'Simulated data (post-adjustment)'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <p>{locale === 'vi' ? 'Thu nhập tháng' : 'Monthly income'}: {formatVnd(Number(simulationResult?.simulatedData?.income || 0), locale === 'vi' ? 'vi' : 'en')}</p>
                  <p>{locale === 'vi' ? 'Khoản vay' : 'Loan amount'}: {formatVnd(Number(simulationResult?.simulatedData?.debt || 0), locale === 'vi' ? 'vi' : 'en')}</p>
                  <p>{locale === 'vi' ? 'Lãi suất' : 'Interest rate'}: {simulationResult?.simulatedData?.interestRate != null ? `${Number(simulationResult.simulatedData.interestRate).toFixed(2)}%` : '-'}</p>
                  <p>{locale === 'vi' ? 'Tuổi' : 'Age'}: {simulationResult?.simulatedData?.age ?? '-'}</p>
                  <p>{locale === 'vi' ? 'Điểm tín dụng' : 'Credit score'}: {simulationResult?.simulatedData?.creditScore ?? '-'}</p>
                  <p>{locale === 'vi' ? 'Thời hạn vay' : 'Loan term'}: {simulationResult?.simulatedData?.loanTermMonths ?? '-'} {locale === 'vi' ? 'tháng' : 'months'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sensitivity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('risk.sim.sensitivity_title')}</CardTitle>
          <CardDescription>
            {t('risk.sim.sensitivity_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scenarioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="change" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}`} width={40} />
              <Tooltip formatter={(v: number) => [formatUiRiskScore(Number(v)), t('customers.risk_score')]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#06b6d4"
                strokeWidth={2}
                name={t('customers.risk_score')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
