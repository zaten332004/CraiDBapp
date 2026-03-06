'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/components/i18n-provider';

const portfolioMetrics = [
  { titleKey: 'portfolio.kpi.total_value', value: '$2.4M', change: '+5.2%' },
  { titleKey: 'portfolio.kpi.avg_score', value: '68.5', change: '+2.1%' },
  { titleKey: 'portfolio.kpi.customer_count', value: '335', change: '+8.3%' },
  { titleKey: 'portfolio.kpi.health', value: 'Good', change: 'Stable' },
] as const;

const trendData = [
  { month: 'Jan', value: 2100000, score: 65 },
  { month: 'Feb', value: 2200000, score: 67 },
  { month: 'Mar', value: 2150000, score: 66 },
  { month: 'Apr', value: 2300000, score: 68 },
  { month: 'May', value: 2350000, score: 69 },
  { month: 'Jun', value: 2400000, score: 68.5 },
];

const riskDistribution = [
  { level: 'low', value: 145, fill: '#10b981' },
  { level: 'medium', value: 120, fill: '#f59e0b' },
  { level: 'high', value: 70, fill: '#ef4444' },
] as const;

const sectorBreakdown = [
  { sectorKey: 'portfolio.sector.technology', percentage: 28 },
  { sectorKey: 'portfolio.sector.finance', percentage: 22 },
  { sectorKey: 'portfolio.sector.healthcare', percentage: 18 },
  { sectorKey: 'portfolio.sector.manufacturing', percentage: 16 },
  { sectorKey: 'portfolio.sector.retail', percentage: 10 },
  { sectorKey: 'portfolio.sector.other', percentage: 6 },
] as const;

export default function PortfolioOverviewPage() {
  const { t } = useI18n();
  const riskDistributionLocalized = riskDistribution.map((x) => ({ ...x, name: t(`risk.level.${x.level}`) }));
  const sectorBreakdownLocalized = sectorBreakdown.map((x) => ({ ...x, sector: t(x.sectorKey) }));

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.overview.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.overview.desc')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioMetrics.map((metric, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t(metric.titleKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-accent mt-1">{metric.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Portfolio Trend */}
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.trend_title')}</CardTitle>
            <CardDescription>
              {t('portfolio.overview.trend_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  name={t('portfolio.overview.legend_value')}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name={t('portfolio.overview.legend_avg_score')}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.risk_dist_title')}</CardTitle>
            <CardDescription>
              {t('portfolio.overview.risk_dist_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistributionLocalized}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistributionLocalized.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sector Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.overview.sector_title')}</CardTitle>
          <CardDescription>
            {t('portfolio.overview.sector_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorBreakdownLocalized}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="percentage" fill="#06b6d4" name={t('portfolio.overview.legend_pct')} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.performance_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { labelKey: 'portfolio.overview.metric_roi', value: '8.5%', status: 'positive' },
              { labelKey: 'portfolio.overview.metric_default_rate', value: '0.8%', status: 'positive' },
              { labelKey: 'portfolio.overview.metric_avg_term', value: t('portfolio.overview.metric_avg_term_value'), status: 'neutral' },
              { labelKey: 'portfolio.overview.metric_liquidity', value: '7.2/10', status: 'neutral' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t(item.labelKey)}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.overview.top_risks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { customer: 'CUST-001', score: 35, status: 'critical' },
              { customer: 'CUST-045', score: 42, status: 'high' },
              { customer: 'CUST-089', score: 48, status: 'high' },
              { customer: 'CUST-102', score: 54, status: 'medium' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between pb-3 border-b last:border-0 last:pb-0">
                <span className="text-sm font-medium">{item.customer}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.score}</span>
                  <Badge
                    variant={item.status === 'critical' ? 'destructive' : item.status === 'high' ? 'default' : 'secondary'}
                  >
                    {t(`severity.${item.status}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
