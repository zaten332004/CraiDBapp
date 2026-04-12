'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { clearAccessToken } from '@/lib/auth/token';
import { ThemeToggle } from '@/components/theme-toggle';
import { getUserRole, type UserRole } from '@/lib/auth/token';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { CRAIDB_PROFILE_CHANGED_EVENT } from '@/lib/profile-sync-event';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import {
  LayoutDashboard,
  Users,
  TrendingUp,
  PieChart,
  Zap,
  AlertCircle,
  Settings,
  LogOut,
  ChevronDown,
  BarChart3,
  ScrollText,
} from 'lucide-react';

const navigationItems = [
  {
    titleKey: 'sidebar.dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    titleKey: 'sidebar.customers',
    href: '/dashboard/customers',
    icon: Users,
  },
  {
    titleKey: 'sidebar.risk',
    icon: TrendingUp,
    items: [
      {
        titleKey: 'sidebar.risk.score',
        href: '/dashboard/risk/score',
      },
      {
        titleKey: 'sidebar.risk.analyze',
        href: '/dashboard/risk/analyze',
      },
      {
        titleKey: 'sidebar.risk.simulation',
        href: '/dashboard/risk/simulation',
      },
      {
        titleKey: 'sidebar.risk.explain',
        hidden: true,
      },
    ],
  },
  {
    titleKey: 'sidebar.portfolio',
    icon: PieChart,
    items: [
      {
        titleKey: 'sidebar.portfolio.overview',
        href: '/dashboard/portfolio/overview',
      },
      {
        titleKey: 'sidebar.portfolio.risk_distribution',
        href: '/dashboard/portfolio/risk-distribution',
      },
      {
        titleKey: 'sidebar.portfolio.concentration',
        hidden: true,
      },
      {
        titleKey: 'sidebar.portfolio.trends',
        hidden: true,
      },
      {
        titleKey: 'sidebar.portfolio.compare',
        hidden: true,
      },
    ],
  },
  {
    titleKey: 'sidebar.ai_chat',
    href: '/dashboard/ai-chat',
    icon: Zap,
  },
  {
    titleKey: 'sidebar.powerbi',
    href: '/dashboard/powerbi/config',
    icon: BarChart3,
  },
  {
    titleKey: 'sidebar.alerts',
    href: '/dashboard/alerts',
    icon: AlertCircle,
  },
];

/** Analyst sidebar: customers, AI Chat, Power BI only (no dashboard, risk, portfolio, alerts). */
const ANALYST_NAV_TITLE_KEYS = new Set([
  'sidebar.customers',
  'sidebar.ai_chat',
  'sidebar.powerbi',
]);

const adminItems = [
  {
    titleKey: 'sidebar.admin.users',
    href: '/dashboard/admin/users',
    icon: Users,
  },
  {
    titleKey: 'sidebar.admin.registrations',
    href: '/dashboard/admin/registrations',
    icon: AlertCircle,
  },
  {
    titleKey: 'sidebar.admin.audit_logs',
    href: '/dashboard/admin/audit-logs',
    icon: ScrollText,
  },
];

