'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { RECHART_MARGIN, RECHART_Y_WIDTH } from '@/lib/recharts-layout';

type RiskDistributionResponse = {
  chart_data: Array<{ bucket: string; value: number; count?: number }>;
  score_buckets?: Array<{ range: string; count: number }>;
  score_stats?: { mean?: number; median?: number; std_dev?: number };
};

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const dist = await browserApiFetchAuth<RiskDistributionResponse>('/portfolio/risk-distribution', { method: 'GET' });
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
      } catch (err) {
        if (!cancelled) notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [msgLocale, t]);

  const riskDataLocalized = riskData.map((x) => ({ ...x, name: t(`risk.level.${x.level}`) }));
  const totalCustomers = useMemo(() => riskData.reduce((sum, item) => sum + Number(item.value || 0), 0), [riskData]);
  const dominantRiskLevel = useMemo(() => {
    const sorted = [...riskData].sort((a, b) => b.value - a.value);
    return sorted[0]?.level || 'medium';
  }, [riskData]);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.risk_dist.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.risk_dist.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
