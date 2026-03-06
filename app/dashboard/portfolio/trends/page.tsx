'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/components/i18n-provider';

export default function PortfolioTrendsPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.trends.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.trends.desc')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('common.coming_soon')}</CardTitle>
          <CardDescription>
            {t('common.planned_integration')}{' '}
            <span className="font-mono">GET /portfolio/trend</span>.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
