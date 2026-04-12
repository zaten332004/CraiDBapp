import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import '../styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/components/i18n-provider'
import { cookies } from 'next/headers'
import { normalizeLocale } from '@/lib/i18n/cookies'
import { PageTransition } from '@/components/page-transition'
import { RouteTransitionListener } from '@/components/route-transition-listener'
import { AppToaster } from '@/components/app-toaster'
import { SessionActivityTracker } from '@/components/session-activity-tracker'

export const metadata: Metadata = {
  title: 'CRAI DB - Intelligent Credit Risk Analytics Platform',
  description: 'Credit Risk Analysis & Smart Dashboard - Chatbot System. ML-powered credit scoring with explainable AI, real-time dashboards, and conversational analytics.',
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  /* Chưa có cookie locale = lần đầu (hoặc đã xóa cookie) → luôn EN; lần sau theo cookie đã lưu. */
  const initialLocale = normalizeLocale(cookieStore.get('locale')?.value) ?? 'en'

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <I18nProvider initialLocale={initialLocale}>
            <RouteTransitionListener />
            <SessionActivityTracker />
            <PageTransition>{children}</PageTransition>
            <AppToaster />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
