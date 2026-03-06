"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, MessageSquare, TrendingUp, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const demoTabs = [
  { id: "dashboard", labelKey: "home.demo.tab.dashboard", icon: BarChart3 },
  { id: "chatbot", labelKey: "home.demo.tab.chatbot", icon: MessageSquare },
  { id: "shap", labelKey: "home.demo.tab.shap", icon: TrendingUp },
];

export function DemoSection() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { t } = useI18n();

  return (
    <section id="demo" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.demo.kicker")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4 text-balance">
            {t("home.demo.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.demo.desc")}
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {demoTabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className="gap-2"
            >
              <tab.icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </Button>
          ))}
        </div>

        {/* Demo content */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Window header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-secondary border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <div className="w-3 h-3 rounded-full bg-chart-4/50" />
              <div className="w-3 h-3 rounded-full bg-chart-3/50" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">
              {activeTab === "dashboard" && t("home.demo.window.dashboard")}
              {activeTab === "chatbot" && t("home.demo.window.chatbot")}
              {activeTab === "shap" && t("home.demo.window.shap")}
            </span>
          </div>

          {/* Demo area */}
          <div className="p-8 min-h-[400px]">
            {activeTab === "dashboard" && <DashboardDemo />}
            {activeTab === "chatbot" && <ChatbotDemo />}
            {activeTab === "shap" && <ShapDemo />}
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardDemo() {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI Cards */}
      <div className="p-4 rounded-lg bg-secondary border border-border">
        <p className="text-xs text-muted-foreground mb-1">{t("home.demo.kpi.total_loans")}</p>
        <p className="text-2xl font-bold text-foreground">12,847</p>
        <p className="text-xs text-accent mt-1">{t("home.demo.kpi.total_loans_delta")}</p>
      </div>
      <div className="p-4 rounded-lg bg-secondary border border-border">
        <p className="text-xs text-muted-foreground mb-1">{t("home.demo.kpi.portfolio_value")}</p>
        <p className="text-2xl font-bold text-foreground">$847M</p>
        <p className="text-xs text-chart-3 mt-1">{t("home.demo.kpi.portfolio_value_delta")}</p>
      </div>
      <div className="p-4 rounded-lg bg-secondary border border-border">
        <p className="text-xs text-muted-foreground mb-1">{t("home.demo.kpi.avg_risk_score")}</p>
        <p className="text-2xl font-bold text-foreground">0.23</p>
        <p className="text-xs text-accent mt-1">{t("risk.level.low")}</p>
      </div>
      <div className="p-4 rounded-lg bg-secondary border border-border">
        <p className="text-xs text-muted-foreground mb-1">{t("home.demo.kpi.delinquency_rate")}</p>
        <p className="text-2xl font-bold text-foreground">2.4%</p>
        <p className="text-xs text-destructive mt-1">{t("home.demo.kpi.delinquency_rate_delta")}</p>
      </div>

      {/* Chart placeholder */}
      <div className="col-span-2 lg:col-span-3 p-4 rounded-lg bg-secondary border border-border">
        <p className="text-sm font-medium text-foreground mb-4">{t("home.demo.chart.risk_dist_segment")}</p>
        <div className="flex items-end justify-between h-40 gap-2">
          {[65, 45, 80, 55, 70, 40, 85, 60, 50, 75, 45, 90].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-accent/30 rounded-t hover:bg-accent/50 transition-colors"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Jan</span>
          <span>Jun</span>
          <span>Dec</span>
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="col-span-2 lg:col-span-1 p-4 rounded-lg bg-secondary border border-border">
        <p className="text-sm font-medium text-foreground mb-4">Risk Categories</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <span className="text-xs text-muted-foreground">Low</span>
            </div>
            <span className="text-sm font-medium text-foreground">68%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-4" />
              <span className="text-xs text-muted-foreground">Medium</span>
            </div>
            <span className="text-sm font-medium text-foreground">24%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
            <span className="text-sm font-medium text-foreground">8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatbotDemo() {
  const { t } = useI18n();
  const messages = [
    { role: "user", content: t("home.demo.chat.q1") },
    { role: "assistant", content: t("home.demo.chat.a1") },
    { role: "user", content: t("home.demo.chat.q2") },
    { role: "assistant", content: t("home.demo.chat.a2") },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-xl ${
                message.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-foreground border border-border"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
        <input
          type="text"
          placeholder={t("home.demo.chat.placeholder")}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <Button size="sm">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ShapDemo() {
  const { t } = useI18n();
  const shapValues = [
    { feature: t("home.demo.shap.f1"), value: 0.34, impact: "positive" },
    { feature: t("home.demo.shap.f2"), value: 0.28, impact: "negative" },
    { feature: t("home.demo.shap.f3"), value: 0.19, impact: "positive" },
    { feature: t("home.demo.shap.f4"), value: -0.15, impact: "negative" },
    { feature: t("home.demo.shap.f5"), value: 0.12, impact: "positive" },
    { feature: t("home.demo.shap.f6"), value: -0.08, impact: "negative" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 rounded-lg bg-secondary border border-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("home.demo.shap.customer_id")}: 12847</p>
            <p className="text-lg font-semibold text-foreground">Acme Corporation</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t("home.demo.shap.predicted_pd")}</p>
            <p className="text-2xl font-bold text-destructive">0.78</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[78%] bg-destructive rounded-full" />
        </div>
      </div>

      <h4 className="text-sm font-medium text-foreground mb-4">{t("home.demo.shap.title")}</h4>
      <div className="space-y-3">
        {shapValues.map((item) => (
          <div key={item.feature} className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-40 truncate">{item.feature}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-6 relative bg-muted rounded overflow-hidden">
                <div
                  className={`absolute top-0 bottom-0 ${item.impact === "positive" ? "bg-destructive/70 left-1/2" : "bg-chart-3/70 right-1/2"}`}
                  style={{ width: `${Math.abs(item.value) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-medium w-12 text-right ${item.impact === "positive" ? "text-destructive" : "text-chart-3"}`}>
                {item.value > 0 ? "+" : ""}{item.value.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        {t("home.demo.shap.note")}
      </p>
    </div>
  );
}
