import { redirect } from 'next/navigation';

/** Bulk scoring UI removed: risk is set on customer CSV upload. Keep URL for bookmarks. */
export default function RiskBatchRedirectPage() {
  redirect('/dashboard/upload');
}
