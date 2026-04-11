'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2, Mail, ShieldCheck, CircleCheckBig, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';
import { authHeaders, getAccessToken, setUserHasPin, setUserStatus } from '@/lib/auth/token';

type PendingStatusResponse = {
  user_id: number;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  has_pin: boolean;
};

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const isVi = locale === 'vi';
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [pendingInfo, setPendingInfo] = useState<PendingStatusResponse | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const email = searchParams.get('email') || '';
  const mode = (searchParams.get('mode') || '').trim().toLowerCase();
  const isPendingMode = mode === 'pending';

  useEffect(() => {
    const token = searchParams.get('token');
    if (isPendingMode) {
      return;
    }
    if (token && !isVerified) {
      verifyEmail(token);
    }
  }, [searchParams, isVerified, isPendingMode]);

  useEffect(() => {
    if (!isPendingMode) return;
    if (!getAccessToken()) {
      setError(isVi ? 'Bạn cần đăng nhập để xem trạng thái xét duyệt.' : 'Please sign in to view approval status.');
      return;
    }
    void fetchPendingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPendingMode]);

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

  const fetchPendingStatus = async () => {
    setLoadingPending(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/pending/status', {
        method: 'GET',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể tải trạng thái tài khoản.' : 'Could not load account status.'));
      }
      const payload = data as PendingStatusResponse;
      setPendingInfo(payload);
      setUserStatus((payload.status || 'pending') as 'pending' | 'approved' | 'rejected');
      setUserHasPin(Boolean(payload.has_pin));
    } catch (err) {
      setError(err instanceof Error ? err.message : (isVi ? 'Có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setLoadingPending(false);
    }
  };

  const submitSetPin = async () => {
    setPinMessage('');
    setError('');
    if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(confirmPin)) {
      setError(isVi ? 'PIN phải gồm đúng 6 chữ số.' : 'PIN must be exactly 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError(isVi ? 'PIN xác nhận không khớp.' : 'PIN confirmation does not match.');
      return;
    }
    setPinLoading(true);
    try {
      const response = await fetch('/api/v1/auth/pin/set', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể lưu PIN.' : 'Could not set PIN.'));
      }
      setPinMessage(data?.message || (isVi ? 'Đã lưu PIN thành công.' : 'PIN has been saved.'));
      setPin('');
      setConfirmPin('');
      setUserHasPin(true);
      await fetchPendingStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isVi ? 'Có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setPinLoading(false);
    }
  };

  const submitChangePin = async () => {
    setPinMessage('');
    setError('');
    if (!/^\d{6}$/.test(oldPin) || !/^\d{6}$/.test(newPin) || !/^\d{6}$/.test(newPinConfirm)) {
      setError(isVi ? 'Mỗi PIN phải gồm đúng 6 chữ số.' : 'Each PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== newPinConfirm) {
      setError(isVi ? 'PIN mới xác nhận không khớp.' : 'New PIN confirmation does not match.');
      return;
    }
    setPinLoading(true);
    try {
      const response = await fetch('/api/v1/auth/pin/change', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_pin: oldPin,
          new_pin: newPin,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể đổi PIN.' : 'Could not change PIN.'));
      }
      setPinMessage(data?.message || (isVi ? 'Đổi PIN thành công.' : 'PIN changed successfully.'));
      setOldPin('');
      setNewPin('');
      setNewPinConfirm('');
      await fetchPendingStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isVi ? 'Có lỗi xảy ra.' : 'Something went wrong.'));
    } finally {
      setPinLoading(false);
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

  if (isPendingMode) {
    const currentStatus = String(pendingInfo?.status || '').toLowerCase();
    const isApproved = currentStatus === 'approved';
    const pendingHomeRoute = String(pendingInfo?.role || '').toLowerCase() === 'analyst' ? '/dashboard/customers' : '/dashboard';
    const localizedStatus =
      currentStatus === 'approved'
        ? (isVi ? 'Đã duyệt' : 'Approved')
        : currentStatus === 'rejected'
          ? (isVi ? 'Từ chối' : 'Rejected')
          : (isVi ? 'Chưa xét duyệt' : 'Pending review');

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4">
          <div className="flex items-center gap-2">
            <LanguageToggle variant="outline" />
            <ThemeToggle variant="outline" />
          </div>
        </div>
        <div className="w-full max-w-5xl">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logo.svg" alt="CRAI DB" width={42} height={42} priority />
            <span className="text-xl font-semibold tracking-tight">CRAI_DB</span>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border border-border">
              <CardHeader>
                <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                  {localizedStatus}
                </div>
                <CardTitle className="text-3xl tracking-tight">
                  {isVi ? 'Xét duyệt tài khoản' : 'Account approval'}
                </CardTitle>
                <CardDescription>
                  {isVi
                    ? 'Tài khoản Analyst/Manager cần được duyệt trước khi truy cập Dashboard.'
                    : 'Analyst/Manager accounts must be approved before dashboard access.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingPending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isVi ? 'Đang tải trạng thái...' : 'Loading status...'}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border p-4">
                    <p><span className="text-muted-foreground">{isVi ? 'Email:' : 'Email:'}</span> <strong>{pendingInfo?.email || '-'}</strong></p>
                    <p><span className="text-muted-foreground">{isVi ? 'Vai trò:' : 'Role:'}</span> <strong>{pendingInfo?.role || '-'}</strong></p>
                    <p><span className="text-muted-foreground">{isVi ? 'Trạng thái:' : 'Status:'}</span> <strong>{localizedStatus}</strong></p>
                    <p><span className="text-muted-foreground">{isVi ? 'Đã có PIN:' : 'PIN set:'}</span> <strong>{pendingInfo?.has_pin ? (isVi ? 'Có' : 'Yes') : (isVi ? 'Chưa' : 'No')}</strong></p>
                  </div>
                )}
                <Button type="button" variant="outline" onClick={fetchPendingStatus} disabled={loadingPending}>
                  {isVi ? 'Kiểm tra lại trạng thái' : 'Refresh status'}
                </Button>
                {isApproved && (
                  <Link href={pendingHomeRoute} className="block">
                    <Button className="w-full">{isVi ? 'Vào hệ thống' : 'Go to dashboard'}</Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-3xl tracking-tight">
                  {pendingInfo?.has_pin ? (isVi ? 'Đổi mã PIN bảo mật' : 'Change security PIN') : (isVi ? 'Thiết lập mã PIN bảo mật' : 'Set security PIN')}
                </CardTitle>
                <CardDescription>
                  {isVi
                    ? 'Mã PIN 6 số dùng để xác nhận khi quên mật khẩu hoặc đổi email.'
                    : 'Your 6-digit PIN is required for password reset and email change verification.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {pinMessage && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{pinMessage}</AlertDescription>
                  </Alert>
                )}

                {pendingInfo?.has_pin ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="old-pin">{isVi ? 'PIN cũ' : 'Current PIN'}</Label>
                      <Input id="old-pin" value={oldPin} onChange={(e) => setOldPin(e.target.value)} maxLength={6} inputMode="numeric" placeholder={isVi ? 'Nhập PIN cũ' : 'Enter current PIN'} />
                    </div>
                    <div>
                      <Label htmlFor="new-pin">{isVi ? 'PIN mới' : 'New PIN'}</Label>
                      <Input id="new-pin" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={6} inputMode="numeric" placeholder={isVi ? 'Nhập PIN mới 6 số' : 'Enter new 6-digit PIN'} />
                    </div>
                    <div>
                      <Label htmlFor="confirm-new-pin">{isVi ? 'Xác nhận PIN mới' : 'Confirm new PIN'}</Label>
                      <Input id="confirm-new-pin" value={newPinConfirm} onChange={(e) => setNewPinConfirm(e.target.value)} maxLength={6} inputMode="numeric" placeholder={isVi ? 'Nhập lại PIN mới' : 'Re-enter new PIN'} />
                    </div>
                    <Button className="w-full" onClick={submitChangePin} disabled={pinLoading}>
                      {pinLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isVi ? 'Đổi PIN' : 'Change PIN'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="pin">{isVi ? 'PIN 6 chữ số' : '6-digit PIN'}</Label>
                      <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} inputMode="numeric" placeholder={isVi ? 'Nhập PIN 6 số' : 'Enter 6-digit PIN'} />
                    </div>
                    <div>
                      <Label htmlFor="confirm-pin">{isVi ? 'Xác nhận PIN' : 'Confirm PIN'}</Label>
                      <Input id="confirm-pin" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={6} inputMode="numeric" placeholder={isVi ? 'Nhập lại PIN 6 số' : 'Re-enter 6-digit PIN'} />
                    </div>
                    <Button className="w-full" onClick={submitSetPin} disabled={pinLoading}>
                      {pinLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isVi ? 'Lưu PIN' : 'Save PIN'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
