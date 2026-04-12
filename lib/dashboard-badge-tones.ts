/**
 * Semantic badge classes: pastel on light mode, translucent saturated fills on dark (#2B2D31)
 * so pills stay legible and don’t sink into the row background.
 */
export const badgeTone = {
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/32 dark:text-emerald-50',
  teal: 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-400/60 dark:bg-teal-500/32 dark:text-teal-50',
  sky: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-400/60 dark:bg-sky-500/32 dark:text-sky-50',
  blue: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-400/60 dark:bg-blue-500/32 dark:text-blue-50',
  indigo:
    'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-400/60 dark:bg-indigo-500/32 dark:text-indigo-50',
  violet:
    'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-400/60 dark:bg-violet-500/32 dark:text-violet-50',
  purple:
    'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-400/60 dark:bg-purple-500/32 dark:text-purple-50',
  amber:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/65 dark:bg-amber-500/30 dark:text-amber-50',
  orange:
    'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-400/60 dark:bg-orange-500/32 dark:text-orange-50',
  rose: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/60 dark:bg-rose-500/32 dark:text-rose-50',
  red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-400/60 dark:bg-red-500/32 dark:text-red-50',
  cyan: 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-400/60 dark:bg-cyan-500/32 dark:text-cyan-50',
  lime: 'border-lime-300 bg-lime-50 text-lime-950 dark:border-lime-400/60 dark:bg-lime-500/28 dark:text-lime-50',
  slate:
    'border-slate-300 bg-slate-50 text-slate-900 dark:border-zinc-500/55 dark:bg-zinc-600/40 dark:text-zinc-50',
} as const;
