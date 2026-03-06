'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';

export default function ForbiddenPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("common.access_denied")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("forbidden.desc")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("forbidden.card_title")}</CardTitle>
          <CardDescription>
            {t("forbidden.card_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button>{t("common.back_to_dashboard")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
