'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/components/i18n-provider';
import { isNumericPin, isStrongPassword, isValidEmail, passwordRuleMessage } from '@/lib/validation/account';
import { notifyError, notifySuccess } from '@/lib/notify';
import { clearAccessToken } from '@/lib/auth/token';

type Step = 'request' | 'confirm';

export default function ForgotPasswordPage() {
  const { locale, t } = useI18n();
  const isVi = locale === 'vi';

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingNewPin, setPendingNewPin] = useState(false);
  const [refreshingPinStatus, setRefreshingPinStatus] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const pageTitle = useMemo(
    () => (isVi ? 'Quên mật khẩu' : 'Forgot Password'),
    [isVi],
  );

  /** Full navigation after clearing cookies so middleware does not send logged-in users away from /auth. */
  const goToLogin = useCallback(() => {
    clearAccessToken();
    window.location.assign('/auth?mode=login');
  }, []);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      notifyError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
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
      notifySuccess(data?.message || (isVi ? 'Tiếp tục bằng cách nhập mã PIN 6 số của tài khoản.' : 'Continue by entering your account 6-digit PIN.'));
      setStep('confirm');
      await refreshPinRequestStatus(email);
    } catch (err) {
      notifyError(isVi ? 'Không thể gửi yêu cầu khôi phục mật khẩu.' : 'Could not send password reset request.', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      notifyError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }
    if (!isNumericPin(code, 6)) {
      notifyError(isVi ? 'Mã PIN chỉ được chứa chữ số và gồm đúng 6 số.' : 'PIN must contain digits only and be exactly 6 digits.');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      notifyError(passwordRuleMessage(isVi));
      return;
    }
    if (newPassword !== confirmPassword) {
      notifyError(isVi ? 'Mật khẩu xác nhận không khớp.' : 'Password confirmation does not match.');
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
      notifySuccess(data?.message || (isVi ? 'Đổi mật khẩu thành công.' : 'Password reset successfully.'));
      clearAccessToken();
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notifyError(isVi ? 'Không thể đặt lại mật khẩu.' : 'Failed to reset password.', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  const refreshPinRequestStatus = async (targetEmail: string) => {
    if (!isValidEmail(targetEmail)) return;
    try {
      const response = await fetch(`/api/v1/auth/forgot-pin/status?email=${encodeURIComponent(targetEmail.trim())}`, {
        method: 'GET',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      setPendingNewPin(Boolean(data?.has_pending_request));
    } catch {
      // best-effort only
    }
  };

  const handleRefreshPinStatus = async () => {
    const target = email.trim();
    if (!isValidEmail(target)) {
      notifyError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }
    setRefreshingPinStatus(true);
    try {
      await refreshPinRequestStatus(target);
      notifySuccess(isVi ? 'Đã làm mới trạng thái mã PIN.' : 'PIN status refreshed.');
    } finally {
      setRefreshingPinStatus(false);
    }
  };

  const requestForgotPin = async () => {
    if (!isValidEmail(email)) {
      notifyError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/forgot-pin/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể gửi yêu cầu quên mã PIN.' : 'Could not submit forgot PIN request.'));
      }
      setPendingNewPin(true);
      notifySuccess(
        data?.message ||
          (isVi
            ? 'Đã gửi yêu cầu cấp mã PIN mới tới admin. Vui lòng chờ duyệt.'
            : 'Your request for a new PIN has been sent to admin. Please wait for review.'),
      );
    } catch (err) {
      notifyError(
        isVi ? 'Không thể gửi yêu cầu quên mã PIN.' : 'Could not submit forgot PIN request.',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'confirm') return;
    const target = email.trim();
    if (!target || !isValidEmail(target)) {
      setPendingNewPin(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshPinRequestStatus(target);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [step, email]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4 md:left-6 md:top-6">
        <Link href="/" aria-label={t('auth.aria_home')} className="flex items-center gap-2 hover:opacity-90 transition-opacity">
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
          {step === 'request' ? (
            <form className="space-y-4" onSubmit={requestCode}>
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  {isVi ? 'Email đã đăng ký' : 'Registered email'}
                </Label>
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
                <Label htmlFor="email-confirm" required>
                  {isVi ? 'Email đã đăng ký' : 'Registered email'}
                </Label>
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
                <Label htmlFor="code" required>
                  {pendingNewPin ? (isVi ? 'Mã PIN mới' : 'New PIN code') : (isVi ? 'Mã PIN 6 số' : '6-digit PIN')}
                </Label>
                <div className="relative">
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={pendingNewPin ? (isVi ? 'Nhập mã PIN mới' : 'Enter new PIN code') : (isVi ? 'Nhập mã PIN 6 số' : 'Enter 6-digit PIN')}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs sm:text-sm"
                    onClick={() => void requestForgotPin()}
                    disabled={loading || pendingNewPin}
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    {pendingNewPin
                      ? (isVi ? 'Đã gửi yêu cầu cấp mã PIN mới' : 'New PIN request submitted')
                      : (isVi ? 'Quên mã PIN? Gửi yêu cầu cho admin' : 'Forgot PIN? Send request to admin')}
                  </Button>
                  {pendingNewPin ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        {isVi ? 'Đang chờ admin cấp mã PIN mới.' : 'Waiting for admin to issue a new PIN.'}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => void handleRefreshPinStatus()}
                        disabled={loading || refreshingPinStatus}
                      >
                        {refreshingPinStatus
                          ? (isVi ? 'Đang làm mới...' : 'Refreshing...')
                          : (isVi ? 'Refresh trạng thái PIN mới' : 'Refresh new PIN status')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" required>
                  {isVi ? 'Mật khẩu mới' : 'New password'}
                </Label>
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
                <Label htmlFor="confirm-password" required>
                  {isVi ? 'Xác nhận mật khẩu mới' : 'Confirm new password'}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
                  />
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (isVi ? 'Đang cập nhật...' : 'Updating...') : (isVi ? 'Đổi mật khẩu' : 'Reset password')}
              </Button>
            </form>
          )}

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={goToLogin}
              className="font-medium text-accent hover:underline underline-offset-2"
            >
              {isVi ? 'Quay lại đăng nhập' : 'Back to sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

