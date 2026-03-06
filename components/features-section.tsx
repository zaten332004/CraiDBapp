import {
  TrendingUp,
  Eye,
  PieChart,
  Bell,
  MessageCircle,
  FileText,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const features = [
  {
    icon: TrendingUp,
    titleKey: "home.feature.1.title",
    descriptionKey: "home.feature.1.desc",
  },
  {
    icon: Eye,
    titleKey: "home.feature.2.title",
    descriptionKey: "home.feature.2.desc",
  },
  {
    icon: PieChart,
    titleKey: "home.feature.3.title",
    descriptionKey: "home.feature.3.desc",
  },
  {
    icon: Bell,
    titleKey: "home.feature.4.title",
    descriptionKey: "home.feature.4.desc",
  },
  {
    icon: MessageCircle,
    titleKey: "home.feature.5.title",
    descriptionKey: "home.feature.5.desc",
  },
  {
    icon: FileText,
    titleKey: "home.feature.6.title",
    descriptionKey: "home.feature.6.desc",
  },
];

export function FeaturesSection() {
  const { t } = useI18n();
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.features.kicker")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4 text-balance">
            {t("home.features.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.features.desc")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.titleKey}
              className="group p-6 rounded-xl bg-card border border-border hover:border-accent/50 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t(feature.titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descriptionKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
