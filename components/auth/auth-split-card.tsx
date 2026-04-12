'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { Chrome, Eye, EyeOff, Loader2 } from 'lucide-react';
import { setSession } from '@/lib/auth/token';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/i18n-provider';
import { isStrongPassword, isValidEmail, passwordRuleMessage } from '@/lib/validation/account';
import { notifyError } from '@/lib/notify';
import { formatUserFacingFetchError, type UserFacingLocale } from '@/lib/api/format-api-error';

async function readJsonOrThrowAuthError(response: Response, locale: UserFacingLocale): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(formatUserFacingFetchError(response.status, text, locale));
  }
  try {
    return text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(locale === 'en' ? 'Invalid response from server.' : 'Phản hồi từ máy chủ không hợp lệ.');
  }
}

type Mode = 'login' | 'register';

function toMode(value: string | null | undefined): Mode | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'login' || v === 'register') return v;
  return null;
}

function defaultDashboardAfterLogin(role: string | null | undefined) {
  return String(role || '').trim().toLowerCase() === 'analyst' ? '/dashboard/customers' : '/dashboard';
}

function postLoginRoute(args: { role?: string | null; status?: string | null }) {
  const status = String(args.status || '').trim().toLowerCase();
  if (status !== 'approved') return '/auth/verify-email?mode=pending';
  return defaultDashboardAfterLogin(args.role);
}

function normalizeAuthPayload(payload: Record<string, unknown>) {
  const role =
    (typeof payload.role === 'string' && payload.role) ||
    (typeof payload.user_role === 'string' && payload.user_role) ||
    (typeof payload.registration_type === 'string' && payload.registration_type) ||
    undefined;
  const status =
    (typeof payload.status === 'string' && payload.status) ||
    (typeof payload.user_status === 'string' && payload.user_status) ||
    undefined;
  const hasPin =
    typeof payload.has_pin === 'boolean'
      ? payload.has_pin
      : typeof payload.user_has_pin === 'boolean'
        ? payload.user_has_pin
        : undefined;

  return { role, status, hasPin };
}

