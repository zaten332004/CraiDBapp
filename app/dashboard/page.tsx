'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, AlertCircle, PieChart } from 'lucide-react';
import { getUserRole, type UserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';

const chartData = [
  { month: 'Jan', score: 65, trend: 4000 },
  { month: 'Feb', score: 72, trend: 3000 },
  { month: 'Mar', score: 68, trend: 2000 },
  { month: 'Apr', score: 75, trend: 2780 },
  { month: 'May', score: 80, trend: 1890 },
  { month: 'Jun', score: 78, trend: 2390 },
];

const KPICard = ({ title, value, icon: Icon, change }: any) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-accent" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        {change > 0 ? '+' : ''}{change}% from last month
      </p>
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
  const role = getUserRole();
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('dashboard.welcome')} - {roleLabel(role, t)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'admin' ? (
          <>
            <KPICard title="System Health" value="OK" icon={TrendingUp} change={0.0} />
            <KPICard title="Pending Approvals" value="3" icon={AlertCircle} change={-1.0} />
            <KPICard title="Active Users" value="128" icon={Users} change={4.2} />
            <KPICard title="Risk Alerts" value="12" icon={PieChart} change={2.1} />
          </>
        ) : role === 'manager' ? (
          <>
            <KPICard title="Portfolio KPI" value="72.5" icon={TrendingUp} change={2.5} />
            <KPICard title="Total Customers" value="1,234" icon={Users} change={12.5} />
            <KPICard title="High Risk Cases" value="45" icon={AlertCircle} change={-5.2} />
            <KPICard title="Diversification" value="8.2/10" icon={PieChart} change={1.8} />
          </>
        ) : role === 'viewer' ? (
          <>
            <KPICard title="Portfolio KPI" value="72.5" icon={TrendingUp} change={2.5} />
            <KPICard title="Total Customers" value="1,234" icon={Users} change={12.5} />
            <KPICard title="Risk Alerts" value="12" icon={AlertCircle} change={2.1} />
            <KPICard title="Reports" value="8" icon={PieChart} change={1.2} />
          </>
        ) : (
          <>
            <KPICard title="Average Risk Score" value="72.5" icon={TrendingUp} change={2.5} />
            <KPICard title="Total Customers" value="1,234" icon={Users} change={12.5} />
            <KPICard title="High Risk Cases" value="45" icon={AlertCircle} change={-5.2} />
            <KPICard title="Portfolio Diversity" value="8.2/10" icon={PieChart} change={1.8} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Average Risk Scores Over Time</CardTitle>
            <CardDescription>
              Monthly average credit risk scores for your portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  name="Risk Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Trend</CardTitle>
            <CardDescription>
              Historical portfolio metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="trend"
                  fill="var(--chart-2)"
                  name="Portfolio Value"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {role !== 'viewer' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions and events in your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Customer Added', details: 'John Smith - Risk Score: 75', time: '2 hours ago' },
                { action: 'Risk Score Updated', details: 'Portfolio average increased to 72.5', time: '4 hours ago' },
                { action: 'Alert Generated', details: 'High risk customer detected', time: '1 day ago' },
                { action: 'Report Generated', details: 'Monthly portfolio analysis complete', time: '2 days ago' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.details}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
