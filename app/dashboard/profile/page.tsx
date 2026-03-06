'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/components/i18n-provider';

export default function ProfilePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    name: 'Your Name',
    email: 'your@example.com',
    phone: '+1 (555) 123-4567',
    company: 'Your Company',
    role: 'Manager',
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('profile.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('profile.desc')}
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">{t('profile.tab.general')}</TabsTrigger>
          <TabsTrigger value="security">{t('profile.tab.security')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('profile.tab.notifications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.general.title')}</CardTitle>
              <CardDescription>
                {t('profile.general.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.full_name')}</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone')}</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">{t('common.company')}</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t('common.role')}</Label>
                <Input
                  id="role"
                  value={profile.role}
                  disabled
                />
              </div>

              <Button>{t('common.save_changes')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.security.title')}</CardTitle>
              <CardDescription>
                {t('profile.security.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">{t('profile.security.current')}</Label>
                <Input id="current" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new">{t('profile.security.new')}</Label>
                <Input id="new" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t('profile.security.confirm')}</Label>
                <Input id="confirm" type="password" />
              </div>

              <Button>{t('profile.security.change')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.notifications.title')}</CardTitle>
              <CardDescription>
                {t('profile.notifications.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('profile.notifications.placeholder')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
