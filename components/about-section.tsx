import { Lightbulb, Target, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function AboutSection() {
  const { t } = useI18n();
  return (
    <section id="about" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.about.kicker")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-6 text-balance">
              {t("home.about.title")}
            </h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed text-pretty">
              {t("home.about.p1")}
            </p>
            <p className="text-muted-foreground mb-8 leading-relaxed text-pretty">
              {t("home.about.p2")}
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{t("home.about.item1.title")}</h4>
                  <p className="text-sm text-muted-foreground">{t("home.about.item1.desc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{t("home.about.item2.title")}</h4>
                  <p className="text-sm text-muted-foreground">{t("home.about.item2.desc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{t("home.about.item3.title")}</h4>
                  <p className="text-sm text-muted-foreground">{t("home.about.item3.desc")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-xl font-semibold text-foreground mb-6">{t("home.about.highlights")}</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <p className="text-3xl font-bold text-accent mb-1">6+</p>
                  <p className="text-sm text-muted-foreground">{t("home.about.hl.layers")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <p className="text-3xl font-bold text-accent mb-1">ML</p>
                  <p className="text-sm text-muted-foreground">{t("home.about.hl.ml")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <p className="text-3xl font-bold text-accent mb-1">SHAP</p>
                  <p className="text-sm text-muted-foreground">{t("home.about.hl.shap")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <p className="text-3xl font-bold text-accent mb-1">{t("home.about.hl.cloud_brand")}</p>
                  <p className="text-sm text-muted-foreground">{t("home.about.hl.cloud_tagline")}</p>
                </div>
              </div>
            </div>
            {/* Decorative element */}
            <div className="absolute -z-10 top-4 left-4 right-4 bottom-4 rounded-2xl bg-accent/10 blur-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
