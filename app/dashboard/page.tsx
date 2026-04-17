'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { extractRegistrationList, normalizeRegistrationRow } from '@/lib/admin/registration-list';
import { formatAlertMessageForDisplay } from '@/lib/alerts/alert-message-display';

type PortfolioKPI = {
  total_exposure: number;
  avg_pd: number;
  npl_ratio: number;
};

type PortfolioTrend = { points: Array<{ timestamp: string; value: number }> };
type RiskDistribution = { chart_data: Array<{ bucket: string; count?: number; value?: number }> };
type AlertItem = { alert_id: number; alert_type: string; severity: string; message: string; created_at: string; customer_name?: string | null };
type TrendRow = { timestamp: string; month: string; value: number };

function toTrendRows(series: PortfolioTrend | null | undefined, locale: string): TrendRow[] {
  return (series?.points || [])
    .map((item) => ({
      timestamp: String(item.timestamp || ''),
      month: formatDateVietnam(item.timestamp, locale, { month: 'short' }),
      value: Number(item.value || 0),
    }))
    .filter((x) => Boolean(x.timestamp));
}

function seriesValueByTimestamp(rows: TrendRow[]): Map<string, number> {
  return new Map(rows.map((r) => [r.timestamp, Number(r.value || 0)]));
}

function extractTotalCount(raw: unknown): number {
  if (raw == null) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw !== 'object') return 0;
  const rec = raw as Record<string, unknown>;
  const direct = rec.total ?? rec.total_count ?? rec.totalCount ?? rec.count;
  const n = Number(direct);
  if (Number.isFinite(n) && n >= 0) return n;
  const list =
    (Array.isArray(rec.items) && rec.items) ||
    (Array.isArray(rec.customers) && rec.customers) ||
    (Array.isArray(rec.data) && rec.data) ||
    (Array.isArray(rec.results) && rec.results) ||
    [];
  return Array.isArray(list) ? list.length : 0;
}

