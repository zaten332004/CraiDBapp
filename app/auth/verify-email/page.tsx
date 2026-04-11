'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';
import { authHeaders, clearAccessToken, getAccessToken, getUserHasPin, getUserRole, getUserStatus, setUserHasPin, setUserRole, setUserStatus } from '@/lib/auth/token';
import { isNumericPin } from '@/lib/validation/account';
import { notifyError, notifySuccess } from '@/lib/notify';

type PendingStatusResponse = {
  user_id: number;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  has_pin: boolean;
  rejection_reason?: string | null;
};

function extractRejectionReason(value: unknown, allowRawString = false): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    if (!allowRawString) return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractRejectionReason(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const direct =
      extractRejectionReason(obj.rejection_reason, true) ||
      extractRejectionReason(obj.rejectionReason, true) ||
      extractRejectionReason(obj.reason, true) ||
      extractRejectionReason(obj.reject_reason, true) ||
      extractRejectionReason(obj.rejectReason, true) ||
      extractRejectionReason(obj.rejected_reason, true) ||
      extractRejectionReason(obj.rejectedReason, true);
    if (direct) return direct;
    for (const nested of Object.values(obj)) {
      if (!nested || typeof nested !== 'object') continue;
      const found = extractRejectionReason(nested);
      if (found) return found;
    }
  }
  return null;
}

function normalizeRoleFromPayload(data: Record<string, unknown>): string {
  const raw =
    (typeof data.role === 'string' && data.role) ||
    (typeof data.user_role === 'string' && data.user_role) ||
    (typeof data.registration_type === 'string' && data.registration_type) ||
    '';
  return String(raw).trim().toLowerCase();
}

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.includes('not authenticated') || normalized.includes('unauthorized') || normalized.includes('401');
}

