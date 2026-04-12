"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  Cloud,
  Database,
  MessageSquare,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const architectureLayers = [
  {
    icon: Database,
    titleKey: "home.arch.layer.1.title",
    descriptionKey: "home.arch.layer.1.desc",
    detailsKey: "home.arch.layer.1.details",
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    icon: Brain,
    titleKey: "home.arch.layer.2.title",
    descriptionKey: "home.arch.layer.2.desc",
    detailsKey: "home.arch.layer.2.details",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: BarChart3,
    titleKey: "home.arch.layer.3.title",
    descriptionKey: "home.arch.layer.3.desc",
    detailsKey: "home.arch.layer.3.details",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
  {
    icon: MessageSquare,
    titleKey: "home.arch.layer.4.title",
    descriptionKey: "home.arch.layer.4.desc",
    detailsKey: "home.arch.layer.4.details",
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
  {
    icon: Smartphone,
    titleKey: "home.arch.layer.5.title",
    descriptionKey: "home.arch.layer.5.desc",
    detailsKey: "home.arch.layer.5.details",
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
  {
    icon: Cloud,
    titleKey: "home.arch.layer.6.title",
    descriptionKey: "home.arch.layer.6.desc",
    detailsKey: "home.arch.layer.6.details",
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
];

export function ArchitectureSection() {
  const { t } = useI18n();
  return (
    <section id="architecture" className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.arch.kicker")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4 text-balance">
            {t("home.arch.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.arch.desc")}
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="relative">
          {/* Main flow diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {architectureLayers.map((layer, index) => (
              <div
                key={layer.titleKey}
                className="relative group"
              >
                <div className="p-6 rounded-xl bg-secondary border border-border hover:border-accent/50 transition-all duration-300">
                  <div className={`w-12 h-12 rounded-lg ${layer.bgColor} flex items-center justify-center mb-4`}>
                    <layer.icon className={`w-6 h-6 ${layer.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{t(layer.titleKey)}</h3>
                  <p className="text-sm text-accent mb-3">{t(layer.descriptionKey)}</p>
                  <p className="text-sm text-muted-foreground">{t(layer.detailsKey)}</p>
                </div>

                {/* Connection arrows for desktop */}
                {index < architectureLayers.length - 1 && index !== 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-border" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Data flow description */}
          <div className="mt-12 p-6 rounded-xl bg-secondary border border-border">
            <h4 className="text-lg font-semibold text-foreground mb-4">{t("home.arch.flow.title")}</h4>
            <div className="grid md:grid-cols-5 gap-4 items-center">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-accent">1</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("home.arch.flow.step1")}</p>
              </div>
              <ArrowRight className="hidden md:block w-6 h-6 text-border mx-auto" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-accent">2</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("home.arch.flow.step2")}</p>
              </div>
              <ArrowRight className="hidden md:block w-6 h-6 text-border mx-auto" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-accent">3</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("home.arch.flow.step3")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
