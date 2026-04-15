'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { RECHART_MARGIN, RECHART_Y_WIDTH } from '@/lib/recharts-layout';
import { formatDateVietnam } from '@/lib/datetime';
import { formatCompactVnd } from '@/lib/money';

type RiskDistributionResponse = {
  chart_data: Array<{ bucket: string; value: number; count?: number }>;
  score_buckets?: Array<{ range: string; count: number }>;
  score_stats?: { mean?: number; median?: number; std_dev?: number };
};
type PortfolioTrend = { points: Array<{ timestamp: string; value: number }> };

const DEFAULT_SCORE_BINS: Array<{ range: string; count: number }> = [
  { range: '0-20', count: 0 },
  { range: '20-40', count: 0 },
  { range: '40-60', count: 0 },
  { range: '60-80', count: 0 },
  { range: '80-100', count: 0 },
];

export default function RiskDistributionPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [riskData, setRiskData] = useState<Array<{ level: string; value: number; fill: string }>>([]);
  const [scoreDistribution, setScoreDistribution] = useState<Array<{ range: string; count: number }>>(DEFAULT_SCORE_BINS);
  const [scoreStats, setScoreStats] = useState<{ mean: number; median: number; std_dev: number }>({
    mean: 0,
    median: 0,
    std_dev: 0,
  });
  const [qualityTrendData, setQualityTrendData] = useState<Array<{ month: string; avgPd: number; npl: number; expectedLoss: number }>>([]);
  const [riskExposureData, setRiskExposureData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [dist, avgPdTrend, nplTrend, expectedLossTrend] = await Promise.all([
          browserApiFetchAuth<RiskDistributionResponse>('/portfolio/risk-distribution', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=avg_pd&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=npl_ratio&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=expected_loss&interval=month', { method: 'GET' }).catch(() => null),
        ]);
        if (cancelled) return;
        const distMap = Object.fromEntries((dist.chart_data || []).map((item) => [item.bucket, Number(item.count ?? item.value ?? 0)]));
        setRiskData([
          { level: 'low', value: Number(distMap.low || 0), fill: '#34d399' },
          { level: 'medium', value: Number(distMap.medium || 0), fill: '#fbbf24' },
          { level: 'high', value: Number(distMap.high || 0), fill: '#fb7185' },
        ]);

        const fromApi = dist.score_buckets;
        if (fromApi && fromApi.length > 0) {
          setScoreDistribution(
            DEFAULT_SCORE_BINS.map((b) => {
              const hit = fromApi.find((x) => x.range === b.range);
              return { range: b.range, count: Number(hit?.count ?? 0) };
            }),
          );
        } else {
          setScoreDistribution(DEFAULT_SCORE_BINS);
        }

        const ss = dist.score_stats;
        setScoreStats({
          mean: Number(ss?.mean ?? 0),
          median: Number(ss?.median ?? 0),
          std_dev: Number(ss?.std_dev ?? 0),
        });
        const avgPdPoints = avgPdTrend?.points || [];
        const nplPoints = nplTrend?.points || [];
        const expectedLossPoints = expectedLossTrend?.points || [];
        const nplMap = new Map(nplPoints.map((p) => [String(p.timestamp || ''), Number(p.value || 0)]));
        const expectedLossMap = new Map(expectedLossPoints.map((p) => [String(p.timestamp || ''), Number(p.value || 0)]));
        setQualityTrendData(
          avgPdPoints.map((point) => {
            const ts = String(point.timestamp || '');
            return {
              month: formatDateVietnam(point.timestamp, locale, { month: 'short' }),
              avgPd: Number((Number(point.value || 0) * 100).toFixed(2)),
              npl: Number(((nplMap.get(ts) ?? 0) * 100).toFixed(2)),
              expectedLoss: Number(expectedLossMap.get(ts) ?? 0),
            };
          }),
        );
        setRiskExposureData([
          { name: locale === 'vi' ? 'Rủi ro thấp' : 'Low risk', value: Number(distMap.low || 0) * 35 },
          { name: locale === 'vi' ? 'Rủi ro trung bình' : 'Medium risk', value: Number(distMap.medium || 0) * 65 },
          { name: locale === 'vi' ? 'Rủi ro cao' : 'High risk', value: Number(distMap.high || 0) * 100 },
        ]);
      } catch (err) {
        if (!cancelled) notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [locale, msgLocale, t]);

  const riskDataLocalized = riskData.map((x) => ({ ...x, name: t(`risk.level.${x.level}`) }));
  const totalCustomers = useMemo(() => riskData.reduce((sum, item) => sum + Number(item.value || 0), 0), [riskData]);
  const dominantRiskLevel = useMemo(() => {
    const sorted = [...riskData].sort((a, b) => b.value - a.value);
    return sorted[0]?.level || 'medium';
  }, [riskData]);

  return (
    <div className="motion-enter flex flex-col gap-5 lg:gap-6 p-4 sm:p-5 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.risk_dist.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.risk_dist.desc')}
        </p>
      </div>

      <div className="motion-stagger grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.risk_dist.level_title')}</CardTitle>
            <CardDescription>{t('portfolio.risk_dist.level_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={RECHART_MARGIN.pie}>
                <Pie
                  data={riskDataLocalized}
                  cx="50%"
                  cy="50%"
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {riskDataLocalized.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.risk_dist.score_title')}</CardTitle>
            <CardDescription>{t('portfolio.risk_dist.score_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistribution} margin={RECHART_MARGIN.barScoreBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tickMargin={8} height={40} tick={{ fontSize: 12 }} />
                <YAxis width={RECHART_Y_WIDTH.count} tickMargin={6} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" name={t('customers.count')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="motion-stagger grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{locale === 'vi' ? 'Xu hướng chất lượng danh mục' : 'Portfolio quality trend'}</CardTitle>
            <CardDescription>
              {locale === 'vi'
                ? 'Theo dõi Avg PD, NPL và tổn thất kỳ vọng theo thời gian.'
                : 'Track Avg PD, NPL and expected loss over time.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qualityTrendData} margin={RECHART_MARGIN.lineDualY}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} width={RECHART_Y_WIDTH.score} tickMargin={8} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => formatCompactVnd(Number(v), locale === 'vi' ? 'vi' : 'en')}
                  width={RECHART_Y_WIDTH.money}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'expectedLoss'
                      ? [formatCompactVnd(Number(value), locale === 'vi' ? 'vi' : 'en'), locale === 'vi' ? 'Tổn thất' : 'Expected loss']
                      : [`${Number(value).toFixed(2)}%`, name === 'avgPd' ? 'Avg PD' : 'NPL']
                  }
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avgPd" stroke="#6366f1" strokeWidth={2} name="Avg PD %" />
                <Line yAxisId="left" type="monotone" dataKey="npl" stroke="#fb7185" strokeWidth={2} name="NPL %" />
                <Line yAxisId="right" type="monotone" dataKey="expectedLoss" stroke="#22c1d6" strokeWidth={2} name={locale === 'vi' ? 'Tổn thất' : 'Expected loss'} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === 'vi' ? 'Điểm phơi nhiễm theo mức rủi ro' : 'Exposure index by risk level'}</CardTitle>
            <CardDescription>
              {locale === 'vi'
                ? 'Chỉ số so sánh phơi nhiễm tương đối giữa các nhóm rủi ro.'
                : 'Relative exposure index comparison across risk groups.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskExposureData} margin={RECHART_MARGIN.barScoreBuckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickMargin={8} />
                <YAxis width={RECHART_Y_WIDTH.count} tickMargin={6} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [value, locale === 'vi' ? 'Chỉ số phơi nhiễm' : 'Exposure index']} />
                <Bar dataKey="value" fill="#0ea5a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.risk_dist.stats_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { labelKey: 'customers.total', value: String(totalCustomers) },
              { labelKey: 'customers.avg_score', value: String(scoreStats.mean.toFixed(1)) },
              { labelKey: 'portfolio.risk_dist.median', value: String(scoreStats.median.toFixed(1)) },
              { labelKey: 'portfolio.risk_dist.std_dev', value: String(scoreStats.std_dev.toFixed(1)) },
              { labelKey: 'portfolio.risk_dist.risk_index', value: t(`risk.level.${dominantRiskLevel}`) },
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-4 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
