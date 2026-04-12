"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  FileText,
  MessageSquare,
  MoreHorizontal,
  PieChart,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChatMarkdown } from "@/components/ai-chat/chat-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { CRAIDB_SET_DEMO_TAB_EVENT, type CraidbDemoTabPayload } from "@/lib/home-events";
import { formatCompactVnd } from "@/lib/money";

const demoTabs = [
  { id: "dashboard", labelKey: "home.demo.tab.dashboard", icon: BarChart3 },
  { id: "chatbot", labelKey: "home.demo.tab.chatbot", icon: MessageSquare },
  { id: "shap", labelKey: "home.demo.tab.shap", icon: TrendingUp },
];

export function DemoSection() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { t } = useI18n();

  useEffect(() => {
    const onSetTab = (e: Event) => {
      const ce = e as CustomEvent<CraidbDemoTabPayload>;
      const tab = ce.detail?.tab;
      if (tab === "dashboard" || tab === "chatbot" || tab === "shap") setActiveTab(tab);
    };
    window.addEventListener(CRAIDB_SET_DEMO_TAB_EVENT, onSetTab);
    return () => window.removeEventListener(CRAIDB_SET_DEMO_TAB_EVENT, onSetTab);
  }, []);

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
              <div className="h-3 w-3 rounded-full bg-rose-500/28" aria-hidden />
              <div className="h-3 w-3 rounded-full bg-amber-400/32" aria-hidden />
              <div className="h-3 w-3 rounded-full bg-emerald-500/26" aria-hidden />
            </div>
            <span className="text-xs text-muted-foreground ml-2">
              {activeTab === "dashboard" && t("home.demo.window.dashboard")}
              {activeTab === "chatbot" && t("home.demo.window.chatbot")}
              {activeTab === "shap" && t("home.demo.window.shap")}
            </span>
          </div>

          {/* Demo area */}
          <div
            className={cn(
              "p-6 sm:p-8",
              activeTab === "shap" ? "min-h-[640px]" : activeTab === "chatbot" ? "min-h-[560px]" : "min-h-[480px]",
            )}
          >
            {activeTab === "dashboard" && <DashboardDemo />}
            {activeTab === "chatbot" && <ChatbotDemo />}
            {activeTab === "shap" && <RiskAnalyzeDemo />}
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoKpiCard({ title, value, icon: Icon }: { title: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-accent" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardDemo() {
  const { locale, t } = useI18n();
  const moneyLocale = locale === "vi" ? "vi" : "en";

  const mockTrend = useMemo(() => {
    const months =
      moneyLocale === "vi" ? ["T1", "T2", "T3", "T4", "T5", "T6"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const rows = [
      { value: 112e9, score: 71 },
      { value: 118e9, score: 72.5 },
      { value: 115e9, score: 72 },
      { value: 121e9, score: 73.1 },
      { value: 124e9, score: 73 },
      { value: 127e9, score: 74 },
    ];
    return rows.map((r, i) => ({ month: months[i], ...r }));
  }, [moneyLocale]);

  const customerDisplay = useMemo(
    () => new Intl.NumberFormat(moneyLocale === "vi" ? "vi-VN" : "en-US").format(1284),
    [moneyLocale],
  );

  const mockAlerts = useMemo(
    () => [
      {
        id: 1,
        customer: t("home.demo.dashboard.alert1_customer"),
        message: t("home.demo.dashboard.alert1_message"),
        time: t("home.demo.dashboard.alert1_time"),
      },
      {
        id: 2,
        customer: t("home.demo.dashboard.alert2_customer"),
        message: t("home.demo.dashboard.alert2_message"),
        time: t("home.demo.dashboard.alert2_time"),
      },
      {
        id: 3,
        customer: t("home.demo.dashboard.alert3_customer"),
        message: t("home.demo.dashboard.alert3_message"),
        time: t("home.demo.dashboard.alert3_time"),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground text-center sm:text-left">{t("home.demo.sample_note")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DemoKpiCard title={t("home.demo.dashboard.kpi_portfolio")} value="78" icon={TrendingUp} />
        <DemoKpiCard title={t("home.demo.dashboard.kpi_customers")} value={customerDisplay} icon={Users} />
        <DemoKpiCard title={t("home.demo.dashboard.kpi_open_alerts")} value="3" icon={AlertCircle} />
        <DemoKpiCard
          title={t("home.demo.dashboard.kpi_system_health")}
          value={t("home.demo.dashboard.health_good")}
          icon={PieChart}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.chart_portfolio_trend_title")}</CardTitle>
            <CardDescription>{t("dashboard.chart_portfolio_trend_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mockTrend} margin={{ top: 8, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => formatCompactVnd(Number(v), moneyLocale)}
                  width={68}
                  tick={{ fontSize: 10 }}
                  tickMargin={6}
                />
                <YAxis yAxisId="right" orientation="right" width={36} tick={{ fontSize: 10 }} tickMargin={6} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "value"
                      ? [formatCompactVnd(Number(value), moneyLocale), t("dashboard.chart_legend_portfolio_value")]
                      : [value, t("dashboard.chart_legend_avg_score")]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5a6"
                  strokeWidth={2}
                  name={t("dashboard.chart_legend_portfolio_value")}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2}
                  name={t("dashboard.chart_legend_avg_score")}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.recent_alerts_title")}</CardTitle>
            <CardDescription>{t("home.demo.dashboard.alerts_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {mockAlerts.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">{item.customer}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
                </div>
                <p className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">{item.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChatbotDemo() {
  const { locale, t } = useI18n();

  const demoTimes = useMemo(() => {
    const base = new Date(2026, 0, 15, 14, 32, 0);
    return [0, 1, 2, 3].map((i) => new Date(base.getTime() + i * 90_000));
  }, []);

  const historyItems = useMemo(
    () =>
      (["home.demo.chat.history_1", "home.demo.chat.history_2", "home.demo.chat.history_3", "home.demo.chat.history_4"] as const).map(
        (key) => t(key),
      ),
    [t],
  );

  const messages = useMemo(
    () => [
      { id: "d1", sender: "user" as const, text: t("home.demo.chat.q1") },
      { id: "d2", sender: "assistant" as const, text: t("home.demo.chat.a1") },
      { id: "d3", sender: "user" as const, text: t("home.demo.chat.q2") },
      { id: "d4", sender: "assistant" as const, text: t("home.demo.chat.a2") },
    ],
    [t],
  );

  const promptKeys = useMemo(() => ["ai_chat.prompt_1", "ai_chat.prompt_2", "ai_chat.prompt_3", "ai_chat.prompt_4"] as const, []);

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-border/70 bg-[#f4f6f9] shadow-sm dark:border-border dark:bg-muted/25">
      <p className="border-b border-border/60 bg-card/80 px-4 py-2.5 text-center text-[11px] text-muted-foreground sm:text-left">
        {t("home.demo.chat.sample_note")}
      </p>

      <div className="flex min-h-[420px] flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:gap-4">
        {/* Sidebar — lịch sử */}
        <aside className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm lg:w-56 xl:w-64">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{t("home.demo.chat.sidebar_title")}</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" disabled aria-hidden>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-center gap-2 rounded-full border-sky-200/80 bg-sky-50/80 text-sky-800 hover:bg-sky-100/90 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60"
            disabled
          >
            <Plus className="h-4 w-4" />
            {t("ai_chat.new_draft")}
          </Button>
          <div className="flex flex-col gap-2">
            {historyItems.map((label, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-left shadow-sm"
              >
                <p className="min-w-0 flex-1 truncate text-xs leading-snug text-foreground">{label}</p>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" disabled aria-hidden>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <header className="border-b border-border/60 px-4 py-3 sm:px-5">
            <h3 className="text-lg font-bold tracking-tight text-foreground">{t("ai_chat.title")}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("ai_chat.desc")}</p>
          </header>

          <ScrollArea className="min-h-[200px] max-h-[min(42vh,360px)] flex-1">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {messages.map((message, i) => (
                <div key={message.id} className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("min-w-0 max-w-[min(100%,34rem)]", message.sender === "user" ? "pl-8" : "pr-6")}>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm shadow-sm",
                        message.sender === "user"
                          ? "border border-border/80 bg-background text-foreground"
                          : "bg-[#EEF2F6] text-foreground dark:bg-slate-800/90 dark:text-slate-100",
                      )}
                    >
                      {message.sender === "assistant" ? (
                        <ChatMarkdown text={message.text} className="[&_p]:my-2 [&_li]:my-0.5" />
                      ) : (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
                      )}
                      <span className="mt-2 block text-[11px] text-muted-foreground">
                        {demoTimes[i].toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 bg-muted/10 px-3 py-3 sm:px-4 sm:py-4 dark:bg-muted/5">
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <div className="rounded-2xl border border-border/70 bg-background p-3 shadow-sm dark:border-border">
                <Textarea
                  readOnly
                  tabIndex={-1}
                  rows={2}
                  placeholder={t("ai_chat.placeholder")}
                  value=""
                  className="min-h-[52px] w-full cursor-default resize-none border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                />
                <div className="mt-3 border-t border-border/50 pt-2.5 text-xs">
                  <span className="text-muted-foreground">{t("ai_chat.data_source_active")}: </span>
                  <span className="font-semibold text-foreground">{t("ai_chat.data_source_portfolio")}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full border-border/80"
                    disabled
                    aria-hidden
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1" aria-hidden />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1 rounded-full border-border/80 px-3 text-sm font-normal text-muted-foreground"
                    disabled
                  >
                    <span>{t("ai_chat.model.thinking")}</span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full border-0 bg-sky-100 text-sky-600 shadow-none hover:bg-sky-200/90 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900/70"
                    disabled
                    aria-hidden
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {promptKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled
                    className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/40 dark:border-border"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactorDemoYAxisTick(props: { x?: number; y?: number; payload?: { value?: number } }) {
  const { x, y, payload } = props;
  if (x == null || y == null || payload?.value == null) return <g />;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="fill-foreground" style={{ fontSize: 11 }}>
      {`${payload.value}%`}
    </text>
  );
}

/** Thu gọn trang `app/dashboard/risk/analyze/page.tsx` — chỉ dữ liệu mẫu, không gọi API. */
function RiskAnalyzeDemo() {
  const { locale, t } = useI18n();
  const moneyLocale = locale === "vi" ? "vi" : "en";

  const demoLastUpdated = useMemo(() => new Date(2026, 3, 12, 9, 58, 38), []);

  const factorImpactItems = useMemo(
    () => [
      { factor_key: "debt_ratio", impact: 25 },
      { factor_key: "credit_history", impact: 28 },
      { factor_key: "employment", impact: 9 },
      { factor_key: "loan_amount", impact: 19 },
      { factor_key: "income", impact: 24 },
    ],
    [],
  );

  const portfolioDistribution = useMemo(
    () => [
      { riskLevel: "low" as const, count: 0, percentage: 0 },
      { riskLevel: "medium" as const, count: 10, percentage: 63 },
      { riskLevel: "high" as const, count: 6, percentage: 37 },
    ],
    [],
  );

  const customerScatter = useMemo(() => {
    const rows: Array<{
      income: number;
      loanAmount: number;
      score: number;
      customerName: string;
      customerId: number;
      riskLevel: string;
    }> = [];
    for (let i = 1; i <= 6; i += 1) {
      rows.push({
        income: (11 + i * 2.2) * 1_000_000,
        loanAmount: (75 + i * 14) * 1_000_000,
        score: 35,
        customerName: `${t("customers.customer")} #${100 + i}`,
        customerId: 100 + i,
        riskLevel: "high",
      });
    }
    for (let i = 0; i < 10; i += 1) {
      rows.push({
        income: (14 + (i % 6) * 4.5) * 1_000_000,
        loanAmount: (35 + (i % 8) * 11) * 1_000_000,
        score: 65,
        customerName: `${t("customers.customer")} #${200 + i}`,
        customerId: 200 + i,
        riskLevel: "medium",
      });
    }
    return rows;
  }, [t]);

  const riskFactorDataLocalized = useMemo(
    () =>
      factorImpactItems.map((row) => ({
        factor: t(`risk.factor.${row.factor_key}`) || row.factor_key,
        impact: row.impact,
      })),
    [factorImpactItems, t],
  );

  const riskLabel = (level: string) => {
    switch (level) {
      case "low":
      case "medium":
      case "high":
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  const analysisSummary = useMemo(() => {
    const total = Math.max(1, customerScatter.length);
    const low = portfolioDistribution.find((x) => x.riskLevel === "low")?.count ?? 0;
    const medium = portfolioDistribution.find((x) => x.riskLevel === "medium")?.count ?? 0;
    const high = portfolioDistribution.find((x) => x.riskLevel === "high")?.count ?? 0;
    const highPct = Math.round((high / total) * 100);
    const avgIncome = customerScatter.reduce((sum, x) => sum + x.income, 0) / total;
    const avgLoan = customerScatter.reduce((sum, x) => sum + x.loanAmount, 0) / total;
    const ratio = avgIncome / Math.max(avgLoan, 1);
    const medianBand = ratio >= 2.5 ? "low" : ratio >= 1.5 ? "medium" : "high";
    const topFactor = [...riskFactorDataLocalized].sort((a, b) => b.impact - a.impact)[0];
    return { total, low, medium, high, highPct, avgIncome, avgLoan, ratio, medianBand, topFactor };
  }, [customerScatter, portfolioDistribution, riskFactorDataLocalized]);

  const dynamicInsights = useMemo(() => {
    const s = analysisSummary;
    if (locale === "vi") {
      return [
        `Danh mục hiện có ${s.total} hồ sơ: ${s.low} rủi ro thấp, ${s.medium} trung bình, ${s.high} rủi ro cao.`,
        `Tỷ trọng rủi ro cao đang ở mức ${s.highPct}%${s.highPct >= 30 ? ", cần ưu tiên giám sát và tái thẩm định." : ", đang trong ngưỡng có thể kiểm soát."}`,
        `Thu nhập bình quân khoảng ${formatCompactVnd(s.avgIncome, "vi")} và khoản vay bình quân khoảng ${formatCompactVnd(s.avgLoan, "vi")}.`,
        `Yếu tố tác động mạnh nhất hiện tại là "${s.topFactor?.factor ?? "—"}" (${s.topFactor?.impact ?? 0}%).`,
      ];
    }
    return [
      `Portfolio has ${s.total} records: ${s.low} low-risk, ${s.medium} medium-risk, ${s.high} high-risk.`,
      `High-risk share is ${s.highPct}%${s.highPct >= 30 ? ", so closer monitoring is recommended." : ", currently in a controllable range."}`,
      `Average income is around ${formatCompactVnd(s.avgIncome, "en")} and average loan is around ${formatCompactVnd(s.avgLoan, "en")}.`,
      `The strongest impact factor right now is "${s.topFactor?.factor ?? "—"}" (${s.topFactor?.impact ?? 0}%).`,
    ];
  }, [analysisSummary, locale]);

  const dynamicCorrelationSummary = useMemo(() => {
    const s = analysisSummary;
    if (locale === "vi") {
      return `Phân tích dữ liệu mẫu cho thấy tỷ lệ thu nhập/khoản vay trung bình là ${s.ratio.toFixed(2)}; tương ứng mức rủi ro ${riskLabel(s.medianBand)}.`;
    }
    return `Sample data shows an average income-to-loan ratio of ${s.ratio.toFixed(2)}, which aligns with ${riskLabel(s.medianBand)} risk.`;
  }, [analysisSummary, locale]);

  const dynamicIndicators = useMemo(() => {
    if (locale === "vi") {
      return [
        `Tỷ lệ thu nhập/khoản vay >= 2.5: xu hướng ${riskLabel("low")}.`,
        `Tỷ lệ thu nhập/khoản vay từ 1.5-2.5: xu hướng ${riskLabel("medium")}.`,
        `Tỷ lệ thu nhập/khoản vay < 1.5: xu hướng ${riskLabel("high")}.`,
      ];
    }
    return [
      `Income-to-loan ratio >= 2.5: tends toward ${riskLabel("low")} risk.`,
      `Income-to-loan ratio 1.5-2.5: tends toward ${riskLabel("medium")} risk.`,
      `Income-to-loan ratio < 1.5: tends toward ${riskLabel("high")} risk.`,
    ];
  }, [locale, t]);

  const topDist = [...portfolioDistribution].sort((a, b) => b.count - a.count)[0];
  const avgScore = Math.round(
    customerScatter.reduce((sum, x) => sum + x.score, 0) / Math.max(1, customerScatter.length),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("risk.analyze.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("risk.analyze.desc")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === "vi"
            ? `Cập nhật lần cuối: ${demoLastUpdated.toLocaleTimeString("vi-VN")}`
            : `Last updated: ${demoLastUpdated.toLocaleTimeString("en-US")}`}
        </p>
        <p className="text-xs text-muted-foreground">{t("home.demo.risk.sample_note")}</p>
      </div>

      <Tabs defaultValue="factors" className="w-full">
        <TabsList>
          <TabsTrigger value="factors">{t("risk.analyze.factors_tab")}</TabsTrigger>
          <TabsTrigger value="distribution">{t("risk.analyze.distribution_tab")}</TabsTrigger>
          <TabsTrigger value="correlation">{t("risk.analyze.correlation_tab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="factors" className="space-y-4">
          <Card className="gap-2 py-4 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle>{t("risk.analyze.factors_title")}</CardTitle>
              <CardDescription>{t("risk.analyze.factors_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="w-full min-w-0 overflow-visible px-3 pb-1 pt-0 sm:px-6 sm:pb-2">
              <div className="h-[min(320px,42vh)] w-full min-h-[220px] overflow-visible">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskFactorDataLocalized}
                    margin={{ top: 8, right: 10, left: 12, bottom: 22 }}
                    barCategoryGap="6%"
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="factor"
                      interval={0}
                      angle={0}
                      textAnchor="middle"
                      tick={{ fontSize: 11 }}
                      tickMargin={2}
                      height={34}
                    />
                    <YAxis
                      domain={[0, 100]}
                      width={56}
                      tick={FactorDemoYAxisTick}
                      ticks={[0, 25, 50, 75, 100]}
                      orientation="left"
                      axisLine={false}
                    />
                    <Tooltip formatter={(v: number) => [`${v}%`, t("risk.analyze.impact_pct")]} />
                    <Bar
                      dataKey="impact"
                      fill="#06b6d4"
                      name={t("risk.analyze.impact_pct")}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={140}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("risk.analyze.insights")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dynamicInsights.map((insight, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <p className="text-sm text-muted-foreground">{insight}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("risk.analyze.portfolio_dist_title")}</CardTitle>
              <CardDescription>{t("risk.analyze.portfolio_dist_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {portfolioDistribution.map((item, idx) => (
                  <div key={idx}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{riskLabel(item.riskLevel)}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} {t("customers.items")} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-accent transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("risk.analyze.key_metrics")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t("customers.total")}</p>
                  <p className="mt-2 text-2xl font-bold">{customerScatter.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("customers.avg_score")}</p>
                  <p className="mt-2 text-2xl font-bold">{avgScore}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("risk.analyze.portfolio_risk")}</p>
                  <p className="mt-2 text-2xl font-bold">{riskLabel(topDist?.riskLevel || "medium")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("risk.analyze.correlation_title")}</CardTitle>
              <CardDescription>{t("risk.analyze.correlation_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="income"
                    name={t("customers.annual_income_short")}
                    tickFormatter={(v) => formatCompactVnd(Number(v), moneyLocale)}
                  />
                  <YAxis
                    dataKey="loanAmount"
                    name={t("customers.loan_amount_short")}
                    tickFormatter={(v) => formatCompactVnd(Number(v), moneyLocale)}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as {
                        customerName?: string;
                        customerId?: number;
                        income?: number;
                        loanAmount?: number;
                        riskLevel?: string;
                      };
                      return (
                        <div className="rounded-md border bg-background p-3 text-xs">
                          <div className="font-semibold">
                            {row.customerName || `${t("customers.customer")} #${row.customerId}`}
                          </div>
                          <div>
                            {t("customers.annual_income_short")}: {formatCompactVnd(Number(row.income || 0), moneyLocale)}
                          </div>
                          <div>
                            {t("customers.loan_amount_short")}: {formatCompactVnd(Number(row.loanAmount || 0), moneyLocale)}
                          </div>
                          <div>
                            {t("customers.risk_level")}: {riskLabel(String(row.riskLevel || "medium"))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name={t("customers.title")} data={customerScatter} fill="#06b6d4" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("risk.analyze.findings_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{dynamicCorrelationSummary}</p>
              <div className="space-y-2 rounded-lg bg-secondary p-4">
                <p className="text-sm font-medium">{t("risk.analyze.strong_indicators")}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {dynamicIndicators.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
