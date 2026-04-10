'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2, Mail, ShieldCheck, CircleCheckBig, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const email = searchParams.get('email') || '';

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

  const resendVerification = async () => {
    if (!email) return;
    setResending(true);
    setResendMessage('');
    setError('');
    try {
      const response = await fetch('/api/v1/auth/register/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || data?.message || (locale === 'vi' ? 'Gửi lại email thất bại.' : 'Failed to resend verification email.'));
      }
      const data = await response.json().catch(() => ({}));
      setResendMessage(data?.message || (locale === 'vi' ? 'Đã gửi lại email xác minh.' : 'Verification email resent.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : (locale === 'vi' ? 'Có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <div className="flex items-center gap-2">
          <LanguageToggle variant="outline" />
          <ThemeToggle variant="outline" />
        </div>
      </div>
      <div className="w-full max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/logo.svg" alt="CRAI DB" width={42} height={42} priority />
          <span className="text-xl font-semibold tracking-tight">CRAI_DB</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border">
            <CardHeader>
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                {isVerified ? (locale === 'vi' ? 'Đã xác minh' : 'Verified') : (locale === 'vi' ? 'Đang chờ xác minh' : 'Pending verification')}
              </div>
              <CardTitle className="text-4xl tracking-tight">{locale === 'vi' ? 'Xác minh email' : 'Verify email'}</CardTitle>
              <CardDescription>
                {locale === 'vi'
                  ? 'Xác nhận email để kích hoạt tài khoản và tiếp tục sử dụng hệ thống.'
                  : 'Confirm your email to activate your account and continue.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: Mail, label: locale === 'vi' ? 'Mở email xác minh' : 'Open verification email' },
                  { icon: ShieldCheck, label: locale === 'vi' ? 'Nhấn vào liên kết xác minh' : 'Click verification link' },
                  { icon: CircleCheckBig, label: locale === 'vi' ? 'Đăng nhập sau khi xác minh' : 'Sign in after verification' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border p-4">
                    <item.icon className="h-5 w-5 text-accent mb-3" />
                    <p className="font-medium">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border p-4 text-muted-foreground">
                <p className="font-medium text-foreground mb-2">{locale === 'vi' ? 'Kiểm tra hộp thư' : 'Check your inbox'}</p>
                <p>{locale === 'vi' ? 'Chúng tôi đã gửi liên kết xác minh đến email của bạn. Hãy mở email và nhấn vào liên kết để tiếp tục.' : 'We sent a verification link to your email. Open it and click the link to continue.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-5xl tracking-tight">{locale === 'vi' ? 'Kiểm tra hộp thư' : 'Check your inbox'}</CardTitle>
              <CardDescription>
                {locale === 'vi' ? 'Chúng tôi đã gửi liên kết xác minh đến email của bạn.' : 'We sent a verification link to your email.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {resendMessage && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{resendMessage}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{locale === 'vi' ? 'Email đã đăng ký' : 'Registered email'}</p>
                <p className="text-lg font-semibold break-all">{email || (locale === 'vi' ? 'Không có' : 'N/A')}</p>
              </div>
              {!isVerified && (
                <div className="rounded-xl border p-4">
                  <p className="font-medium mb-2">{locale === 'vi' ? 'Không nhận được email xác minh?' : "Didn't receive verification email?"}</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {locale === 'vi' ? 'Bạn có thể yêu cầu hệ thống gửi lại thêm một email xác minh đến địa chỉ đã đăng ký.' : 'You can request another verification email to the registered address.'}
                  </p>
                  <Button type="button" variant="outline" className="w-full" onClick={resendVerification} disabled={resending || !email}>
                    {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {locale === 'vi' ? 'Gửi lại email xác minh' : 'Resend verification email'}
                  </Button>
                </div>
              )}
              <Link href="/auth?mode=login" className="block">
                <Button type="button" className="w-full">
                  {locale === 'vi' ? 'Quay lại đăng nhập' : 'Back to sign in'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
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
