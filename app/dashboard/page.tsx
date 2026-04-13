'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, AlertCircle, PieChart } from 'lucide-react';
import { getUserRole, type UserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError } from '@/lib/notify';
import { formatDateTimeVietnam, formatDateVietnam } from '@/lib/datetime';
import { formatCompactVnd } from '@/lib/money';
import { RECHART_MARGIN, RECHART_Y_WIDTH } from '@/lib/recharts-layout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { extractRegistrationList, normalizeRegistrationRow, type RegistrationRow } from '@/lib/admin/registration-list';
import { cn } from '@/lib/utils';

type PortfolioKPI = {
  total_exposure: number;
  avg_pd: number;
  expected_loss: number;
  npl_ratio: number;
  var_99: number;
};

type PortfolioTrend = { points: Array<{ timestamp: string; value: number }> };
type RiskDistribution = { chart_data: Array<{ bucket: string; count?: number }> };
type AlertItem = { alert_id: number; alert_type: string; severity: string; message: string; created_at: string; customer_name?: string | null };

const KPICard = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-accent" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

function roleLabel(role: UserRole | null, t: (key: string) => string) {
  switch (role) {
    case 'admin':
      return t('role.admin');
    case 'manager':
      return t('role.manager');
    case 'analyst':
      return t('role.analyst');
    case 'viewer':
      return t('role.viewer');
    default:
      return '—';
  }
}

