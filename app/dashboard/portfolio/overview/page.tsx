'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatDateVietnam } from '@/lib/datetime';
import { formatCompactVnd } from '@/lib/money';
import { RECHART_MARGIN, RECHART_Y_WIDTH } from '@/lib/recharts-layout';

type PortfolioKPI = { total_exposure: number; avg_pd: number; npl_ratio: number; expected_loss?: number; var_99?: number };
type PortfolioTrend = { points: Array<{ timestamp: string; value: number }> };
type RiskDistribution = { chart_data: Array<{ bucket: string; value: number; count?: number }> };
type Concentration = { items: Array<{ name: string; exposure: number }> };

const CHART_COLORS = {
  exposure: '#0ea5a6',
  avgScore: '#6366f1',
  lowRisk: '#34d399',
  mediumRisk: '#fbbf24',
  highRisk: '#fb7185',
  concentration: '#22c1d6',
};

/** Mỗi cột ngành/nghề một màu (lặp lại nếu > số màu). */
const SECTOR_BAR_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
];

function truncateLabel(value: string, maxLength = 28) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export default function PortfolioOverviewPage() {
  const { t, locale } = useI18n();
  const moneyLocale = locale === 'vi' ? 'vi' : 'en';
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [kpi, setKpi] = useState<PortfolioKPI | null>(null);
  const [trendData, setTrendData] = useState<Array<{ month: string; value: number; avgPd: number; npl: number }>>([]);
  const [lossTrendData, setLossTrendData] = useState<Array<{ month: string; expectedLoss: number; var99: number }>>([]);
  const [riskDistribution, setRiskDistribution] = useState<Array<{ level: string; value: number; count: number; fill: string }>>([]);
  /** Gom theo Customer.occupation (backend group_by=occupation). */
  const [sectorByOccupation, setSectorByOccupation] = useState<Array<{ name: string; exposure: number }>>([]);
  const [portfolioCustomerCount, setPortfolioCustomerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [kpiData, trend, avgPdTrend, nplTrend, expectedLossTrend, var99Trend, dist, concSector] = await Promise.all([
          browserApiFetchAuth<PortfolioKPI>('/portfolio/kpi', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=total_exposure&interval=month', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=avg_pd&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=npl_ratio&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=expected_loss&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=var_99&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<RiskDistribution>('/portfolio/risk-distribution', { method: 'GET' }),
          browserApiFetchAuth<Concentration>('/portfolio/concentration?group_by=occupation&top_n=20', { method: 'GET' }),
        ]);
        if (cancelled) return;
        setKpi(kpiData);
        const distMap = Object.fromEntries((dist.chart_data || []).map((item) => [item.bucket, item.value]));
        const countMap = Object.fromEntries((dist.chart_data || []).map((item) => [item.bucket, Number(item.count || 0)]));
        const avgPdMap = new Map((avgPdTrend?.points || []).map((item) => [String(item.timestamp || ''), Number(item.value || 0)]));
        const nplMap = new Map((nplTrend?.points || []).map((item) => [String(item.timestamp || ''), Number(item.value || 0)]));
        const expectedLossMap = new Map((expectedLossTrend?.points || []).map((item) => [String(item.timestamp || ''), Number(item.value || 0)]));
        const var99Map = new Map((var99Trend?.points || []).map((item) => [String(item.timestamp || ''), Number(item.value || 0)]));
        setTrendData((trend.points || []).map((item) => {
          const ts = String(item.timestamp || '');
          return {
            month: formatDateVietnam(item.timestamp, locale, { month: 'short' }),
            value: Number(item.value || 0),
            avgPd: Number(((avgPdMap.get(ts) ?? Number(kpiData.avg_pd || 0)) * 100).toFixed(2)),
            npl: Number(((nplMap.get(ts) ?? Number(kpiData.npl_ratio || 0)) * 100).toFixed(2)),
          };
        }));
        setLossTrendData((trend.points || []).map((item) => {
          const ts = String(item.timestamp || '');
          return {
            month: formatDateVietnam(item.timestamp, locale, { month: 'short' }),
            expectedLoss: Number(expectedLossMap.get(ts) ?? Number(kpiData.expected_loss || 0)),
            var99: Number(var99Map.get(ts) ?? Number(kpiData.var_99 || 0)),
          };
        }));
        setRiskDistribution([
          { level: 'low', value: Number(distMap.low || 0), count: countMap.low || 0, fill: CHART_COLORS.lowRisk },
          { level: 'medium', value: Number(distMap.medium || 0), count: countMap.medium || 0, fill: CHART_COLORS.mediumRisk },
          { level: 'high', value: Number(distMap.high || 0), count: countMap.high || 0, fill: CHART_COLORS.highRisk },
        ]);
        setSectorByOccupation(concSector.items || []);
        setPortfolioCustomerCount(
          Number(countMap.low || 0) + Number(countMap.medium || 0) + Number(countMap.high || 0),
        );
      } catch (err) {
        if (!cancelled) notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [locale, msgLocale, t]);

  const riskDistributionLocalized = riskDistribution.map((x) => ({ ...x, name: t(`risk.level.${x.level}`) }));
  const { sectorBreakdownLocalized, sectorOthersSummary } = useMemo(() => {
    const sorted = [...sectorByOccupation]
      .map((item) => ({
        sectorKey: item.name,
        sector: item.name === '__unspecified__' ? '__unspecified__' : item.name,
        exposure: Number(item.exposure || 0),
      }))
      .sort((a, b) => b.exposure - a.exposure);
    const totalExposure = sorted.reduce((sum, item) => sum + item.exposure, 0);
    const MAX_VISIBLE_BARS = 12;
    if (sorted.length <= MAX_VISIBLE_BARS) {
      return { sectorBreakdownLocalized: sorted, sectorOthersSummary: null as null | { count: number; exposure: number; share: number } };
    }
    const topItems = sorted.slice(0, MAX_VISIBLE_BARS);
    const othersTotal = sorted.slice(MAX_VISIBLE_BARS).reduce((sum, item) => sum + item.exposure, 0);
    return {
      sectorBreakdownLocalized: topItems,
      sectorOthersSummary: {
        count: sorted.length - MAX_VISIBLE_BARS,
        exposure: othersTotal,
        share: totalExposure > 0 ? (othersTotal / totalExposure) * 100 : 0,
      },
    };
  }, [sectorByOccupation]);

  const portfolioMetrics = useMemo(() => [
    { titleKey: 'portfolio.kpi.total_value', value: formatCompactVnd(Number(kpi?.total_exposure || 0), moneyLocale) },
    { titleKey: 'portfolio.kpi.avg_score', value: `${Math.round((1 - (kpi?.avg_pd || 0)) * 100)}` },
    { titleKey: 'portfolio.kpi.customer_count', value: `${portfolioCustomerCount}` },
    { titleKey: 'portfolio.kpi.health', value: (kpi?.npl_ratio || 0) < 0.1 ? 'Good' : 'Watch' },
  ], [kpi, portfolioCustomerCount, moneyLocale]);

  return (
    <div className="motion-enter flex flex-col gap-5 lg:gap-6 p-4 sm:p-5 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.overview.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('portfolio.overview.desc')}</p>
      </div>

      <div className="motion-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {portfolioMetrics.map((metric, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.titleKey.includes('.') ? t(metric.titleKey) : metric.titleKey}
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{metric.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="motion-stagger grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.trend_title')}</CardTitle>
            <CardDescription>{t('portfolio.overview.trend_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={RECHART_MARGIN.lineDualY}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) => formatCompactVnd(Number(value), moneyLocale)}
                  width={RECHART_Y_WIDTH.money}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={RECHART_Y_WIDTH.score}
                  tickMargin={8}
                  tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === t('portfolio.overview.legend_value')) {
                      return [formatCompactVnd(Number(value), moneyLocale), name];
                    }
                    return [`${Number(value).toFixed(2)}%`, name];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="value" stroke={CHART_COLORS.exposure} strokeWidth={2} name={t('portfolio.overview.legend_value')} />
                <Line yAxisId="right" type="monotone" dataKey="avgPd" stroke={CHART_COLORS.avgScore} strokeWidth={2} name="Avg PD %" />
                <Line yAxisId="right" type="monotone" dataKey="npl" stroke={CHART_COLORS.highRisk} strokeWidth={2} name="NPL %" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-400/60 dark:bg-teal-500/32 dark:text-teal-50"
              >
                {t('portfolio.overview.chart_badge_portfolio_value')}
              </Badge>
              <Badge
                variant="outline"
                className="border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-400/60 dark:bg-indigo-500/32 dark:text-indigo-50"
              >
                {t('portfolio.overview.chart_badge_avg_score')}
              </Badge>
              <Badge
                variant="outline"
                className="border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/60 dark:bg-rose-500/32 dark:text-rose-50"
              >
                NPL %
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.risk_dist_title')}</CardTitle>
            <CardDescription>{t('portfolio.overview.risk_dist_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={RECHART_MARGIN.pie}>
                <Pie data={riskDistributionLocalized} cx="50%" cy="50%" labelLine={false} outerRadius={72} fill="#8884d8" dataKey="count">
                  {riskDistributionLocalized.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(value: number, _name, item) => {
                  const share = Number(item?.payload?.value || 0);
                  return [`${value} (${Math.round(share * 100)}%)`, t('customers.count')];
                }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-muted-foreground">{t('portfolio.overview.risk_color_legend')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === 'vi' ? 'Xu hướng tổn thất & VaR' : 'Loss & VaR trend'}</CardTitle>
            <CardDescription>
              {locale === 'vi'
                ? 'Biến động tổn thất kỳ vọng và VaR 99% theo chu kỳ.'
                : 'Expected loss and VaR 99% movement over periods.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lossTrendData} margin={RECHART_MARGIN.lineDualY}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis
                  tickFormatter={(value) => formatCompactVnd(Number(value), moneyLocale)}
                  width={RECHART_Y_WIDTH.money}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCompactVnd(Number(value), moneyLocale),
                    name === 'expectedLoss'
                      ? locale === 'vi'
                        ? 'Tổn thất kỳ vọng'
                        : 'Expected loss'
                      : 'VaR 99%',
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="expectedLoss" stroke="#22c1d6" strokeWidth={2} name={locale === 'vi' ? 'Tổn thất kỳ vọng' : 'Expected loss'} />
                <Line type="monotone" dataKey="var99" stroke="#f97316" strokeWidth={2} name="VaR 99%" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="min-w-0">
          <CardTitle className="break-words">{t('portfolio.overview.sector_title')}</CardTitle>
          <CardDescription>
            <span className="block break-words">{t('portfolio.overview.sector_desc')}</span>
            <span className="mt-1 block break-words text-xs text-muted-foreground">{t('portfolio.overview.sector_sort_hint')}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto overflow-y-visible pb-1">
          <ResponsiveContainer width="100%" height={300} minWidth={320}>
            <BarChart data={sectorBreakdownLocalized} margin={RECHART_MARGIN.barSector}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="sector"
                interval={0}
                minTickGap={8}
                angle={-28}
                textAnchor="end"
                height={78}
                tickMargin={10}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  truncateLabel(v === '__unspecified__' ? t('portfolio.overview.sector_unspecified') : String(v))
                }
              />
              <YAxis
                tickFormatter={(value) => formatCompactVnd(Number(value), moneyLocale)}
                width={RECHART_Y_WIDTH.money}
                tickMargin={6}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [formatCompactVnd(Number(value), moneyLocale), t('portfolio.overview.legend_value')]}
                labelFormatter={(label) =>
                  label === '__unspecified__' ? t('portfolio.overview.sector_unspecified') : String(label)
                }
              />
              <Bar dataKey="exposure" barSize={22} radius={[4, 4, 0, 0]}>
                {sectorBreakdownLocalized.map((entry, index) => (
                  <Cell key={entry.sectorKey || `${entry.sector}-${index}`} fill={SECTOR_BAR_COLORS[index % SECTOR_BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {sectorOthersSummary && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('common.other')}: {sectorOthersSummary.count} {t('customers.items')} | {formatCompactVnd(sectorOthersSummary.exposure, moneyLocale)} ({sectorOthersSummary.share.toFixed(1)}%)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
