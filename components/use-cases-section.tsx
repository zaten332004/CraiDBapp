import { UserCheck, TrendingUp, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const useCases = [
  {
    icon: UserCheck,
    title: { vi: "Cán bộ tín dụng", en: "Credit Officers" },
    subtitle: { vi: "Thẩm định hồ sơ vay", en: "Loan Application Review" },
    description: {
      vi: "Đánh giá nhanh hồ sơ vay với chấm điểm tự động và giải thích rõ các yếu tố ảnh hưởng đến quyết định.",
      en: "Quickly assess loan applications with automated risk scoring and clear explanations of factors affecting each decision.",
    },
    benefits: {
      vi: ["Ra quyết định nhanh hơn", "Giảm phân tích thủ công", "Đánh giá nhất quán"],
      en: ["Faster decision-making", "Reduced manual analysis", "Consistent evaluations"],
    },
  },
  {
    icon: TrendingUp,
    title: { vi: "Quản lý rủi ro", en: "Risk Managers" },
    subtitle: { vi: "Giám sát sức khoẻ danh mục", en: "Portfolio Health Monitoring" },
    description: {
      vi: "Theo dõi hiệu suất danh mục theo thời gian thực, phát hiện rủi ro mới và hành động giảm thiểu tổn thất.",
      en: "Monitor portfolio performance in real-time, identify emerging risks, and take proactive measures to mitigate losses.",
    },
    benefits: {
      vi: ["Cảnh báo sớm", "Phân tích xu hướng", "Đào sâu theo phân khúc"],
      en: ["Early warning alerts", "Trend analysis", "Segment deep-dives"],
    },
  },
  {
    icon: Search,
    title: { vi: "Chuyên viên phân tích", en: "Analysts" },
    subtitle: { vi: "Khám phá mô hình", en: "Model Exploration" },
    description: {
      vi: "Khám phá dự đoán mô hình qua SHAP, kiểm chứng giả định và truyền đạt kết quả cho các bên liên quan.",
      en: "Explore model predictions through SHAP explanations, validate assumptions, and communicate findings to stakeholders.",
    },
    benefits: {
      vi: ["Insight minh bạch", "Hỗ trợ tuân thủ", "Báo cáo cho stakeholder"],
      en: ["Transparent insights", "Regulatory compliance", "Stakeholder reports"],
    },
  },
];

export function UseCasesSection() {
  const { locale, t } = useI18n();
  return (
    <section id="use-cases" className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.use_cases.kicker")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4 text-balance">
            {t("home.use_cases.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.use_cases.desc")}
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {useCases.map((useCase) => (
            <div
              key={useCase.title.en}
              className="flex h-full flex-col p-6 rounded-xl bg-secondary border border-border hover:border-accent/30 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <useCase.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <h3 className="text-lg font-semibold text-foreground">{useCase.title[locale]}</h3>
                  <p className="text-sm text-accent mb-2">{useCase.subtitle[locale]}</p>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{useCase.description[locale]}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {useCase.benefits[locale].map((benefit) => (
                      <span
                        key={benefit}
                        className="px-3 py-1 text-xs bg-background rounded-full text-muted-foreground border border-border"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
