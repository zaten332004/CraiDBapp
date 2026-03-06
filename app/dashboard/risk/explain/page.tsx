'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';

export default function RiskExplainPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.explain.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.explain.desc')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('common.coming_soon')}</CardTitle>
          <CardDescription>
            {t('risk.explain.integration_prefix')}{' '}
            <span className="font-mono">GET /risk/explain/{'{customer_id}'}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard/risk/score">
            <Button>{t('risk.explain.go_to_scoring')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
