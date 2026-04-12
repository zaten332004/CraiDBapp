'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatCompactVnd } from '@/lib/money';
import { RECHART_MARGIN, RECHART_Y_WIDTH } from '@/lib/recharts-layout';

type DistResp = { chart_data: Array<{ bucket: string; count?: number }> };
type ConcResp = { items: Array<{ name: string; exposure: number }> };
type CustomerItem = { customer_id: number; full_name?: string | null; monthly_income?: number | null; requested_loan_amount?: number | null; risk_level?: string | null };
type CustomerListResp = { items: CustomerItem[]; total: number; page: number; limit: number };
type RiskFactorImpactResp = { items: Array<{ factor_key: string; impact: number }>; sample_size: number };

const FACTOR_FALLBACK_ORDER = ['debt_ratio', 'credit_history', 'employment', 'loan_amount', 'income'] as const;

/** When /portfolio/risk-factor-impact fails, approximate shares from list customers (legacy heuristic). */
function fallbackFactorImpactFromCustomers(
  customers: CustomerItem[],
  highCount: number,
  totalDist: number,
): Array<{ factor_key: string; impact: number }> {
  if (customers.length === 0) return [];
  const avgIncome = customers.reduce((s, c) => s + Number(c.monthly_income || 0), 0) / customers.length;
  const avgLoan = customers.reduce((s, c) => s + Number(c.requested_loan_amount || 0), 0) / customers.length;
  const highShare = Math.round((highCount / Math.max(1, totalDist)) * 100);
  const raw: Record<(typeof FACTOR_FALLBACK_ORDER)[number], number> = {
    income: Math.min(35, Math.max(8, Math.round((avgIncome / Math.max(avgLoan, 1)) * 12))),
    debt_ratio: Math.min(35, Math.max(10, Math.round((avgLoan / Math.max(avgIncome, 1)) * 20))),
    credit_history: Math.max(8, 24 - Math.round(highShare / 3)),
    employment: 12,
    loan_amount: Math.min(25, Math.max(10, Math.round((avgLoan / 1_000_000_000) * 8))),
  };
  const total = FACTOR_FALLBACK_ORDER.reduce((s, k) => s + raw[k], 0) || 1;
  return FACTOR_FALLBACK_ORDER.map((factor_key) => ({
    factor_key,
    impact: Math.round((1000 * raw[factor_key]) / total) / 10,
  }));
}

/** Custom Y ticks so "100%" is not clipped (default narrow tick box showed "00%"). */
function FactorYAxisTick(props: { x?: number; y?: number; payload?: { value?: number } }) {
  const { x, y, payload } = props;
  if (x == null || y == null || payload?.value == null) return <g />;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      className="fill-foreground"
      style={{ fontSize: 11 }}
    >
      {`${payload.value}%`}
    </text>
  );
}

