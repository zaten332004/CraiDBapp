'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { authJsonHeaders } from '@/lib/auth/token';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';

export default function NewCustomerPage() {
  const { t } = useI18n();
  const router = useRouter();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    income: '',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isViewer) {
        throw new Error(t('common.viewer_readonly'));
      }
      const response = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          income: parseFloat(formData.income),
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || t('customers.new.failed'));
      }

      router.push('/dashboard/customers');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('customers.new.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('customers.new.desc')}
          </p>
        </div>
      </div>

      {isViewer && (
        <Alert>
          <AlertDescription>
            {t('customers.new.viewer_notice_prefix')}{' '}
            <span className="font-medium">{t('role.viewer')}</span>. {t('customers.new.viewer_notice_suffix')}
          </AlertDescription>
        </Alert>
      )}

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('customers.new.card_title')}</CardTitle>
            <CardDescription>
              {t('customers.new.card_desc')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('common.full_name')} *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={t('common.full_name_ph')}
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.email')} *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('common.email_ph')}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('common.phone')}</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder={t('common.phone_ph')}
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">{t('common.company')}</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder={t('common.company_ph')}
                    value={formData.company}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="income">{t('customers.new.income')}</Label>
                <Input
                  id="income"
                  name="income"
                  type="number"
                  placeholder={t('customers.new.income_ph')}
                  value={formData.income}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.additional_notes')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('common.additional_notes_ph')}
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isLoading}
                  rows={4}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Link href="/dashboard/customers" className="flex-1">
                  <Button variant="outline" className="w-full" disabled={isLoading}>
                    {t('common.cancel')}
                  </Button>
                </Link>
                <Button type="submit" className="flex-1" disabled={isLoading || isViewer}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.creating')}
                    </>
                  ) : (
                    t('customers.new.create')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
