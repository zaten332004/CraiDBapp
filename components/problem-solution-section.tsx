import { AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function ProblemSolutionSection() {
  const { t } = useI18n();
  const problems = [t("home.problem.1"), t("home.problem.2"), t("home.problem.3"), t("home.problem.4")];
  const solutions = [t("home.solution.1"), t("home.solution.2"), t("home.solution.3"), t("home.solution.4")];

  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
            {t("home.problem_solution.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("home.problem_solution.desc")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Problems */}
          <div className="p-8 rounded-2xl bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{t("home.problem_solution.problem_title")}</h3>
            </div>
            <ul className="space-y-4">
              {problems.map((problem, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-destructive font-medium">{index + 1}</span>
                  </span>
                  <span className="text-muted-foreground">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div className="p-8 rounded-2xl bg-accent/5 border border-accent/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{t("home.problem_solution.solution_title")}</h3>
            </div>
            <ul className="space-y-4">
              {solutions.map((solution, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-accent" />
                  </span>
                  <span className="text-muted-foreground">{solution}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Transformation arrow */}
        <div className="flex justify-center mt-12">
          <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-secondary border border-border">
            <span className="text-sm text-muted-foreground">{t("home.problem_solution.from")}</span>
            <ArrowRight className="w-4 h-4 text-accent" />
            <span className="text-sm text-foreground font-medium">{t("home.problem_solution.to")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
