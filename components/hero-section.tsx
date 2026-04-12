"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Play, BarChart3, MessageSquare, Layers } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { CRAIDB_SET_DEMO_TAB_EVENT } from "@/lib/home-events";

function scrollToSection(elementId: string) {
  if (typeof document === "undefined") return;
  document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setDemoTabThenScroll(tab: "dashboard" | "chatbot") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRAIDB_SET_DEMO_TAB_EVENT, { detail: { tab } }));
  }
  scrollToSection("demo");
}

export function HeroSection() {
  const { t } = useI18n();
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {t("home.hero.badge")}
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 text-balance">
            {t("home.hero.title_1")}
            <br />
            <span className="text-accent">{t("home.hero.title_2")}</span>
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
            {t("home.hero.desc")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              type="button"
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={() => scrollToSection("architecture")}
            >
              {t("home.hero.cta.arch")}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="gap-2 w-full sm:w-auto bg-transparent"
              onClick={() => setDemoTabThenScroll("dashboard")}
            >
              <Play className="w-4 h-4" />
              {t("home.hero.cta.dashboard")}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="gap-2 w-full sm:w-auto"
              onClick={() => setDemoTabThenScroll("chatbot")}
            >
              {t("home.hero.cta.chatbot")}
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
              <BarChart3 className="w-5 h-5 text-accent" />
              <span className="text-sm text-foreground">{t("home.hero.hl.ml")}</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
              <Layers className="w-5 h-5 text-accent" />
              <span className="text-sm text-foreground">{t("home.hero.hl.shap")}</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
              <MessageSquare className="w-5 h-5 text-accent" />
              <span className="text-sm text-foreground">{t("home.hero.hl.llm")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