export function AuthSplitCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const isVi = locale === 'vi';
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';

  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const googleBtnDivRef = useRef<HTMLDivElement | null>(null);
  const googleLoginRef = useRef<(credential: string) => void>(() => {});

  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const sessionReason = searchParams.get('reason');
  const sessionExpiredRedirect =
    sessionReason === 'session_expired' ||
    sessionReason === 'session_idle' ||
    sessionReason === 'session_invalid';

  const queryMode = useMemo(() => toMode(searchParams.get('mode')) ?? 'login', [searchParams]);
  // Start in `login` so opening `/auth?mode=register` can animate into place after hydration.
  const [mode, setMode] = useState<Mode>('login');
  const isLogin = mode === 'login';
  const overlayCta = isLogin ? t('auth.sign_up') : t('auth.sign_in');

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regData, setRegData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    registrationType: 'analyst',
  });
  const [regLoading, setRegLoading] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  useEffect(() => {
    setMode((prev) => (prev === queryMode ? prev : queryMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMode]);

  useEffect(() => {
    if (!sessionExpiredRedirect) return;
    const message =
      sessionReason === 'session_invalid'
        ? t('session.expired_token')
        : t('session.expired_idle');
    notifyError(isVi ? 'Phiên đăng nhập đã hết hạn.' : 'Session expired.', message);
  }, [isVi, sessionExpiredRedirect, sessionReason, t]);

  /** Google Identity Services: gửi id_token JWT tới POST /auth/login/google (backend không có GET /auth/oauth). */
  useEffect(() => {
    if (!isLogin || !googleClientId) return;
    const el = googleBtnDivRef.current;
    if (!el) return;

    let cancelled = false;

    const mountButton = () => {
      if (cancelled || !el) return;
      const g = window.google?.accounts?.id;
      if (!g) return;
      el.innerHTML = '';
      g.initialize({
        client_id: googleClientId,
        callback: (resp: { credential: string }) => {
          void googleLoginRef.current(resp.credential);
        },
        ux_mode: 'popup',
        auto_select: false,
      });
      const w = Math.max(220, Math.floor(el.getBoundingClientRect().width) || 280);
      g.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: w,
        text: 'signin_with',
        locale: locale === 'vi' ? 'vi' : 'en',
      });
    };

    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) mountButton();
        });
      });
    };

    if (window.google?.accounts?.id) {
      run();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        if (window.google?.accounts?.id) {
          run();
        } else {
          existing.addEventListener('load', run);
        }
      } else {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => run();
        document.head.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      el.innerHTML = '';
    };
  }, [isLogin, googleClientId, locale]);

  const replaceMode = (nextMode: Mode) => {
    // Update immediately so the animation is always visible,
    // then sync the URL (no pathname change, so no route transition).
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', nextMode);
    if (safeNext) params.set('next', safeNext);
    // Prevent scroll-to-top / "page jump" while toggling modes.
    router.replace(`/auth?${params.toString()}`, { scroll: false });
  };

  const postGoogleCredential = useCallback(
    async (credential: string) => {
      setLoginLoading(true);
      try {
        const response = await fetch('/api/v1/auth/login/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ token: credential }),
        });

        const data = await readJsonOrThrowAuthError(response, msgLocale);
        const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
        const normalized = normalizeAuthPayload(data);
        if (!accessToken) {
          throw new Error(isVi ? 'Phản hồi đăng nhập không hợp lệ.' : 'Invalid login response.');
        }
        setSession({
          accessToken,
          role: normalized.role,
          status: normalized.status,
          hasPin: normalized.hasPin,
        });
        router.push(safeNext ?? postLoginRoute({ role: normalized.role, status: normalized.status }));
      } catch (err) {
        notifyError(isVi ? 'Đăng nhập thất bại.' : 'Sign in failed.', err instanceof Error ? err.message : t('common.error'));
      } finally {
        setLoginLoading(false);
      }
    },
    [isVi, msgLocale, router, safeNext, t],
  );

  useEffect(() => {
    googleLoginRef.current = postGoogleCredential;
  }, [postGoogleCredential]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ username_or_email: login, password }),
      });

      const data = await readJsonOrThrowAuthError(response, msgLocale);
      const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
      const normalized = normalizeAuthPayload(data);
      if (!accessToken) {
        throw new Error(isVi ? 'Phản hồi đăng nhập không hợp lệ.' : 'Invalid login response.');
      }
      setSession({
        accessToken,
        role: normalized.role,
        status: normalized.status,
        hasPin: normalized.hasPin,
      });
      router.push(safeNext ?? postLoginRoute({ role: normalized.role, status: normalized.status }));
    } catch (err) {
      notifyError(isVi ? 'Đăng nhập thất bại.' : 'Sign in failed.', err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(regData.email)) {
      notifyError(isVi ? 'Email không đúng định dạng.' : 'Email format is invalid.');
      return;
    }

    if (!isStrongPassword(regData.password)) {
      notifyError(passwordRuleMessage(isVi));
      return;
    }

    if (regData.password !== regData.confirmPassword) {
      notifyError(t('auth.passwords_no_match'));
      return;
    }

    setRegLoading(true);
    try {
      const usernameCandidate = String(regData.email || '').split('@')[0].trim().toLowerCase() || 'user';
      const response = await fetch('/api/v1/auth/register/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameCandidate,
          email: regData.email,
          password: regData.password,
          full_name: regData.name,
          registration_type: regData.registrationType,
        }),
      });

      const data = await readJsonOrThrowAuthError(response, msgLocale);
      const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
      const normalized = normalizeAuthPayload(data);
      const normalizedRole = String(normalized.role || regData.registrationType || '').trim().toLowerCase();
      const normalizedStatus = String(normalized.status || 'pending').trim().toLowerCase();
      if (accessToken) {
        setSession({
          accessToken,
          role: normalizedRole,
          status: normalizedStatus,
          hasPin: normalized.hasPin ?? false,
        });
        if (normalizedStatus === 'approved') {
          router.push(defaultDashboardAfterLogin(normalizedRole));
        } else {
          const params = new URLSearchParams({
            mode: 'pending',
            email: regData.email,
            role: normalizedRole || 'analyst',
          });
          router.push(`/auth/verify-email?${params.toString()}`);
        }
      } else {
        const params = new URLSearchParams({
          mode: 'pending',
          email: regData.email,
          role: normalizedRole || 'analyst',
        });
        router.push(`/auth/verify-email?${params.toString()}`);
      }
    } catch (err) {
      notifyError(isVi ? 'Đăng ký thất bại.' : 'Registration failed.', err instanceof Error ? err.message : t('common.error'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-10 md:items-center">
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

      <div className="w-full max-w-[760px] pt-14 sm:pt-12 md:pt-0">

        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur">
          <div className="relative md:grid md:grid-cols-2 md:min-h-[460px]">
            {/* Register */}
            <div
              className={cn(
                'p-5 md:p-6 flex flex-col justify-center',
                isLogin ? 'hidden md:flex md:pointer-events-none' : 'flex',
              )}
            >
              <div
                className={cn(
                  'transition-[opacity,filter,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isLogin ? 'opacity-0 scale-[0.98] blur-md' : 'opacity-100 scale-100 blur-0',
                )}
              >
                  <h2 className="text-xl font-semibold tracking-tight">{t('auth.create_account')}</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">{t('auth.register_desc')}</p>

                  <form onSubmit={handleRegister} className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name" className="text-sm" required>
                        {t('auth.full_name')}
                      </Label>
                      <Input
                        id="reg-name"
                        className="h-9"
                        value={regData.name}
                        onChange={(e) => setRegData((p) => ({ ...p, name: e.target.value }))}
                        disabled={regLoading}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email" className="text-sm" required>
                        Email
                      </Label>
                      <Input
                        id="reg-email"
                        type="email"
                        className="h-9"
                        placeholder={t('common.email_ph')}
                        value={regData.email}
                        onChange={(e) => setRegData((p) => ({ ...p, email: e.target.value }))}
                        disabled={regLoading}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-type" className="text-sm">{t('auth.registration_type')}</Label>
                      <Select
                        value={regData.registrationType}
                        onValueChange={(v) => setRegData((p) => ({ ...p, registrationType: v }))}
                      >
                        <SelectTrigger id="reg-type" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="analyst">{t('auth.analyst')}</SelectItem>
                          <SelectItem value="manager">{t('auth.manager')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password" className="text-sm" required>
                        {t('auth.password')}
                      </Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          className="h-9 pr-10"
                          value={regData.password}
                          onChange={(e) => setRegData((p) => ({ ...p, password: e.target.value }))}
                          disabled={regLoading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-confirm" className="text-sm" required>
                        {t('auth.confirm_password')}
                      </Label>
                      <div className="relative">
                        <Input
                          id="reg-confirm"
                          type={showRegisterConfirmPassword ? 'text' : 'password'}
                          className="h-9 pr-10"
                          value={regData.confirmPassword}
                          onChange={(e) => setRegData((p) => ({ ...p, confirmPassword: e.target.value }))}
                          disabled={regLoading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegisterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" size="sm" className="w-full h-9" disabled={regLoading}>
                      {regLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('auth.creating_account')}
                        </>
                      ) : (
                        t('auth.sign_up')
                      )}
                    </Button>

                    <div className="text-xs text-muted-foreground text-center pt-1.5">
                      {t('auth.have_account')}{' '}
                      <button
                        type="button"
                        className="font-medium text-accent hover:underline"
                        onClick={() => replaceMode('login')}
                      >
                        {t('auth.sign_in')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            {/* Login */}
            <div
              className={cn(
                'p-5 md:p-6 flex flex-col justify-center',
                isLogin ? 'flex' : 'hidden md:flex md:pointer-events-none',
              )}
            >
              <div
                className={cn(
                  'transition-[opacity,filter,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isLogin
                    ? 'opacity-100 scale-100 blur-0'
                    : 'opacity-0 scale-[0.98] blur-md',
                )}
              >
                <h2 className="text-xl font-semibold tracking-tight">{t('auth.welcome_back')}</h2>
                <p className="text-sm text-muted-foreground mt-1.5">{t('auth.sign_in_desc')}</p>

                <form onSubmit={handleLogin} className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-id" className="text-sm" required>
                      {t('auth.username_or_email')}
                    </Label>
                    <Input
                      id="login-id"
                      type="text"
                      className="h-9"
                      placeholder={t('auth.username_or_email_ph')}
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      disabled={loginLoading}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-sm" required>
                      {t('auth.password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        className="h-9 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loginLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="pt-1 text-right">
                      <Link href="/auth/forgot-password" className="text-xs font-medium text-accent hover:underline">
                        Quên mật khẩu?
                      </Link>
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="w-full h-9" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('auth.signing_in')}
                      </>
                    ) : (
                      t('auth.sign_in')
                    )}
                  </Button>

                  <div className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[11px] text-muted-foreground">HOẶC</span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {googleClientId ? (
                      <div
                        ref={googleBtnDivRef}
                        className="flex min-h-[40px] w-full flex-col items-stretch justify-center [&_iframe]:!max-w-none"
                      />
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-9 justify-start gap-2" disabled>
                          <Chrome className="h-4 w-4" />
                          {t('auth.google_sign_in')}
                        </Button>
                        <p className="text-[11px] text-muted-foreground px-0.5 leading-snug">
                          {t('auth.google_not_configured')}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground text-center pt-1.5">
                    {t('auth.no_account')}{' '}
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() => replaceMode('register')}
                    >
                      {t('auth.sign_up')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Sliding overlay (md+) */}
            <div
              className={cn(
                'hidden md:block absolute inset-y-0 left-0 w-1/2 p-6 z-10',
                'transform-gpu transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
                'translate-x-0',
                !isLogin && 'translate-x-full',
              )}
            >
              <div
                className={cn(
                  'relative h-full w-full overflow-hidden',
                  'rounded-2xl md:rounded-2xl',
                  'bg-[linear-gradient(135deg,rgba(11,18,32,0.92),rgba(13,25,51,0.96))]',
                  'shadow-[0_45px_130px_rgba(8,16,34,0.70)]',
                  'transition-[border-radius,filter,box-shadow] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isLogin ? 'md:rounded-r-[5rem]' : 'md:rounded-l-[5rem]',
                )}
              >
                <div
                  className={cn(
                    'pointer-events-none absolute -inset-24 opacity-70 blur-3xl',
                    'bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.55),rgba(255,255,255,0)_55%)]',
                  )}
                  aria-hidden="true"
                />

                <div
                  className={cn(
                    'pointer-events-none absolute -inset-y-20 left-[-45%] w-[190%] rotate-12 opacity-70',
                    'bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(123,224,255,0.16)_45%,rgba(255,255,255,0)_70%)]',
                  )}
                  aria-hidden="true"
                />

                <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-6">
                  <div className="relative min-h-[120px] w-full max-w-sm">
                    <div
                      className={cn(
                        'absolute inset-0 transition-[opacity,filter] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                        isLogin ? 'opacity-100 blur-0' : 'opacity-0 blur-md',
                      )}
                    >
                      <h3 className="text-2xl font-semibold tracking-tight text-white">{t('auth.overlay.hello')}</h3>
                      <p className="text-white/80 mt-3">{t('auth.overlay.no_account')}</p>
                    </div>

                    <div
                      className={cn(
                        'absolute inset-0 transition-[opacity,filter] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                        isLogin ? 'opacity-0 blur-md' : 'opacity-100 blur-0',
                      )}
                    >
                      <h3 className="text-2xl font-semibold tracking-tight text-white">{t('auth.overlay.welcome_back')}</h3>
                      <p className="text-white/80 mt-3">{t('auth.overlay.have_account')}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'mt-6 border-white/30 bg-white/10 text-white hover:bg-white/20 rounded-full px-8',
                      'transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)]',
                      'focus-visible:ring-2 focus-visible:ring-white/50',
                    )}
                    onClick={() => replaceMode(isLogin ? 'register' : 'login')}
                  >
                    {overlayCta}
                  </Button>
              </div>
            </div>
          </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