export default function DashboardPage() {
  /** SSR + first paint: null — tránh lệch hydration với getUserRole() chỉ có trên client. */
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const { locale, t } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [kpi, setKpi] = useState<PortfolioKPI | null>(null);
  const [trendData, setTrendData] = useState<Array<{ month: string; value: number; score: number }>>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingAccounts, setPendingAccounts] = useState<RegistrationRow[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    const r = getUserRole();
    setRole(r);
    setRoleReady(true);

    let cancelled = false;
    const load = async () => {
      try {
        const [kpiData, trend, dist, alerts] = await Promise.all([
          browserApiFetchAuth<PortfolioKPI>('/portfolio/kpi', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=total_exposure&interval=month', { method: 'GET' }),
          browserApiFetchAuth<RiskDistribution>('/portfolio/risk-distribution', { method: 'GET' }),
          browserApiFetchAuth<AlertItem[]>('/alerts?status=open', { method: 'GET' }),
        ]);
        if (cancelled) return;

        setKpi(kpiData);
        const distCountMap = Object.fromEntries((dist.chart_data || []).map((x) => [x.bucket, Number(x.count || 0)]));
        const total = Math.max(1, Number(distCountMap.low || 0) + Number(distCountMap.medium || 0) + Number(distCountMap.high || 0));
        const avgScore = ((Number(distCountMap.low || 0) * 85) + (Number(distCountMap.medium || 0) * 65) + (Number(distCountMap.high || 0) * 35)) / total;
        setTrendData((trend.points || []).map((item) => ({
          month: formatDateVietnam(item.timestamp, locale, { month: 'short' }),
          value: Number(item.value || 0),
          score: Number(avgScore.toFixed(1)),
        })));
        setRecentAlerts((alerts || []).slice(0, 4));
        setOpenAlertsCount((alerts || []).length);

        if (r === 'admin') {
          const [pendingPayload, activeUsers] = await Promise.all([
            browserApiFetchAuth<unknown>('/auth/register/list?status_filter=pending', { method: 'GET' }),
            browserApiFetchAuth<any[]>('/admin/users?status_filter=active', { method: 'GET' }),
          ]);
          if (!cancelled) {
            const pendingRows = extractRegistrationList(pendingPayload)
              .map((x) => normalizeRegistrationRow(x))
              .filter(Boolean) as RegistrationRow[];
            pendingRows.sort((a, b) => {
              const ta = Date.parse(String(a.requestedAt || ''));
              const tb = Date.parse(String(b.requestedAt || ''));
              return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
            });
            setPendingAccounts(pendingRows);
            setPendingApprovalsCount(pendingRows.length);
            setActiveUsersCount((activeUsers || []).length);
          }
        } else if (!cancelled) {
          setPendingAccounts([]);
        }

        const customers = await browserApiFetchAuth<{ total: number }>('/customers?page=1', { method: 'GET' });
        if (!cancelled) setCustomerCount(Number(customers?.total || 0));
      } catch (err) {
        if (!cancelled) notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [locale, msgLocale, t]);

  const cards = useMemo(() => {
    const portfolioScore = Math.round((1 - Number(kpi?.avg_pd || 0)) * 100);
    const health = (Number(kpi?.npl_ratio || 0) < 0.1)
      ? (locale === 'vi' ? 'Tốt' : 'Good')
      : (Number(kpi?.npl_ratio || 0) < 0.2 ? (locale === 'vi' ? 'Theo dõi' : 'Watch') : (locale === 'vi' ? 'Rủi ro' : 'Risk'));
    return [
      { title: locale === 'vi' ? 'Điểm danh mục' : 'Portfolio score', value: String(portfolioScore), icon: TrendingUp },
      { title: locale === 'vi' ? 'Khách hàng' : 'Customers', value: String(customerCount), icon: Users },
      { title: locale === 'vi' ? 'Cảnh báo mở' : 'Open alerts', value: String(openAlertsCount), icon: AlertCircle },
      { title: role === 'admin' ? (locale === 'vi' ? 'Chờ phê duyệt' : 'Pending approvals') : (locale === 'vi' ? 'Sức khỏe hệ thống' : 'System health'), value: role === 'admin' ? String(pendingApprovalsCount) : health, icon: PieChart },
      ...(role === 'admin' ? [{ title: locale === 'vi' ? 'Người dùng hoạt động' : 'Active users', value: String(activeUsersCount), icon: Users }] : []),
    ];
  }, [kpi?.avg_pd, kpi?.npl_ratio, locale, customerCount, openAlertsCount, pendingApprovalsCount, activeUsersCount, role]);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {roleReady ? `${t('dashboard.welcome')} - ${roleLabel(role, t)}` : t('dashboard.welcome')}
        </p>
      </div>

      {!roleReady ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[92px] rounded-xl border border-border/60 bg-muted/30 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.slice(0, 4).map((metric, idx) => (
              <KPICard key={idx} title={metric.title} value={metric.value} icon={metric.icon} />
            ))}
          </div>

          {role === 'admin' ? (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>{t('dashboard.pending_accounts_title')}</CardTitle>
                  <CardDescription>{t('dashboard.pending_accounts_desc')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <Link href="/dashboard/admin/registrations">{t('dashboard.pending_view_all')}</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {pendingAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.pending_accounts_empty')}</p>
                ) : (
                  <div className="max-h-[min(24rem,55vh)] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('dashboard.pending_col_display')}</TableHead>
                          <TableHead>{t('dashboard.pending_col_email')}</TableHead>
                          <TableHead>{t('dashboard.pending_col_role')}</TableHead>
                          <TableHead className="whitespace-nowrap">{t('dashboard.pending_col_requested')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingAccounts.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div>
                                {r.fullName ? <p className="font-medium text-foreground">{r.fullName}</p> : null}
                                <p
                                  className={cn(
                                    'font-mono text-sm',
                                    r.fullName ? 'text-xs text-muted-foreground' : 'font-medium text-foreground',
                                  )}
                                >
                                  {r.name}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{r.email}</TableCell>
                            <TableCell className="text-sm">
                              {r.type === 'manager' ? t('role.manager') : t('role.analyst')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                              {formatDateTimeVietnam(r.requestedAt ?? '', locale)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.chart_portfolio_trend_title')}</CardTitle>
                <CardDescription>{t('dashboard.chart_portfolio_trend_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData} margin={RECHART_MARGIN.lineDualY}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickMargin={8} />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => formatCompactVnd(Number(v), locale === 'vi' ? 'vi' : 'en')}
                      width={RECHART_Y_WIDTH.money}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis yAxisId="right" orientation="right" width={RECHART_Y_WIDTH.score} tickMargin={8} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'value'
                          ? [
                              formatCompactVnd(Number(value), locale === 'vi' ? 'vi' : 'en'),
                              t('dashboard.chart_legend_portfolio_value'),
                            ]
                          : [value, t('dashboard.chart_legend_avg_score')]
                      }
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="value"
                      stroke="#0ea5a6"
                      strokeWidth={2}
                      name={t('dashboard.chart_legend_portfolio_value')}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name={t('dashboard.chart_legend_avg_score')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recent_alerts_title')}</CardTitle>
                <CardDescription>{t('dashboard.recent_alerts_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.no_open_alerts')}
                  </p>
                ) : (
                  recentAlerts.map((item) => (
                    <div
                      key={item.alert_id}
                      className="flex items-center justify-between pb-3 border-b last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {item.customer_name ||
                            `${t('dashboard.customer_fallback')} #${item.alert_id}`}
                        </p>
                        <p className="text-sm text-muted-foreground">{item.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeVietnam(item.created_at, locale)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
