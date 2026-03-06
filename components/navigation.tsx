"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#architecture", key: "nav.architecture" },
  { href: "#features", key: "nav.features" },
  { href: "#technology", key: "nav.technology" },
  { href: "#demo", key: "nav.demo" },
  { href: "#use-cases", key: "nav.use_cases" },
  { href: "#about", key: "nav.about" },
] as const;

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const animateScrollTo = (targetY: number, durationMs: number) => {
    if (typeof window === "undefined") return;
    const startY = window.scrollY;
    const delta = targetY - startY;
    const start = performance.now();

    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, Math.round(startY + delta * eased));
      if (progress < 1) window.requestAnimationFrame(step);
    };

    if (durationMs <= 0) {
      window.scrollTo(0, Math.round(targetY));
      return;
    }

    window.requestAnimationFrame(step);
  };

  const flashTarget = (el: HTMLElement) => {
    el.classList.remove("scroll-target-flash");
    // force reflow so the animation restarts
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    el.classList.add("scroll-target-flash");
    window.setTimeout(() => el.classList.remove("scroll-target-flash"), 900);
  };

  const scrollToHash = (hash: string) => {
    if (typeof window === "undefined") return;
    const id = hash.replace(/^#/, "");
    const el = document.getElementById(id);
    if (!el) return;

    const headerOffset = 88;
    const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    animateScrollTo(targetY, 900);
    flashTarget(el);
    window.history.pushState(null, "", hash);
  };

  const handleNavHashClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    // If we're not on homepage, go there first with the hash.
    if (pathname !== "/") {
      e.preventDefault();
      router.push(`/${hash}`);
      setMobileMenuOpen(false);
      return;
    }
    e.preventDefault();
    scrollToHash(hash);
    setMobileMenuOpen(false);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname !== "/") return;
    e.preventDefault();
    animateScrollTo(0, 700);
    window.history.pushState(null, "", "/");
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 border-b",
        "backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300",
        isScrolled ? "bg-background/92 border-border shadow-lg shadow-black/10" : "bg-background/70 border-border/60",
      ].join(" ")}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Image src="/logo.svg" alt="CRAI DB" width={32} height={32} priority />
            <span className="font-semibold text-lg text-foreground">CRAI DB</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavHashClick(e, link.href)}
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-accent/15 hover:-translate-y-px rounded-md px-2 py-1 -mx-2"
              >
                {t(link.key)}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/auth?mode=login">
              <Button size="sm">{t("nav.sign_in")}</Button>
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-accent/15 rounded-md px-2 py-1 -mx-2"
                  onClick={(e) => handleNavHashClick(e, link.href)}
                >
                  {t(link.key)}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t("nav.theme")}</span>
                  <ThemeToggle variant="outline" />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t("nav.language")}</span>
                  <LanguageToggle variant="outline" />
                </div>
                <Link href="/auth?mode=login" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full justify-start">
                    {t("nav.sign_in")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
