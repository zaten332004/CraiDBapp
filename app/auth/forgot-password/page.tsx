'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/components/i18n-provider';
import { isNumericPin, isStrongPassword, isValidEmail, passwordRuleMessage } from '@/lib/validation/account';

type Step = 'request' | 'confirm';

export default function ForgotPasswordPage() {
  const { locale } = useI18n();
  const isVi = locale === 'vi';

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pageTitle = useMemo(
    () => (isVi ? 'Quên mật khẩu' : 'Forgot Password'),
    [isVi],
  );

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!isValidEmail(email)) {
      setError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể bắt đầu quy trình đổi mật khẩu bằng PIN.' : 'Could not start PIN reset flow.'));
      }
      setMessage(data?.message || (isVi ? 'Tiếp tục bằng cách nhập mã PIN 6 số của tài khoản.' : 'Continue by entering your account 6-digit PIN.'));
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isVi ? 'Đã có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!isValidEmail(email)) {
      setError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }
    if (!isNumericPin(code, 6)) {
      setError(isVi ? 'Mã PIN chỉ được chứa chữ số và gồm đúng 6 số.' : 'PIN must contain digits only and be exactly 6 digits.');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setError(passwordRuleMessage(isVi));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isVi ? 'Mật khẩu xác nhận không khớp.' : 'Password confirmation does not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/forgot-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          new_password: newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể đặt lại mật khẩu.' : 'Failed to reset password.'));
      }
      setMessage(data?.message || (isVi ? 'Đổi mật khẩu thành công.' : 'Password reset successfully.'));
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isVi ? 'Đã có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4 md:left-6 md:top-6">
        <Link href="/" aria-label="Go to homepage" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Image src="/logo.svg" alt="CRAI DB" width={44} height={44} priority />
          <span className="hidden sm:inline font-semibold tracking-tight text-foreground">CRAI_DB</span>
        </Link>
      </div>
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <div className="flex items-center gap-2">
          <LanguageToggle variant="outline" />
          <ThemeToggle variant="outline" />
        </div>
      </div>

      <Card className="w-full max-w-xl border border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">{pageTitle}</CardTitle>
          <CardDescription>
            {isVi
              ? 'Nhập email, sau đó xác nhận bằng mã PIN 6 số để đổi mật khẩu.'
              : 'Enter your email, then use your 6-digit PIN to reset password.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {step === 'request' ? (
            <form className="space-y-4" onSubmit={requestCode}>
              <div className="space-y-1.5">
                <Label htmlFor="email">{isVi ? 'Email đã đăng ký' : 'Registered email'}</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (isVi ? 'Đang xử lý...' : 'Processing...') : (isVi ? 'Tiếp tục với PIN' : 'Continue with PIN')}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={confirmReset}>
              <div className="space-y-1.5">
                <Label htmlFor="email-confirm">{isVi ? 'Email đã đăng ký' : 'Registered email'}</Label>
                <div className="relative">
                  <Input
                    id="email-confirm"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">{isVi ? 'Mã PIN 6 số' : '6-digit PIN'}</Label>
                <div className="relative">
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={isVi ? 'Nhập mã PIN 6 số' : 'Enter 6-digit PIN'}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{isVi ? 'Mật khẩu mới' : 'New password'}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
                  />
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">{isVi ? 'Xác nhận mật khẩu mới' : 'Confirm new password'}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => setStep('request')} disabled={loading}>
                  {isVi ? 'Gửi lại mã' : 'Request new code'}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (isVi ? 'Đang cập nhật...' : 'Updating...') : (isVi ? 'Đổi mật khẩu' : 'Reset password')}
                </Button>
              </div>
            </form>
          )}

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <Link href="/auth?mode=login" className="font-medium text-accent hover:underline">
              {isVi ? 'Quay lại đăng nhập' : 'Back to sign in'}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

