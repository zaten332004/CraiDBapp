import { Github, FileText, Mail } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const technologies = [
  "FastAPI",
  "MySQL",
  "Next.js",
  "Gemini",
  "Power BI",
  "scikit-learn",
  "AWS (boto3)",
  "JWT / OAuth",
];

const links = [
  { href: "#architecture", key: "nav.architecture" },
  { href: "#features", key: "nav.features" },
  { href: "#technology", key: "nav.technology" },
  { href: "#demo", key: "nav.demo" },
  { href: "#use-cases", key: "nav.use_cases" },
  { href: "#about", key: "nav.about" },
] as const;

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="py-16 bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="font-bold text-accent-foreground text-sm">CR</span>
              </div>
              <span className="font-semibold text-lg text-foreground">CRAI DB</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md text-pretty">
              {t("home.footer.desc")}
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
              >
                <FileText className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t("home.footer.nav")}</h4>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t(link.key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Technologies */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t("home.footer.tech")}</h4>
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-xs bg-secondary rounded text-muted-foreground border border-border"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t("home.footer.bottom1")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("home.footer.bottom2")}
          </p>
        </div>
      </div>
    </footer>
  );
}
