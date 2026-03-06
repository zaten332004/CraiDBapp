'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { AlertCircle, Chrome, Github, Loader2 } from 'lucide-react';
import { setSession } from '@/lib/auth/token';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/i18n-provider';

type Mode = 'login' | 'register';

function toMode(value: string | null | undefined): Mode | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'login' || v === 'register') return v;
  return null;
}

export function AuthSplitCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const queryMode = useMemo(() => toMode(searchParams.get('mode')) ?? 'login', [searchParams]);
  // Start in `login` so opening `/auth?mode=register` can animate into place after hydration.
  const [mode, setMode] = useState<Mode>('login');

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [regData, setRegData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    registrationType: 'analyst',
  });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    setMode((prev) => (prev === queryMode ? prev : queryMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMode]);

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

  const isLogin = mode === 'login';
  const overlayCta = isLogin ? t('auth.sign_up') : t('auth.sign_in');
  const oauthBasePath = '/api/v1/auth/oauth';

  const startOAuth = (provider: 'google' | 'github') => {
    const params = new URLSearchParams();
    if (safeNext) params.set('next', safeNext);
    const qs = params.toString();
    window.location.href = `${oauthBasePath}/${provider}${qs ? `?${qs}` : ''}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
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

      if (!response.ok) {
        let message = 'Login failed';
        try {
          const contentType = response.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            message =
              data?.message ||
              data?.detail ||
              data?.error ||
              data?.errors?.[0]?.message ||
              message;
          } else {
            const text = await response.text();
            if (text) message = text;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const data = (await response.json()) as { access_token: string; role?: string };
      setSession({ accessToken: data.access_token, role: data.role });
      router.push(safeNext ?? '/dashboard');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (regData.password !== regData.confirmPassword) {
      setRegError(t('auth.passwords_no_match'));
      return;
    }

    setRegLoading(true);
    try {
      const response = await fetch('/api/v1/auth/register/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regData.email,
          password: regData.password,
          name: regData.name,
          reg_type: regData.registrationType,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || t('auth.register_failed'));
      }

      router.push('/auth/verify-email');
    } catch (err) {
      setRegError(err instanceof Error ? err.message : t('common.error'));
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
                'p-5 md:p-6 flex flex-col',
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

                  {regError && (
                    <Alert variant="destructive" className="mt-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{regError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleRegister} className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name" className="text-sm">{t('auth.full_name')}</Label>
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
                      <Label htmlFor="reg-email" className="text-sm">Email</Label>
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
                      <Label htmlFor="reg-password" className="text-sm">{t('auth.password')}</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        className="h-9"
                        value={regData.password}
                        onChange={(e) => setRegData((p) => ({ ...p, password: e.target.value }))}
                        disabled={regLoading}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-confirm" className="text-sm">{t('auth.confirm_password')}</Label>
                      <Input
                        id="reg-confirm"
                        type="password"
                        className="h-9"
                        value={regData.confirmPassword}
                        onChange={(e) => setRegData((p) => ({ ...p, confirmPassword: e.target.value }))}
                        disabled={regLoading}
                        required
                      />
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
                'p-5 md:p-6 flex flex-col',
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

                {loginError && (
                  <Alert variant="destructive" className="mt-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-id" className="text-sm">{t('auth.username_or_email')}</Label>
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
                    <Label htmlFor="login-password" className="text-sm">{t('auth.password')}</Label>
                    <Input
                      id="login-password"
                      type="password"
                      className="h-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginLoading}
                      required
                    />
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 justify-start gap-2"
                      onClick={() => startOAuth('google')}
                    >
                      <Chrome className="h-4 w-4" />
                      Đăng nhập với Google
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 justify-start gap-2"
                      onClick={() => startOAuth('github')}
                    >
                      <Github className="h-4 w-4" />
                      Đăng nhập với GitHub
                    </Button>
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
