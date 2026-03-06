'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';

const alerts = [
  {
    id: '1',
    typeKey: 'alerts.type.high_risk_score',
    customer: 'CUST-001',
    severity: 'critical',
    status: 'open',
    createdAt: '2024-02-05 10:30 AM',
    descriptionKey: 'alerts.desc.score_increased_35',
  },
  {
    id: '2',
    typeKey: 'alerts.type.default_risk',
    customer: 'CUST-045',
    severity: 'high',
    status: 'open',
    createdAt: '2024-02-04 02:15 PM',
    descriptionKey: 'alerts.desc.missed_2_payments',
  },
  {
    id: '3',
    typeKey: 'alerts.type.policy_change',
    customer: 'CUST-089',
    severity: 'medium',
    status: 'resolved',
    createdAt: '2024-02-03 08:45 AM',
    descriptionKey: 'alerts.desc.reg_update_review',
  },
  {
    id: '4',
    typeKey: 'alerts.type.score_improvement',
    customer: 'CUST-102',
    severity: 'low',
    status: 'resolved',
    createdAt: '2024-02-02 06:20 PM',
    descriptionKey: 'alerts.desc.score_improved_82',
  },
];

const getSeverityVariant = (severity: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
};

export default function AlertsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true;
    return alert.status === filter;
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('alerts.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('alerts.desc')}
          </p>
        </div>
        <Badge variant="destructive" className="text-lg px-4 py-2">
          {alerts.filter((a) => a.status === 'open').length} {t('status.open')}
        </Badge>
      </div>

      {/* Alerts Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { titleKey: 'alerts.total', count: alerts.length, variant: 'outline' as const },
          { titleKey: 'status.open', count: alerts.filter((a) => a.status === 'open').length, variant: 'destructive' as const },
          { titleKey: 'status.resolved', count: alerts.filter((a) => a.status === 'resolved').length, variant: 'secondary' as const },
          { titleKey: 'severity.critical', count: alerts.filter((a) => a.severity === 'critical').length, variant: 'destructive' as const },
        ].map((item, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t(item.titleKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t('alerts.active')}</CardTitle>
            <CardDescription>
              {t('common.showing')} {filteredAlerts.length} {t('alerts.items')}
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="open">{t('status.open')}</SelectItem>
              <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
              <SelectItem value="pending">{t('status.pending')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>{t('alerts.type')}</TableHead>
                  <TableHead>{t('alerts.customer')}</TableHead>
                  <TableHead>{t('alerts.severity')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{getStatusIcon(alert.status)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t(alert.typeKey)}</p>
                        <p className="text-sm text-muted-foreground">{t(alert.descriptionKey)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{alert.customer}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityVariant(alert.severity)}>
                        {t(`severity.${alert.severity}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.status === 'open' ? 'destructive' : 'secondary'}>
                        {t(`status.${alert.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{alert.createdAt}</TableCell>
                    <TableCell className="text-right">
                      {alert.status === 'open' && (
                        <Button variant="ghost" size="sm" className="text-accent hover:text-accent">
                          {t('alerts.resolve')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