export default function RiskAnalyzePage() {
  const { locale, t } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [factorImpactItems, setFactorImpactItems] = useState<Array<{ factor_key: string; impact: number }>>([]);
  const [usedFactorFallback, setUsedFactorFallback] = useState(false);
  const factorApiWarnedRef = useRef(false);
  const [portfolioDistribution, setPortfolioDistribution] = useState<Array<{ riskLevel: string; count: number; percentage: number }>>([]);
  const [customerScatter, setCustomerScatter] = useState<Array<{ income: number; loanAmount: number; score: number; customerName: string; customerId: number; riskLevel: string }>>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadAllCustomers = async () => {
      const all: CustomerItem[] = [];
      let page = 1;
      let total = 0;
      do {
        const resp = await browserApiFetchAuth<CustomerListResp>(`/customers?page=${page}`, { method: 'GET' });
        total = Number(resp.total || 0);
        all.push(...(resp.items || []));
        page += 1;
        if ((resp.items || []).length === 0) break;
      } while (all.length < total && page < 200);
      return all;
    };

    const load = async () => {
      try {
        setIsRefreshing(true);
        const [distResult, concResult, customerResult, factorResult] = await Promise.allSettled([
          browserApiFetchAuth<DistResp>('/portfolio/risk-distribution', { method: 'GET' }),
          browserApiFetchAuth<ConcResp>('/portfolio/concentration', { method: 'GET' }),
          loadAllCustomers(),
          browserApiFetchAuth<RiskFactorImpactResp>('/portfolio/risk-factor-impact', { method: 'GET' }),
        ]);

        if (cancelled) return;

        const customers = customerResult.status === 'fulfilled' ? customerResult.value : [];
        const dist = distResult.status === 'fulfilled' ? distResult.value : { chart_data: [] };
        const conc = concResult.status === 'fulfilled' ? concResult.value : { items: [] };

        const distCounts = Object.fromEntries((dist.chart_data || []).map((x) => [String(x.bucket || '').toLowerCase(), Number(x.count || 0)]));
        const lowCount = Number(distCounts.low || 0);
        const mediumCount = Number(distCounts.medium || 0);
        const highCount = Number(distCounts.high || 0);
        const totalDist = Math.max(1, lowCount + mediumCount + highCount);

        const apiItems =
          factorResult.status === 'fulfilled' &&
          factorResult.value &&
          Array.isArray(factorResult.value.items) &&
          factorResult.value.items.length > 0
            ? factorResult.value.items
            : null;

        if (apiItems) {
          factorApiWarnedRef.current = false;
          setFactorImpactItems(apiItems);
          setUsedFactorFallback(false);
        } else {
          if (factorResult.status === 'rejected' && !factorApiWarnedRef.current) {
            factorApiWarnedRef.current = true;
            const reason = factorResult.reason;
            const hint =
              reason instanceof ApiError && reason.status === 404
                ? (locale === 'vi'
                    ? ' Backend có thể chưa có endpoint /portfolio/risk-factor-impact (cần deploy bản mới).'
                    : ' Backend may be missing /portfolio/risk-factor-impact (deploy latest server).')
                : '';
            notifyError(t('toast.load_failed'), {
              description: [formatUserFacingApiError(reason, msgLocale), hint.trim()].filter(Boolean).join('\n'),
            });
          }
          const fb = fallbackFactorImpactFromCustomers(customers, highCount, totalDist);
          setFactorImpactItems(fb);
          setUsedFactorFallback(fb.length > 0);
        }
        setPortfolioDistribution([
          { riskLevel: 'low', count: lowCount, percentage: Math.round((lowCount / totalDist) * 100) },
          { riskLevel: 'medium', count: mediumCount, percentage: Math.round((mediumCount / totalDist) * 100) },
          { riskLevel: 'high', count: highCount, percentage: Math.round((highCount / totalDist) * 100) },
        ]);

        const normalizedCustomers = customers.map((c) => ({
          customerId: Number(c.customer_id || 0),
          customerName: String(c.full_name || `${t('customers.customer')} #${c.customer_id}`),
          income: Number(c.monthly_income || 0),
          loanAmount: Number(c.requested_loan_amount || 0),
          riskLevel: String(c.risk_level || 'medium').toLowerCase(),
        })).filter((x) => x.customerId > 0);

        const scatter = normalizedCustomers.length > 0
          ? normalizedCustomers.map((x) => ({
            income: x.income,
            loanAmount: x.loanAmount,
            score: x.riskLevel === 'low' ? 85 : x.riskLevel === 'high' ? 35 : 65,
            customerName: x.customerName,
            customerId: x.customerId,
            riskLevel: x.riskLevel,
          }))
          : (conc.items || []).slice(0, 100).map((item, idx) => ({
            income: Number(item.exposure || 0) / 3,
            loanAmount: Number(item.exposure || 0),
            score: 50,
            customerName: item.name || `${t('customers.customer')} #${idx + 1}`,
            customerId: idx + 1,
            riskLevel: 'medium',
          }));
        setCustomerScatter(scatter);

        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!cancelled) notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    const refresh = () => { void load(); };
    refresh();

    const interval = window.setInterval(refresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [locale, msgLocale, t]);

  const riskFactorDataLocalized = useMemo(
    () =>
      factorImpactItems.map((row) => ({
        factor: t(`risk.factor.${row.factor_key}`) || row.factor_key,
        impact: row.impact,
      })),
    [factorImpactItems, t, locale],
  );

  const riskLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  const analysisSummary = useMemo(() => {
    const total = Math.max(1, customerScatter.length);
    const low = portfolioDistribution.find((x) => x.riskLevel === 'low')?.count ?? 0;
    const medium = portfolioDistribution.find((x) => x.riskLevel === 'medium')?.count ?? 0;
    const high = portfolioDistribution.find((x) => x.riskLevel === 'high')?.count ?? 0;
    const highPct = Math.round((high / total) * 100);
    const avgIncome = customerScatter.reduce((sum, x) => sum + x.income, 0) / total;
    const avgLoan = customerScatter.reduce((sum, x) => sum + x.loanAmount, 0) / total;
    const ratio = avgIncome / Math.max(avgLoan, 1);
    const medianBand = ratio >= 2.5 ? 'low' : ratio >= 1.5 ? 'medium' : 'high';
    const topFactor = [...riskFactorDataLocalized].sort((a, b) => b.impact - a.impact)[0];
    return { total, low, medium, high, highPct, avgIncome, avgLoan, ratio, medianBand, topFactor };
  }, [customerScatter, portfolioDistribution, riskFactorDataLocalized]);

  const dynamicInsights = useMemo(() => {
    const s = analysisSummary;
    if (locale === 'vi') {
      return [
        `Danh mục hiện có ${s.total} hồ sơ: ${s.low} rủi ro thấp, ${s.medium} trung bình, ${s.high} rủi ro cao.`,
        `Tỷ trọng rủi ro cao đang ở mức ${s.highPct}%${s.highPct >= 30 ? ', cần ưu tiên giám sát và tái thẩm định.' : ', đang trong ngưỡng có thể kiểm soát.'}`,
        `Thu nhập bình quân khoảng ${formatCompactVnd(s.avgIncome, 'vi')} và khoản vay bình quân khoảng ${formatCompactVnd(s.avgLoan, 'vi')}.`,
        `Yếu tố tác động mạnh nhất hiện tại là "${s.topFactor?.factor ?? '—'}" (${s.topFactor?.impact ?? 0}%).`,
      ];
    }
    return [
      `Portfolio has ${s.total} records: ${s.low} low-risk, ${s.medium} medium-risk, ${s.high} high-risk.`,
      `High-risk share is ${s.highPct}%${s.highPct >= 30 ? ', so closer monitoring is recommended.' : ', currently in a controllable range.'}`,
      `Average income is around ${formatCompactVnd(s.avgIncome, 'en')} and average loan is around ${formatCompactVnd(s.avgLoan, 'en')}.`,
      `The strongest impact factor right now is "${s.topFactor?.factor ?? '—'}" (${s.topFactor?.impact ?? 0}%).`,
    ];
  }, [analysisSummary, locale]);

  const dynamicCorrelationSummary = useMemo(() => {
    const s = analysisSummary;
    if (locale === 'vi') {
      return `Phân tích dữ liệu thực cho thấy tỷ lệ thu nhập/khoản vay trung bình là ${s.ratio.toFixed(2)}; tương ứng mức rủi ro ${riskLabel(s.medianBand)}.`;
    }
    return `Live-data analysis shows an average income-to-loan ratio of ${s.ratio.toFixed(2)}, which aligns with ${riskLabel(s.medianBand)} risk.`;
  }, [analysisSummary, locale]);

  const dynamicIndicators = useMemo(() => {
    const s = analysisSummary;
    if (locale === 'vi') {
      return [
        `Tỷ lệ thu nhập/khoản vay >= 2.5: xu hướng ${riskLabel('low')}.`,
        `Tỷ lệ thu nhập/khoản vay từ 1.5-2.5: xu hướng ${riskLabel('medium')}.`,
        `Tỷ lệ thu nhập/khoản vay < 1.5: xu hướng ${riskLabel('high')}.`,
      ];
    }
    return [
      `Income-to-loan ratio >= 2.5: tends toward ${riskLabel('low')} risk.`,
      `Income-to-loan ratio 1.5-2.5: tends toward ${riskLabel('medium')} risk.`,
      `Income-to-loan ratio < 1.5: tends toward ${riskLabel('high')} risk.`,
    ];
  }, [locale]);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.analyze.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.analyze.desc')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isRefreshing
            ? (locale === 'vi' ? 'Đang cập nhật dữ liệu thực...' : 'Refreshing live data...')
            : lastUpdatedAt
              ? (locale === 'vi'
                  ? `Cập nhật lần cuối: ${lastUpdatedAt.toLocaleTimeString('vi-VN')}`
                  : `Last updated: ${lastUpdatedAt.toLocaleTimeString('en-US')}`)
              : (locale === 'vi' ? 'Đang chờ dữ liệu...' : 'Waiting for data...')}
        </p>
      </div>

      <Tabs defaultValue="factors" className="w-full">
        <TabsList>
          <TabsTrigger value="factors">{t('risk.analyze.factors_tab')}</TabsTrigger>
          <TabsTrigger value="distribution">{t('risk.analyze.distribution_tab')}</TabsTrigger>
          <TabsTrigger value="correlation">{t('risk.analyze.correlation_tab')}</TabsTrigger>
        </TabsList>

        {/* Risk Factors */}
        <TabsContent value="factors" className="space-y-4">
          <Card className="gap-2 py-4">
            <CardHeader className="pb-2">
              <CardTitle>{t('risk.analyze.factors_title')}</CardTitle>
              <CardDescription>
                {t('risk.analyze.factors_desc')}
                {usedFactorFallback ? (
                  <span className="mt-2 block text-amber-700 dark:text-amber-300">
                    {t('risk.analyze.factors_fallback_note')}
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="w-full min-w-0 overflow-visible px-3 pb-1 pt-0 sm:px-6 sm:pb-2">
              {riskFactorDataLocalized.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  {t('risk.analyze.factors_empty')}
                </p>
              ) : (
                <div className="h-[min(400px,55vh)] w-full min-h-[300px] overflow-visible">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={riskFactorDataLocalized}
                      margin={RECHART_MARGIN.factors}
                      barCategoryGap="6%"
                      barGap={2}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="factor"
                        interval={0}
                        angle={0}
                        textAnchor="middle"
                        tick={{ fontSize: 11 }}
                        tickMargin={2}
                        height={34}
                      />
                      <YAxis
                        domain={[0, 100]}
                        width={48}
                        tick={FactorYAxisTick}
                        ticks={[0, 25, 50, 75, 100]}
                        orientation="left"
                        axisLine={false}
                      />
                      <Tooltip formatter={(v: number) => [`${v}%`, t('risk.analyze.impact_pct')]} />
                      <Bar
                        dataKey="impact"
                        fill="#06b6d4"
                        name={t('risk.analyze.impact_pct')}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={140}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.insights')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dynamicInsights.map((insight, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{insight}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader className="min-w-0">
              <CardTitle className="break-words">{t('risk.analyze.portfolio_dist_title')}</CardTitle>
              <CardDescription className="break-words">
                {t('risk.analyze.portfolio_dist_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {portfolioDistribution.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{riskLabel(item.riskLevel)}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} {t('customers.items')} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-accent rounded-full h-2 transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.key_metrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('customers.total')}</p>
                  <p className="text-2xl font-bold mt-2">{customerScatter.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('customers.avg_score')}</p>
                  <p className="text-2xl font-bold mt-2">
                    {Math.round(customerScatter.reduce((sum, x) => sum + x.score, 0) / Math.max(1, customerScatter.length))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('risk.analyze.portfolio_risk')}</p>
                  <p className="text-2xl font-bold mt-2">{riskLabel((portfolioDistribution.sort((a, b) => b.count - a.count)[0]?.riskLevel || 'medium'))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation */}
        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.correlation_title')}</CardTitle>
              <CardDescription>
                {t('risk.analyze.correlation_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-1">
              <ResponsiveContainer width="100%" height={400} minWidth={360}>
                <ScatterChart margin={RECHART_MARGIN.scatterMoney}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="income"
                    name={t('customers.annual_income_short')}
                    type="number"
                    tickFormatter={(v) => formatCompactVnd(Number(v), locale)}
                    height={56}
                    tick={{ fontSize: 10 }}
                    tickMargin={10}
                  />
                  <YAxis
                    dataKey="loanAmount"
                    name={t('customers.loan_amount_short')}
                    type="number"
                    tickFormatter={(v) => formatCompactVnd(Number(v), locale)}
                    width={RECHART_Y_WIDTH.money}
                    tick={{ fontSize: 10 }}
                    tickMargin={8}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as any;
                      return (
                        <div className="rounded-md border bg-background p-3 text-xs">
                          <div className="font-semibold">{row.customerName || `${t('customers.customer')} #${row.customerId}`}</div>
                          <div>{t('customers.annual_income_short')}: {formatCompactVnd(Number(row.income || 0), locale)}</div>
                          <div>{t('customers.loan_amount_short')}: {formatCompactVnd(Number(row.loanAmount || 0), locale)}</div>
                          <div>{t('customers.risk_level')}: {riskLabel(String(row.riskLevel || 'medium'))}</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    name={t('customers.title')}
                    data={customerScatter}
                    fill="#06b6d4"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.findings_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {dynamicCorrelationSummary}
              </p>
              <div className="bg-secondary p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t('risk.analyze.strong_indicators')}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {dynamicIndicators.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
