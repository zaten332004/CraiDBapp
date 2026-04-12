"use client";

import { Server, BarChart3, Monitor, Sparkles, Cloud, Shield } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const technologies = [
  {
    categoryKey: "home.tech.cat.backend",
    icon: Server,
    items: [
      "FastAPI",
      "Uvicorn",
      "Pydantic",
      "SQLAlchemy",
      "PyMySQL",
      "pandas",
      "scikit-learn",
      "NumPy",
    ],
    descriptionKey: "home.tech.cat.backend_desc",
  },
  {
    categoryKey: "home.tech.cat.dashboard",
    icon: BarChart3,
    items: ["Power BI REST API", "DAX", "Service Principal", "Semantic model"],
    descriptionKey: "home.tech.cat.dashboard_desc",
  },
  {
    categoryKey: "home.tech.cat.frontend",
    icon: Monitor,
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui"],
    descriptionKey: "home.tech.cat.frontend_desc",
  },
  {
    categoryKey: "home.tech.cat.chatbot",
    icon: Sparkles,
    items: ["Google Gemini", "google-genai", "REST / JSON", "Power BI context"],
    descriptionKey: "home.tech.cat.chatbot_desc",
  },
  {
    categoryKey: "home.tech.cat.cloud",
    icon: Cloud,
    items: ["boto3 (AWS SDK)", "HTTPX", "pytest"],
    descriptionKey: "home.tech.cat.cloud_desc",
  },
  {
    categoryKey: "home.tech.cat.security",
    icon: Shield,
    items: ["JWT (python-jose)", "bcrypt", "OAuth (Google)", "Audit logs", "RBAC"],
    descriptionKey: "home.tech.cat.security_desc",
  },
];

export function TechnologySection() {
  const { t } = useI18n();
  return (
    <section id="technology" className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm text-accent font-medium uppercase tracking-wider">{t("home.tech.kicker")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4 text-balance">
            {t("home.tech.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.tech.desc")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {technologies.map((tech) => (
            <div
              key={tech.categoryKey}
              className="p-6 rounded-xl bg-secondary border border-border hover:border-accent/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <tech.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(tech.categoryKey)}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t(tech.descriptionKey)}</p>
              <div className="flex flex-wrap gap-2">
                {tech.items.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 text-xs font-medium bg-background rounded-full text-muted-foreground border border-border"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