const KPICard = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-accent" />
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
  const [trendData, setTrendData] = useState<Array<{ month: string; value: number; avgPd: number; npl: number }>>([]);
  const [riskMixData, setRiskMixData] = useState<Array<{ level: string; count: number }>>([]);
  const [alertSeverityData, setAlertSeverityData] = useState<Array<{ level: string; count: number }>>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    const r = getUserRole();
    setRole(r);
    setRoleReady(true);

    let cancelled = false;
    const load = async () => {
      try {
        const [kpiData, exposureTrendResult, avgPdTrendResult, nplTrendResult, dist, alerts] = await Promise.all([
          browserApiFetchAuth<PortfolioKPI>('/portfolio/kpi', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=total_exposure&interval=month', { method: 'GET' }),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=avg_pd&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<PortfolioTrend>('/portfolio/trend?metric=npl_ratio&interval=month', { method: 'GET' }).catch(() => null),
          browserApiFetchAuth<RiskDistribution>('/portfolio/risk-distribution', { method: 'GET' }),
          browserApiFetchAuth<AlertItem[]>('/alerts?status=open', { method: 'GET' }),
        ]);
        if (cancelled) return;

        setKpi(kpiData);
        const distCountMap = Object.fromEntries(
          (dist.chart_data || []).map((x) => [String(x.bucket || '').toLowerCase(), Number(x.count ?? x.value ?? 0)]),
        );
        setRiskMixData([
          { level: 'low', count: Number(distCountMap.low || 0) },
          { level: 'medium', count: Number(distCountMap.medium || 0) },
          { level: 'high', count: Number(distCountMap.high || 0) },
        ]);

        const exposureRows = toTrendRows(exposureTrendResult, locale);
        const avgPdRows = toTrendRows(avgPdTrendResult, locale);
        const nplRows = toTrendRows(nplTrendResult, locale);
        const avgPdMap = seriesValueByTimestamp(avgPdRows);
        const nplMap = seriesValueByTimestamp(nplRows);

        setTrendData(
          exposureRows.map((item) => ({
            month: item.month,
            value: item.value,
            avgPd: Number(((avgPdMap.get(item.timestamp) ?? Number(kpiData?.avg_pd || 0)) * 100).toFixed(2)),
            npl: Number(((nplMap.get(item.timestamp) ?? Number(kpiData?.npl_ratio || 0)) * 100).toFixed(2)),
          })),
        );
        setRecentAlerts((alerts || []).slice(0, 4));
        setOpenAlertsCount((alerts || []).length);
        const sev = { high: 0, medium: 0, low: 0 };
        for (const a of alerts || []) {
          const level = String(a?.severity || '').toLowerCase();
          if (level in sev) sev[level as keyof typeof sev] += 1;
        }
        setAlertSeverityData([
          { level: locale === 'vi' ? 'Cao' : 'High', count: sev.high },
          { level: locale === 'vi' ? 'Trung bình' : 'Medium', count: sev.medium },
          { level: locale === 'vi' ? 'Thấp' : 'Low', count: sev.low },
        ]);

        if (r === 'admin') {
          const pendingPayload = await browserApiFetchAuth<unknown>(
            '/auth/register/list?status_filter=pending',
            { method: 'GET' },
          );
          if (!cancelled) {
            const pendingCount = extractRegistrationList(pendingPayload)
              .map((x) => normalizeRegistrationRow(x))
              .filter(Boolean).length;
            setPendingApprovalsCount(pendingCount);
          }
        }

        const customers = await browserApiFetchAuth<unknown>('/customers?page=1', { method: 'GET' });
        if (!cancelled) setCustomerCount(extractTotalCount(customers));
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
      {
        title: locale === 'vi' ? 'Giá trị danh mục' : 'Portfolio exposure',
        value: formatCompactVnd(Number(kpi?.total_exposure || 0), locale === 'vi' ? 'vi' : 'en'),
        icon: PieChart,
      },
      { title: locale === 'vi' ? 'Khách hàng' : 'Customers', value: String(customerCount), icon: Users },
      { title: locale === 'vi' ? 'Cảnh báo mở' : 'Open alerts', value: String(openAlertsCount), icon: AlertCircle },
      { title: role === 'admin' ? (locale === 'vi' ? 'Chờ phê duyệt' : 'Pending approvals') : (locale === 'vi' ? 'Sức khỏe hệ thống' : 'System health'), value: role === 'admin' ? String(pendingApprovalsCount) : health, icon: PieChart },
    ];
  }, [kpi?.avg_pd, kpi?.npl_ratio, kpi?.total_exposure, locale, customerCount, openAlertsCount, pendingApprovalsCount, role]);

  return (
    <div className="motion-enter flex flex-col gap-5 lg:gap-6 p-4 sm:p-5 lg:p-6">
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
          <div className="motion-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
            {cards.map((metric, idx) => (
              <KPICard key={idx} title={metric.title} value={metric.value} icon={metric.icon} />
            ))}
          </div>

          <div className="motion-stagger grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.chart_portfolio_trend_title')}</CardTitle>
                <CardDescription>{t('dashboard.chart_portfolio_trend_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={248}>
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
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={RECHART_Y_WIDTH.score}
                      tickMargin={8}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'value'
                          ? [
                              formatCompactVnd(Number(value), locale === 'vi' ? 'vi' : 'en'),
                              t('dashboard.chart_legend_portfolio_value'),
                            ]
                          : [`${Number(value).toFixed(2)}%`, name === 'avgPd' ? 'Avg PD' : 'NPL']
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
                      dataKey="avgPd"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name="Avg PD %"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="npl"
                      stroke="#fb7185"
                      strokeWidth={2}
                      name="NPL %"
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
              <CardContent className="space-y-3 pb-4">
                {recentAlerts.length === 0 ? (
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.no_open_alerts')}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>{t('dashboard.recent_alerts_col_name')}</span>
                      <span>{t('dashboard.recent_alerts_col_time')}</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto pr-1">
                    {recentAlerts.map((item) => (
                      <div
                        key={item.alert_id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/50 px-2 py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {item.customer_name ||
                              `${t('dashboard.customer_fallback')} #${item.alert_id}`}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {formatAlertMessageForDisplay(item.message, locale)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                          {formatDateTimeVietnam(item.created_at, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="motion-stagger grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {locale === 'vi' ? 'Phân bổ hồ sơ theo mức rủi ro' : 'Record distribution by risk level'}
                </CardTitle>
                <CardDescription>
                  {locale === 'vi'
                    ? 'Biểu đồ cho biết số lượng hồ sơ trong từng nhóm rủi ro thấp, trung bình và cao.'
                    : 'This chart shows how many records fall into low, medium, and high risk groups.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={riskMixData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="level"
                      tickFormatter={(v) => t(`risk.level.${String(v).toLowerCase()}`)}
                      tickMargin={8}
                    />
                    <YAxis width={RECHART_Y_WIDTH.count} tickMargin={6} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [value, locale === 'vi' ? 'Số lượng hồ sơ' : 'Record count']}
                      labelFormatter={(label) => t(`risk.level.${String(label).toLowerCase()}`)}
                    />
                    <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {locale === 'vi' ? 'Mức độ nghiêm trọng của cảnh báo mở' : 'Open alert severity breakdown'}
                </CardTitle>
                <CardDescription>
                  {locale === 'vi'
                    ? 'Biểu đồ cho biết số lượng cảnh báo theo mức độ: cao, trung bình, thấp để ưu tiên xử lý.'
                    : 'This chart summarizes open alerts by severity (high, medium, low) for prioritization.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={alertSeverityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="level" tickMargin={8} />
                    <YAxis width={RECHART_Y_WIDTH.count} tickMargin={6} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [value, locale === 'vi' ? 'Cảnh báo' : 'Alerts']} />
                    <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
