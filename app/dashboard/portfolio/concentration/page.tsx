'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/components/i18n-provider';

export default function PortfolioConcentrationPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.concentration.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.concentration.desc')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('common.coming_soon')}</CardTitle>
          <CardDescription>
            {t('common.planned_integration')}{' '}
            <span className="font-mono">GET /portfolio/concentration</span>.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
