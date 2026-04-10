import { redirect } from 'next/navigation';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const next = typeof searchParams?.next === 'string' ? searchParams?.next : undefined;
  const reason = typeof searchParams?.reason === 'string' ? searchParams.reason : undefined;
  const params = new URLSearchParams();
  params.set('mode', 'login');
  if (next) params.set('next', next);
  if (reason) params.set('reason', reason);
  redirect(`/auth?${params.toString()}`);
}
