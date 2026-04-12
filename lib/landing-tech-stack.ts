import type { LucideIcon } from "lucide-react";
import { BarChart3, Cloud, Monitor, Server, Shield, Sparkles } from "lucide-react";

export type LandingTechCategory = {
  categoryKey: string;
  icon: LucideIcon;
  items: readonly string[];
  descriptionKey: string;
};

/** Nội dung các thẻ trong section #technology — một nguồn để footer khớp bản rút gọn. */
export const technologyCategories: readonly LandingTechCategory[] = [
  {
    categoryKey: "home.tech.cat.backend",
    icon: Server,
    items: [
      "Business APIs (FastAPI)",
      "MySQL database",
      "Structured data access",
      "Excel import",
      "Analytics & risk scoring",
    ],
    descriptionKey: "home.tech.cat.backend_desc",
  },
  {
    categoryKey: "home.tech.cat.dashboard",
    icon: BarChart3,
    items: [
      "Power BI reporting",
      "DAX analytics",
      "Secure service sign-in",
      "Semantic data models",
      "Dashboard-linked metrics",
    ],
    descriptionKey: "home.tech.cat.dashboard_desc",
  },
  {
    categoryKey: "home.tech.cat.frontend",
    icon: Monitor,
    items: [
      "Next.js web application",
      "Responsive layout",
      "Charts & KPIs",
      "Form validation",
      "Clear user notifications",
    ],
    descriptionKey: "home.tech.cat.frontend_desc",
  },
  {
    categoryKey: "home.tech.cat.chatbot",
    icon: Sparkles,
    items: [
      "Google Gemini",
      "Natural-language Q&A",
      "Power BI context",
      "CSV & file attachments",
      "Configurable bank FAQ",
    ],
    descriptionKey: "home.tech.cat.chatbot_desc",
  },
  {
    categoryKey: "home.tech.cat.cloud",
    icon: Cloud,
    items: ["Cloud hosting (Railway)", "Managed MySQL", "Automated testing", "Environment-based settings"],
    descriptionKey: "home.tech.cat.cloud_desc",
  },
  {
    categoryKey: "home.tech.cat.security",
    icon: Shield,
    items: [
      "Secure sessions",
      "Strong password protection",
      "Google sign-in (optional)",
      "Role-based access",
      "Audit trail",
    ],
    descriptionKey: "home.tech.cat.security_desc",
  },
] as const;

/**
 * Thẻ rút gọn ở footer — mỗi mục tương ứng một trục của section Công nghệ:
 * backend, DB, frontend, AI, BI, ML, cloud, bảo mật.
 */
export const footerTechnologyTags: readonly string[] = [
  "API & MySQL",
  "Web application",
  "Google Gemini",
  "Power BI",
  "Risk analytics",
  "Cloud hosting",
  "Role-based access",
  "Audit logs",
];