export function AppSidebar() {
  const { state: sidebarState } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const isSidebarCollapsed = sidebarState === 'collapsed';
  const [openItems, setOpenItems] = React.useState<string[]>([]);
  const [role, setRole] = React.useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = React.useState<{ name: string; avatarUrl?: string | null } | null>(null);

  const loadSidebarUser = React.useCallback(async () => {
    try {
      const me = await browserApiFetchAuth<Record<string, unknown>>('/profile/me', { method: 'GET' });
      const name = String(me?.full_name ?? me?.username ?? me?.email ?? '').trim();
      const raw = me?.avatar_url ?? me?.avatarUrl;
      const avatarUrl =
        typeof raw === 'string' && raw.trim() ? raw.trim() : null;
      setCurrentUser({
        name: name || 'User',
        avatarUrl,
      });
    } catch {
      setCurrentUser(null);
    }
  }, []);

  React.useEffect(() => {
    setRole(getUserRole());
  }, []);

  React.useEffect(() => {
    void loadSidebarUser();
  }, [pathname, loadSidebarUser]);

  React.useEffect(() => {
    const handler = () => void loadSidebarUser();
    window.addEventListener(CRAIDB_PROFILE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CRAIDB_PROFILE_CHANGED_EVENT, handler);
  }, [loadSidebarUser]);

  const handleLogout = () => {
    clearAccessToken();
    router.push('/auth?mode=login');
  };

  const toggleItem = (title: string) => {
    setOpenItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';
  const isAnalyst = role === 'analyst';
  const homeHref = isAnalyst ? '/dashboard/customers' : '/dashboard';

  const visibleNavHrefs = React.useMemo(() => {
    const hrefs: string[] = [];
    for (const item of navigationItems) {
      if (isAnalyst && !ANALYST_NAV_TITLE_KEYS.has(item.titleKey)) {
        continue;
      }
      if (isViewer) {
        
      }
      if (item.items) {
        const baseSubItems = item.items.filter((subItem) => !subItem.hidden && Boolean(subItem.href));
        for (const subItem of baseSubItems) hrefs.push(subItem.href);
        continue;
      }
      if (item.href) hrefs.push(item.href);
    }

    if (isAdmin) {
      for (const item of adminItems) hrefs.push(item.href);
    }

    // Ensure deterministic indices and a fallback.
    if (!isAnalyst && !hrefs.includes('/dashboard')) hrefs.unshift('/dashboard');
    if (isAnalyst && !hrefs.includes('/dashboard/customers')) {
      hrefs.unshift('/dashboard/customers');
    }
    return hrefs;
  }, [isAdmin, isAnalyst, isViewer]);

  const navIndexFor = React.useCallback(
    (path: string) => {
      let bestIdx = -1;
      let bestLen = -1;
      for (let i = 0; i < visibleNavHrefs.length; i++) {
        const href = visibleNavHrefs[i];
        const matches = path === href || path.startsWith(href + '/');
        if (!matches) continue;
        if (href.length > bestLen) {
          bestIdx = i;
          bestLen = href.length;
        }
      }
      return bestIdx;
    },
    [visibleNavHrefs],
  );

  const currentNavIndex = navIndexFor(pathname);

  const navDirForHref = React.useCallback(
    (href: string) => {
      const toIndex = navIndexFor(href);
      if (toIndex === -1 || currentNavIndex === -1) return 'forward' as const;
      if (toIndex === currentNavIndex) return 'forward' as const;
      return toIndex < currentNavIndex ? ('back' as const) : ('forward' as const);
    },
    [currentNavIndex, navIndexFor],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link
          href={homeHref}
          data-nav-dir={navDirForHref(homeHref)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity group-data-[collapsible=icon]:justify-center"
        >
          <Image
            src="/logo.svg"
            alt="CRAI DB"
            width={32}
            height={32}
            className="shrink-0"
          />
          <span className="font-semibold text-sm text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            CRAI DB
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navigationItems
            .filter((item) => {
              if (isAnalyst) {
                return ANALYST_NAV_TITLE_KEYS.has(item.titleKey);
              }
              if (isViewer) {
                
                if (item.href === '/dashboard/customers') return true;
                if (item.titleKey === 'sidebar.risk') return true;
              }
              return true;
            })
            .map((item) => {
            if (item.items) {
              const baseSubItems = item.items.filter((subItem) => !subItem.hidden && Boolean(subItem.href));
              if (isSidebarCollapsed) {
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton tooltip={t(item.titleKey)}>
                          <item.icon className="h-4 w-4" />
                          <span>{t(item.titleKey)}</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" side="right" align="start">
                        {baseSubItems.map((subItem) => (
                          <DropdownMenuItem key={subItem.href} asChild>
                            <Link href={subItem.href} data-nav-dir={navDirForHref(subItem.href)}>
                              {t(subItem.titleKey)}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              }
              return (
                <Collapsible
                  key={item.titleKey}
                  open={openItems.includes(item.titleKey)}
                  onOpenChange={() => toggleItem(item.titleKey)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="data-[state=open]:bg-sidebar-accent"
                        tooltip={t(item.titleKey)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {baseSubItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive(subItem.href)}
                            >
                              <Link href={subItem.href} data-nav-dir={navDirForHref(subItem.href)}>
                                <span>{t(subItem.titleKey)}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={t(item.titleKey)}
                >
                  <Link href={item.href} data-nav-dir={navDirForHref(item.href)}>
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.titleKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-8 pt-6 border-t border-sidebar-border">
            <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
              <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                {t("sidebar.admin")}
              </h3>
            </div>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={t(item.titleKey)}
                  >
                    <Link href={item.href} data-nav-dir={navDirForHref(item.href)}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {currentUser ? (
          <Link
            href="/dashboard/profile"
            title={currentUser.name}
            className={cn(
              'mb-3 flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 transition-colors hover:bg-sidebar-accent',
              'group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:hover:bg-sidebar-accent/80',
            )}
          >
            <Avatar
              className={cn(
                'h-7 w-7 shrink-0',
                'group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:border-2 group-data-[collapsible=icon]:border-sidebar-border',
              )}
            >
              <AvatarImage
                key={currentUser.avatarUrl ?? 'no-avatar'}
                src={currentUser.avatarUrl || undefined}
                alt={currentUser.name}
              />
              <AvatarFallback>
                {currentUser.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? '')
                  .join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="truncate text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              {currentUser.name}
            </p>
          </Link>
        ) : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={t("sidebar.settings")}>
                  <Settings className="h-4 w-4" />
                  <span>{t("sidebar.settings")}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                  <span>{t("nav.theme")}</span>
                  <ThemeToggle variant="outline" />
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                  <span>{t("nav.language")}</span>
                  <LanguageToggle variant="outline" />
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile">
                    <span>{t("sidebar.profile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("sidebar.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
