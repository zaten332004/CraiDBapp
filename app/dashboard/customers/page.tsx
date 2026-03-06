'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus } from 'lucide-react';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';

const getRiskBadge = (level: string) => {
  const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
  };
  return variants[level] || 'default';
};

export default function CustomersPage() {
  const { t } = useI18n();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const [customers, setCustomers] = useState([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      riskLevel: 'low',
      score: 85,
      status: 'active',
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      riskLevel: 'medium',
      score: 65,
      status: 'active',
    },
    {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      riskLevel: 'high',
      score: 35,
      status: 'active',
    },
    {
      id: '4',
      name: 'Alice Brown',
      email: 'alice@example.com',
      riskLevel: 'low',
      score: 88,
      status: 'active',
    },
  ]);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const riskLabel = (level: string) => {
    switch (level) {
      case 'low':
        return t('risk.level.low');
      case 'medium':
        return t('risk.level.medium');
      case 'high':
        return t('risk.level.high');
      default:
        return level;
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.email.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === 'all' || customer.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('customers.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('customers.desc')}
          </p>
        </div>
        {!isViewer && (
          <Button asChild>
            <Link href="/dashboard/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('customers.add')}
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('customers.search_ph')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('customers.risk_filter_all')}</SelectItem>
                <SelectItem value="low">{t('risk.level.low')}</SelectItem>
                <SelectItem value="medium">{t('risk.level.medium')}</SelectItem>
                <SelectItem value="high">{t('risk.level.high')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('customers.list_title')}</CardTitle>
          <CardDescription>
            {t('common.showing')} {filteredCustomers.length} {t('customers.items')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.email')}</TableHead>
                  <TableHead>{t('customers.risk_level')}</TableHead>
                  <TableHead>{t('customers.risk_score')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadge(customer.riskLevel)}>
                        {riskLabel(customer.riskLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.score}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`status.${customer.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="text-accent hover:underline text-sm font-medium"
                      >
                        {t('common.view')}
                      </Link>
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
