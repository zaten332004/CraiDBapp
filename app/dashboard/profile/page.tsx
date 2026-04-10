'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Loader2 } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, formatUserFacingFetchError } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import { CRAIDB_PROFILE_CHANGED_EVENT } from '@/lib/profile-sync-event';
import { getAccessToken, setSession } from '@/lib/auth/token';

type ProfileMe = {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url?: string | null;
  role: string;
  status?: string | null;
  is_email_verified?: boolean;
};

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const isVi = locale === 'vi';
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileMe | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [confirmingEmailCode, setConfirmingEmailCode] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState('');
  const [cropFileName, setCropFileName] = useState('avatar.webp');
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cropBoxRef = useRef<HTMLDivElement | null>(null);
  const cropDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await browserApiFetchAuth<ProfileMe>('/profile/me', { method: 'GET' });
      setProfile(me);
      setProfileForm({
        full_name: me.full_name ?? '',
        phone: me.phone ?? '',
      });
    } catch (err) {
      setError(formatUserFacingApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    try {
      const updated = await browserApiFetchAuth<ProfileMe>('/profile/me', {
        method: 'PATCH',
        body: {
          full_name: profileForm.full_name.trim() || null,
          phone: profileForm.phone.trim() || null,
        },
      });
      setProfile(updated);
      setProfileForm({
        full_name: updated.full_name ?? '',
        phone: updated.phone ?? '',
      });
      window.dispatchEvent(new Event(CRAIDB_PROFILE_CHANGED_EVENT));
      notifySuccess(isVi ? 'Đã lưu hồ sơ.' : 'Profile saved.');
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Không thể lưu hồ sơ.' : 'Could not save profile.', msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      const msg = isVi ? 'Mật khẩu xác nhận không khớp.' : 'Password confirmation does not match.';
      setError(msg);
      return;
    }
    setSavingPassword(true);
    try {
      await browserApiFetchAuth<{ message: string }>('/profile/change-password', {
        method: 'POST',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notifySuccess(isVi ? 'Đổi mật khẩu thành công.' : 'Password changed successfully.');
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Đổi mật khẩu thất bại.' : 'Failed to change password.', msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const requestEmailChange = async () => {
    if (!newEmail.trim()) return;
    setError(null);
    setSendingEmailCode(true);
    try {
      const res = await browserApiFetchAuth<{ message: string; pending_email: string; expires_in_seconds: number }>(
        '/profile/change-email/request',
        {
          method: 'POST',
          body: { new_email: newEmail.trim() },
        },
      );
      setPendingEmail(res.pending_email);
      setExpiresInSeconds(res.expires_in_seconds);
      notifySuccess(isVi ? 'Đã gửi mã xác minh tới email mới.' : 'Verification code sent to new email.');
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Không thể gửi mã xác minh.' : 'Failed to send verification code.', msg);
    } finally {
      setSendingEmailCode(false);
    }
  };

  const confirmEmailChange = async () => {
    if (!emailCode.trim()) return;
    setError(null);
    setConfirmingEmailCode(true);
    try {
      const res = await browserApiFetchAuth<{ message: string; email: string; access_token: string; role: string }>(
        '/profile/change-email/confirm',
        {
          method: 'POST',
          body: { code: emailCode.trim() },
        },
      );
      setSession({ accessToken: res.access_token, role: res.role });
      setProfile((prev) => (prev ? { ...prev, email: res.email } : prev));
      setNewEmail('');
      setEmailCode('');
      setPendingEmail('');
      setExpiresInSeconds(null);
      notifySuccess(isVi ? 'Cập nhật email thành công.' : 'Email updated successfully.');
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Xác minh mã thất bại.' : 'Failed to verify code.', msg);
    } finally {
      setConfirmingEmailCode(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setError(null);
    setUploadingAvatar(true);
    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/v1/profile/avatar', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(formatUserFacingFetchError(response.status, bodyText));
      }
      const updated = (await response.json()) as ProfileMe;
      setProfile(updated);
      window.dispatchEvent(new Event(CRAIDB_PROFILE_CHANGED_EVENT));
      notifySuccess(isVi ? 'Đã cập nhật ảnh đại diện.' : 'Avatar updated.');
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Không thể cập nhật ảnh đại diện.' : 'Failed to update avatar.', msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const prepareCropImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Cannot read image file'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Cannot load image'));
      img.src = dataUrl;
    });
    setCropPreviewUrl(dataUrl);
    setCropImage(image);
    setCropFileName(file.name || 'avatar.webp');
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setCropOpen(true);
  };

  const shouldOpenCropBeforeUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return true;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Cannot read image file'));
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Cannot load image'));
        image.src = dataUrl;
      });
      return Math.abs(img.naturalWidth - img.naturalHeight) > 2;
    } catch {
      // If metadata check fails, prefer safe path: open crop dialog.
      return true;
    }
  };

  const buildCroppedAvatarFile = async () => {
    if (!cropImage) throw new Error('No image selected');
    const sourceW = cropImage.naturalWidth;
    const sourceH = cropImage.naturalHeight;
    const side = Math.max(64, Math.round(Math.min(sourceW, sourceH) / Math.max(1, cropZoom)));
    const maxX = Math.max(0, Math.floor((sourceW - side) / 2));
    const maxY = Math.max(0, Math.floor((sourceH - side) / 2));
    const centerX = Math.round(sourceW / 2 + (cropOffsetX / 100) * maxX);
    const centerY = Math.round(sourceH / 2 + (cropOffsetY / 100) * maxY);
    const sx = Math.min(sourceW - side, Math.max(0, centerX - Math.floor(side / 2)));
    const sy = Math.min(sourceH - side, Math.max(0, centerY - Math.floor(side / 2)));

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot initialize canvas');
    ctx.drawImage(cropImage, sx, sy, side, side, 0, 0, 1024, 1024);

    let quality = 0.92;
    let blob: Blob | null = null;
    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= 5 * 1024 * 1024) break;
      quality -= 0.1;
    }
    if (!blob) throw new Error(isVi ? 'Không thể tạo ảnh sau khi cắt.' : 'Could not create cropped image.');
    if (blob.size > 5 * 1024 * 1024) throw new Error(isVi ? 'Ảnh sau khi cắt vẫn vượt quá 5MB.' : 'Cropped image is still larger than 5MB.');
    const safeName = (cropFileName || 'avatar').replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], safeName, { type: 'image/webp' });
  };

  const confirmCropAndUpload = async () => {
    try {
      const file = await buildCroppedAvatarFile();
      setCropOpen(false);
      await uploadAvatar(file);
    } catch (err) {
      const msg = formatUserFacingApiError(err);
      setError(msg);
      notifyError(isVi ? 'Không thể cắt ảnh.' : 'Could not crop image.', msg);
    }
  };

  const clampOffset = (value: number) => Math.max(-60, Math.min(60, value));
  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    cropDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: cropOffsetX,
      baseY: cropOffsetY,
    };
    setIsDraggingCrop(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDragRef.current) return;
    e.preventDefault();
    const { startX, startY, baseX, baseY } = cropDragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const rect = cropBoxRef.current?.getBoundingClientRect();
    const base = Math.max(120, (rect?.width ?? 288) / 2);
    const asPercentX = (deltaX / base) * 100;
    const asPercentY = (deltaY / base) * 100;
    setCropOffsetX(clampOffset(baseX + asPercentX));
    setCropOffsetY(clampOffset(baseY + asPercentY));
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    cropDragRef.current = null;
    setIsDraggingCrop(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const displayName = profile?.full_name?.trim() || profile?.username || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#f4f7fc]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('profile.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('profile.desc')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Card className="border-border/80 bg-card shadow-sm">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
      <>
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{isVi ? 'Tài khoản hiện tại' : 'Current account'}</CardTitle>
          <CardDescription>{isVi ? 'Tóm tắt thông tin xác thực của tài khoản.' : 'Summary of your account identity.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                <AvatarFallback>{initials || 'U'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xl font-semibold truncate">{displayName}</p>
                <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    {profile?.status?.toLowerCase() === 'inactive' ? (isVi ? 'Ngừng hoạt động' : 'Inactive') : (isVi ? 'Hoạt động' : 'Active')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      profile?.is_email_verified
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-amber-300 bg-amber-50 text-amber-800'
                    }
                  >
                    {profile?.is_email_verified
                      ? (isVi ? 'Email đã xác minh' : 'Email verified')
                      : (isVi ? 'Email chưa xác minh' : 'Email unverified')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void (async () => {
                      const requiresCrop = await shouldOpenCropBeforeUpload(file);
                      if (requiresCrop) {
                        await prepareCropImage(file);
                      } else {
                        await uploadAvatar(file);
                      }
                    })();
                  }
                  e.currentTarget.value = '';
                }}
              />
              <Button
                variant="outline"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {isVi ? 'Đổi ảnh đại diện' : 'Change avatar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">{t('profile.tab.general')}</TabsTrigger>
          <TabsTrigger value="email">{isVi ? 'Email' : 'Email'}</TabsTrigger>
          <TabsTrigger value="security">{t('profile.tab.security')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t('profile.general.title')}</CardTitle>
              <CardDescription>
                {t('profile.general.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.full_name')}</Label>
                <Input
                  id="name"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone')}</Label>
                <Input
                  id="phone"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t('common.role')}</Label>
                <Input
                  id="role"
                  value={profile?.role ?? '-'}
                  disabled
                />
              </div>

              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('common.save_changes')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{isVi ? 'Đổi email' : 'Change email'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{isVi ? 'Email hiện tại' : 'Current email'}</Label>
                <Input value={profile?.email ?? ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">{isVi ? 'Email mới' : 'New email'}</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new-email@example.com"
                />
              </div>
              <Button onClick={requestEmailChange} disabled={sendingEmailCode || !newEmail.trim()}>
                {sendingEmailCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isVi ? 'Gửi mã xác minh' : 'Send verification code'}
              </Button>

              {pendingEmail ? (
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {isVi ? 'Mã đã gửi tới:' : 'Code sent to:'} <span className="font-medium text-foreground">{pendingEmail}</span>
                    {expiresInSeconds ? ` (${isVi ? 'hết hạn sau' : 'expires in'} ${Math.max(1, Math.floor(expiresInSeconds / 60))} ${isVi ? 'phút' : 'minutes'})` : ''}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="email-code">{isVi ? 'Mã xác minh' : 'Verification code'}</Label>
                    <Input
                      id="email-code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder={isVi ? 'Nhập mã xác minh' : 'Enter verification code'}
                    />
                  </div>
                  <Button onClick={confirmEmailChange} disabled={confirmingEmailCode || !emailCode.trim()}>
                    {confirmingEmailCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isVi ? 'Xác nhận đổi email' : 'Confirm email change'}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t('profile.security.title')}</CardTitle>
              <CardDescription>
                {t('profile.security.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">{t('profile.security.current')}</Label>
                <Input id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new">{t('profile.security.new')}</Label>
                <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t('profile.security.confirm')}</Label>
                <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>

              <Button onClick={changePassword} disabled={savingPassword}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('profile.security.change')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isVi ? 'Cắt ảnh đại diện' : 'Crop avatar'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div
              ref={cropBoxRef}
              className="mx-auto h-72 w-72 overflow-hidden rounded-xl border bg-muted relative touch-none"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              style={{ cursor: isDraggingCrop ? 'grabbing' : 'grab', touchAction: 'none' }}
            >
              {cropPreviewUrl ? (
                <img
                  src={cropPreviewUrl}
                  alt="Crop preview"
                  className="absolute left-1/2 top-1/2 h-full w-full max-w-none object-cover select-none pointer-events-none"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ transform: `translate(calc(-50% + ${cropOffsetX}%), calc(-50% + ${cropOffsetY}%)) scale(${cropZoom})` }}
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>{isVi ? 'Thu phóng' : 'Zoom'}</Label>
              <input
                type="range"
                min={100}
                max={300}
                step={1}
                value={Math.round(cropZoom * 100)}
                onChange={(e) => setCropZoom(Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isVi ? 'Giữ chuột và kéo ảnh để thay đổi vùng cắt.' : 'Click and drag the image to reposition crop area.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropOpen(false)}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Button>
            <Button onClick={() => void confirmCropAndUpload()}>
              {isVi ? 'Cắt và tải lên' : 'Crop and upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
