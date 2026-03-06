'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !isVerified) {
      verifyEmail(token);
    }
  }, [searchParams, isVerified]);

  const verifyEmail = async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/auth/register/verify-email?token=${token}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Email verification failed');
      }

      setIsVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <div className="flex items-center gap-2">
          <LanguageToggle variant="outline" />
          <ThemeToggle variant="outline" />
        </div>
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.svg"
            alt="CRAI DB"
            width={120}
            height={120}
            priority
          />
        </div>

        <Card className="border border-border">
          <CardHeader className="space-y-2 text-center">
            {isVerified ? (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <CardTitle className="text-2xl">{t("verify.verified_title")}</CardTitle>
                <CardDescription>
                  {t("verify.verified_desc")}
                </CardDescription>
              </>
            ) : isLoading ? (
              <>
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-12 w-12 text-accent animate-spin" />
                </div>
                <CardTitle className="text-2xl">{t("verify.verifying_title")}</CardTitle>
                <CardDescription>
                  {t("verify.verifying_desc")}
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl">{t("verify.check_title")}</CardTitle>
                <CardDescription>
                  {t("verify.check_desc")}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isVerified && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t("verify.active_notice")}
                </p>
                <Link href="/auth?mode=login" className="block">
                  <Button type="button" className="w-full">
                    {t("verify.go_sign_in")}
                  </Button>
                </Link>
              </div>
            )}

            {!isVerified && !isLoading && !error && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("verify.sent_1")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("verify.sent_2")}
                </p>
              </div>
            )}

            {!isVerified && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <Link href="/auth?mode=login" className="text-accent hover:underline font-medium">
                  {t("verify.back_sign_in")}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-accent animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{t("verify.loading")}</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
