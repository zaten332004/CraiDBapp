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
      "FastAPI",
      "Uvicorn",
      "Pydantic",
      "pydantic-settings",
      "SQLAlchemy",
      "PyMySQL",
      "MySQL",
      "pandas",
      "NumPy",
      "scikit-learn",
      "openpyxl",
    ],
    descriptionKey: "home.tech.cat.backend_desc",
  },
  {
    categoryKey: "home.tech.cat.dashboard",
    icon: BarChart3,
    items: ["Power BI REST API", "DAX", "Service Principal", "Semantic model", "ExecuteQueries"],
    descriptionKey: "home.tech.cat.dashboard_desc",
  },
  {
    categoryKey: "home.tech.cat.frontend",
    icon: Monitor,
    items: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Tailwind CSS 4",
      "shadcn/ui",
      "Recharts",
      "Zod",
      "Sonner",
    ],
    descriptionKey: "home.tech.cat.frontend_desc",
  },
  {
    categoryKey: "home.tech.cat.chatbot",
    icon: Sparkles,
    items: [
      "Google Gemini",
      "google-genai",
      "google-generativeai",
      "REST / JSON",
      "Power BI context",
      "CSV / file context",
    ],
    descriptionKey: "home.tech.cat.chatbot_desc",
  },
  {
    categoryKey: "home.tech.cat.cloud",
    icon: Cloud,
    items: ["Railway", "HTTPX", "pytest", "python-dotenv"],
    descriptionKey: "home.tech.cat.cloud_desc",
  },
  {
    categoryKey: "home.tech.cat.security",
    icon: Shield,
    items: ["JWT (python-jose)", "passlib", "bcrypt", "OAuth (Google)", "Audit logs", "RBAC"],
    descriptionKey: "home.tech.cat.security_desc",
  },
] as const;

/**
 * Thẻ rút gọn ở footer — mỗi mục tương ứng một trục của section Công nghệ:
 * backend, DB, frontend, AI, BI, ML, cloud, bảo mật.
 */
export const footerTechnologyTags: readonly string[] = [
  "FastAPI",
  "MySQL",
  "Next.js 16",
  "Google Gemini",
  "Power BI",
  "scikit-learn",
  "Railway",
  "JWT / OAuth",
];
