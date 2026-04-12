import { POWER_BI_DEFAULT_TABLE_SUGGESTIONS } from '@/lib/powerbi/reference-tables';

const STORAGE_KEY = 'crs.powerbi.table-suggestions.v1';

function uniqueTrimmed(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const s = String(raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function getDefaultPowerBiTableSuggestions(): string[] {
  return [...POWER_BI_DEFAULT_TABLE_SUGGESTIONS];
}

export function loadPowerBiTableSuggestions(): string[] {
  if (typeof window === 'undefined') return getDefaultPowerBiTableSuggestions();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPowerBiTableSuggestions();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return getDefaultPowerBiTableSuggestions();
    const cleaned = uniqueTrimmed(parsed.map((x) => String(x)));
    return cleaned.length ? cleaned : getDefaultPowerBiTableSuggestions();
  } catch {
    return getDefaultPowerBiTableSuggestions();
  }
}

export function savePowerBiTableSuggestions(names: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueTrimmed(names)));
  } catch {
    /* ignore quota / private mode */
  }
}