function usernameFromEmail(email: string): string {
  const raw = String(email || '').trim();
  if (!raw) return '';
  const atIndex = raw.indexOf('@');
  return atIndex > 0 ? raw.slice(0, atIndex).trim() : raw;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const isVi = locale === 'vi';
  const [pendingInfo, setPendingInfo] = useState<PendingStatusResponse | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const emailQuery = (searchParams.get('email') || '').trim();
  const roleQuery = (searchParams.get('role') || '').trim().toLowerCase();

  const fetchRegistrationReasonByUserId = async (userId: number): Promise<string | null> => {
    if (!userId || !getAccessToken()) return null;
    try {
      const response = await fetch(`/api/v1/auth/register/registration/${encodeURIComponent(String(userId))}`, {
        method: 'GET',
        headers: authHeaders(),
      });
      if (!response.ok) return null;
      const details = await response.json().catch(() => ({}));
      return extractRejectionReason(details);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    void fetchPendingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingStatus = async () => {
    if (!getAccessToken()) {
      return null;
    }
    setLoadingPending(true);
    try {
      const response = await fetch('/api/v1/auth/pending/status', {
        method: 'GET',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (isVi ? 'Không thể tải trạng thái tài khoản.' : 'Could not load account status.'));
      }
      const payload = data as Record<string, unknown>;
      const normalizedRole = normalizeRoleFromPayload(payload) || getUserRole() || 'analyst';
      const normalizedEmail =
        (typeof payload.email === 'string' && payload.email.trim()) ||
        emailQuery ||
        '';
      const normalizedStatus =
        (typeof payload.status === 'string' && payload.status) ||
        (typeof payload.user_status === 'string' && payload.user_status) ||
        'pending';
      const normalizedHasPin =
        typeof payload.has_pin === 'boolean'
          ? payload.has_pin
          : typeof payload.user_has_pin === 'boolean'
            ? payload.user_has_pin
            : getUserHasPin();

      const normalizedPayload: PendingStatusResponse = {
        user_id: Number(payload.user_id || 0),
        email: normalizedEmail,
        role: normalizedRole,
        status: normalizedStatus,
        has_pin: Boolean(normalizedHasPin),
        rejection_reason: extractRejectionReason(payload),
      };
      if (
        normalizedPayload.rejection_reason &&
        normalizedEmail &&
        normalizedPayload.rejection_reason.trim().toLowerCase() === normalizedEmail.trim().toLowerCase()
      ) {
        normalizedPayload.rejection_reason = null;
      }
      if (String(normalizedStatus).trim().toLowerCase() === 'rejected' && !normalizedPayload.rejection_reason) {
        const fallbackReason = await fetchRegistrationReasonByUserId(normalizedPayload.user_id);
        if (fallbackReason) {
          normalizedPayload.rejection_reason = fallbackReason;
        }
      }
      setPendingInfo(normalizedPayload);
      if (normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'analyst' || normalizedRole === 'viewer') {
        setUserRole(normalizedRole);
      }
      setUserStatus((normalizedPayload.status || 'pending') as 'pending' | 'approved' | 'rejected');
      setUserHasPin(Boolean(normalizedPayload.has_pin));
      return normalizedPayload;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!isAuthErrorMessage(msg)) {
        notifyError(isVi ? 'Không thể tải trạng thái tài khoản.' : 'Could not load account status.', msg || undefined);
      }
      return null;
    } finally {
      setLoadingPending(false);
    }
  };

  function dashboardRouteByRole(role?: string | null) {
    return String(role || '').trim().toLowerCase() === 'analyst' ? '/dashboard/customers' : '/dashboard';
  }

  const handleRefreshStatus = async () => {
    const payload = await fetchPendingStatus();
    const status = String(payload?.status || '').trim().toLowerCase();
    if (status === 'approved' || (!payload && currentStatus === 'approved')) {
      router.push(payload ? dashboardRouteByRole(payload?.role) : pendingHomeRoute);
    }
  };

  const handleBackToLogin = () => {
    clearAccessToken();
    router.push('/auth?mode=login');
  };

  const submitSetPin = async () => {
    if (!isNumericPin(pin, 6) || !isNumericPin(confirmPin, 6)) {
      notifyError(isVi ? 'PIN chỉ được chứa chữ số và gồm đúng 6 số.' : 'PIN must contain digits only and be exactly 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      notifyError(isVi ? 'Mã PIN xác nhận chưa khớp với mã PIN đã nhập.' : 'Confirmation PIN does not match the entered PIN.');
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
      notifySuccess(data?.message || (isVi ? 'Đã lưu PIN thành công.' : 'PIN has been saved.'));
      setPin('');
      setConfirmPin('');
      setUserHasPin(true);
      await fetchPendingStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isAuthErrorMessage(msg)) {
        notifyError(isVi ? 'Bạn cần đăng nhập để thiết lập mã PIN.' : 'Please sign in to set your PIN.');
      } else {
        notifyError(isVi ? 'Không thể lưu PIN.' : 'Could not set PIN.', msg || undefined);
      }
    } finally {
      setPinLoading(false);
    }
  };

  const submitChangePin = async () => {
    if (!isNumericPin(oldPin, 6) || !isNumericPin(newPin, 6) || !isNumericPin(newPinConfirm, 6)) {
      notifyError(isVi ? 'Mỗi PIN chỉ được chứa chữ số và gồm đúng 6 số.' : 'Each PIN must contain digits only and be exactly 6 digits.');
      return;
    }
    if (newPin !== newPinConfirm) {
      notifyError(isVi ? 'Mã PIN mới xác nhận chưa khớp với mã PIN mới đã nhập.' : 'New PIN confirmation does not match the entered new PIN.');
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
      notifySuccess(data?.message || (isVi ? 'Đổi PIN thành công.' : 'PIN changed successfully.'));
      setOldPin('');
      setNewPin('');
      setNewPinConfirm('');
      await fetchPendingStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isAuthErrorMessage(msg)) {
        notifyError(isVi ? 'Bạn cần đăng nhập để đổi mã PIN.' : 'Please sign in to change your PIN.');
      } else {
        notifyError(isVi ? 'Không thể đổi PIN.' : 'Could not change PIN.', msg || undefined);
      }
    } finally {
      setPinLoading(false);
    }
  };

  const fallbackRole = getUserRole();
  const fallbackStatus = getUserStatus();
  const fallbackHasPin = getUserHasPin();
  const resolvedEmail = pendingInfo?.email || emailQuery || '';
  const resolvedRole = pendingInfo?.role || roleQuery || fallbackRole || 'analyst';
  const currentStatus = String(pendingInfo?.status || fallbackStatus || 'pending').toLowerCase();
  const resolvedHasPin = typeof pendingInfo?.has_pin === 'boolean' ? pendingInfo.has_pin : fallbackHasPin;
  const resolvedUsername = usernameFromEmail(resolvedEmail);
  const rejectionReason = String(pendingInfo?.rejection_reason || '').trim();
  const isApproved = currentStatus === 'approved';
  const isRejected = currentStatus === 'rejected';
  const pendingHomeRoute = dashboardRouteByRole(resolvedRole);
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
      <div className="w-full max-w-6xl">
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
              <CardTitle className="text-3xl tracking-tight">{isVi ? 'Xét duyệt tài khoản' : 'Account approval'}</CardTitle>
              <CardDescription>
                {isVi
                  ? 'Bạn cần chờ quản trị viên xem xét và phê duyệt tài khoản trước khi vào Dashboard.'
                  : 'Please wait for administrator review and approval before dashboard access.'}
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
                  <p><span className="text-muted-foreground">{isVi ? 'Email:' : 'Email:'}</span> <strong>{resolvedEmail || (isVi ? 'Chưa cập nhật' : 'Not available')}</strong></p>
                  <p><span className="text-muted-foreground">{isVi ? 'Tên đăng nhập:' : 'Username:'}</span> <strong>{resolvedUsername || (isVi ? 'Chưa cập nhật' : 'Not available')}</strong></p>
                  <p><span className="text-muted-foreground">{isVi ? 'Vai trò:' : 'Role:'}</span> <strong>{resolvedRole || (isVi ? 'Chưa cập nhật' : 'Not available')}</strong></p>
                  <p><span className="text-muted-foreground">{isVi ? 'Trạng thái:' : 'Status:'}</span> <strong>{localizedStatus}</strong></p>
                  <p><span className="text-muted-foreground">{isVi ? 'Đã có PIN:' : 'PIN set:'}</span> <strong>{resolvedHasPin ? (isVi ? 'Có' : 'Yes') : (isVi ? 'Chưa' : 'No')}</strong></p>
                </div>
              )}
              <Button type="button" variant="outline" onClick={handleRefreshStatus} disabled={loadingPending}>
                {isVi ? 'Kiểm tra lại trạng thái' : 'Refresh status'}
              </Button>
              {isApproved && (
                <Link href={pendingHomeRoute} className="block">
                  <Button className="w-full">{isVi ? 'Vào hệ thống' : 'Go to dashboard'}</Button>
                </Link>
              )}
              <div className="block">
                <Button type="button" className="w-full" onClick={handleBackToLogin}>
                  {isVi ? 'Quay lại trang đăng nhập' : 'Back to login'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              {isRejected ? (
                <>
                  <CardTitle className="text-3xl tracking-tight">
                    {isVi ? 'Lý do từ chối hồ sơ' : 'Rejection reason'}
                  </CardTitle>
                  <CardDescription>
                    {isVi
                      ? 'Tài khoản của bạn đã bị từ chối. Vui lòng xem lý do bên dưới và liên hệ quản trị viên để được hỗ trợ.'
                      : 'Your account request was rejected. Please review the reason below and contact an administrator.'}
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle className="text-3xl tracking-tight">
                    {pendingInfo?.has_pin ? (isVi ? 'Đổi mã PIN bảo mật' : 'Change security PIN') : (isVi ? 'Thiết lập mã PIN bảo mật' : 'Set security PIN')}
                  </CardTitle>
                  <CardDescription>
                    {isVi
                      ? 'Mã PIN 6 số dùng để xác nhận khi quên mật khẩu hoặc đổi email.'
                      : 'Your 6-digit PIN is required for password reset and email change verification.'}
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isRejected ? (
                <>
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                    <p className="text-sm font-semibold text-red-800">{isVi ? 'Chi tiết từ chối' : 'Rejection details'}</p>
                    <p className="mt-2 text-sm text-red-900">
                      {rejectionReason || (isVi ? 'Quản trị viên chưa cung cấp lý do cụ thể.' : 'No specific reason was provided by the administrator.')}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                    {isVi
                      ? 'Bạn có thể cập nhật lại thông tin hồ sơ hoặc liên hệ quản trị viên để được xét duyệt lại.'
                      : 'You can update your profile information or contact an administrator for re-review.'}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{isVi ? 'Lưu ý bảo mật PIN' : 'PIN security note'}</p>
                    <p className="mt-1">
                      {isVi
                        ? 'Hãy ghi nhớ mã PIN và không chia sẻ cho người khác. Bạn sẽ cần PIN khi quên mật khẩu hoặc đổi email.'
                        : 'Please remember your PIN and never share it. You will need it for password reset and email change.'}
                    </p>
                  </div>

                  {resolvedHasPin ? (
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
                </>
              )}
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
