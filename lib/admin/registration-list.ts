export type RegistrationType = 'manager' | 'analyst';

export type RegistrationRow = {
  id: string;
  name: string;
  /** Họ tên đầy đủ từ API (nếu có), để hiển thị cạnh username. */
  fullName: string | null;
  email: string;
  type: RegistrationType;
  requestedAt?: string | null;
  raw: unknown;
};

export function extractRegistrationList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.value)) return o.value;
  }
  return [];
}

export function usernameFromEmail(email: unknown) {
  const raw = String(email ?? '').trim();
  if (!raw) return '';
  const atIndex = raw.indexOf('@');
  if (atIndex <= 0) return raw;
  return raw.slice(0, atIndex).trim();
}

export function normalizeRegistrationRow(item: unknown, fallbackType: RegistrationType = 'analyst'): RegistrationRow | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = String(o.user_id ?? o.userId ?? o.id ?? o.registration_id ?? o.registrationId ?? '').trim();
  if (!id) return null;
  const email = String(o.email ?? '').trim() || '—';
  const preferredUsername =
    usernameFromEmail(email) ||
    String(o.username ?? '').trim() ||
    String(o.name ?? o.full_name ?? o.fullName ?? '').trim();
  const name = preferredUsername || id;
  const fullNameRaw = String(o.full_name ?? o.fullName ?? '').trim();
  const fullName = fullNameRaw && fullNameRaw !== name ? fullNameRaw : null;
  const typeRaw = String(o.user_type ?? o.userType ?? o.reg_type ?? o.type ?? o.role ?? fallbackType)
    .trim()
    .toLowerCase();
  const type: RegistrationType = typeRaw === 'manager' ? 'manager' : 'analyst';
  const requestedAt = String(o.requested_at ?? o.requestedAt ?? o.created_at ?? o.createdAt ?? '') || null;
  return { id, name, fullName, email, type, requestedAt, raw: item };
}
