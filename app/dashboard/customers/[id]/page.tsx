'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Edit } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';

const scoreHistory = [
  { date: 'Jan 1', score: 72 },
  { date: 'Jan 8', score: 75 },
  { date: 'Jan 15', score: 73 },
  { date: 'Jan 22', score: 78 },
  { date: 'Jan 29', score: 82 },
  { date: 'Feb 5', score: 80 },
];

export default function CustomerDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const customerId = params.id;

  const customer = {
    id: customerId,
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    company: 'Tech Innovations Inc.',
    riskLevel: 'low',
    score: 85,
    status: 'active',
    createdAt: '2024-01-15',
    lastScored: '2024-02-05',
  };

  const activityItems = [
    { actionKey: 'customers.detail.activity.score_updated', detailsKey: 'customers.detail.activity.score_updated_desc', date: '2024-02-05' },
    { actionKey: 'customers.detail.activity.profile_reviewed', detailsKey: 'customers.detail.activity.profile_reviewed_desc', date: '2024-02-01' },
    { actionKey: 'customers.detail.activity.data_imported', detailsKey: 'customers.detail.activity.data_imported_desc', date: '2024-01-28' },
    { actionKey: 'customers.detail.activity.account_created', detailsKey: 'customers.detail.activity.account_created_desc', date: '2024-01-15' },
  ];

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.name}</h1>
            <p className="text-muted-foreground mt-1">{customer.company}</p>
          </div>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          {t('customers.detail.edit')}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('customers.detail.risk_score')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customer.score}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('common.as_of')} {customer.lastScored}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('customers.detail.risk_level')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {t(`risk.level.${customer.riskLevel}`)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('common.status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">
              {t(`status.${customer.status}`)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('customers.detail.member_since')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{customer.createdAt}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t('common.overview')}</TabsTrigger>
          <TabsTrigger value="history">{t('common.history')}</TabsTrigger>
          <TabsTrigger value="scores">{t('customers.detail.score_analysis')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('customers.detail.info_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.email')}</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.phone')}</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.company')}</p>
                  <p className="font-medium">{customer.company}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                  <p className="font-medium">{t(`status.${customer.status}`)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('customers.detail.activity_title')}</CardTitle>
              <CardDescription>{t('customers.detail.activity_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{t(item.actionKey)}</p>
                      <p className="text-sm text-muted-foreground">{t(item.detailsKey)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('customers.detail.score_trend')}</CardTitle>
              <CardDescription>{t('customers.detail.score_trend_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    name={t('customers.detail.risk_score')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
