'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Unplug, PlugZap } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';

type PowerBIWorkspace = { id: string; name: string; raw: unknown };
type PowerBIDataset = { id: string; name: string; raw: unknown };

function toWorkspace(item: any): PowerBIWorkspace | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? item.groupId ?? item.workspaceId ?? '').trim();
  if (!id) return null;
  const name = String(item.name ?? item.displayName ?? item.workspaceName ?? id).trim();
  return { id, name, raw: item };
}

function toDataset(item: any): PowerBIDataset | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? item.datasetId ?? '').trim();
  if (!id) return null;
  const name = String(item.name ?? item.displayName ?? item.datasetName ?? id).trim();
  return { id, name, raw: item };
}

type PowerBiStatus = {
  connected?: boolean;
  tenant_id?: string | null;
  workspace_id?: string | null;
  workspace_name?: string | null;
  dataset_id?: string | null;
  dataset_name?: string | null;
  last_sync?: string | null;
};

/** Lỗi probe global từ server (thiếu .env) — không hiển thị toast/banner cho người dùng cuối. */
function isGlobalPowerBiEnvMissingMessage(text: string): boolean {
  return /missing\s+power_bi_/i.test(text);
}

export default function PowerBIConfigPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [accountStatus, setAccountStatus] = useState<{ connected: boolean; lastSync: string | null }>({
    connected: false,
    lastSync: null,
  });
  const [config, setConfig] = useState({
    workspaceId: '',
    datasetId: '',
    tenantId: '',
  });
  const [workspaces, setWorkspaces] = useState<PowerBIWorkspace[]>([]);
  const [datasets, setDatasets] = useState<PowerBIDataset[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [refreshResult, setRefreshResult] = useState<any>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
  );

  const loadWorkspaces = async () => {
    const data = await browserApiFetchAuth<any>('/powerbi/workspaces', { method: 'GET' });
    const rawList = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : Array.isArray(data?.items) ? data.items : [];
    const parsed = rawList.map(toWorkspace).filter(Boolean) as PowerBIWorkspace[];
    setWorkspaces(parsed);
  };

  const loadDatasets = async () => {
    const data = await browserApiFetchAuth<any>('/powerbi/datasets', { method: 'GET' });
    const rawList = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : Array.isArray(data?.items) ? data.items : [];
    const parsed = rawList.map(toDataset).filter(Boolean) as PowerBIDataset[];
    setDatasets(parsed);
  };

  /** Đồng bộ trạng thái tài khoản + điền lại ô cấu hình từ bản lưu server (trước khi ngắt kết nối). */
  const applySavedPowerBiFromStatus = (s: PowerBiStatus) => {
    const sync = typeof s?.last_sync === 'string' ? s.last_sync.trim() : '';
    setAccountStatus({
      connected: Boolean(s?.connected),
      lastSync: sync || null,
    });

    if (!s?.connected) {
      setConfig({ workspaceId: '', datasetId: '', tenantId: '' });
      setSelectedWorkspaceId('');
      setSelectedDatasetId('');
      return;
    }

    const wsId = String(s.workspace_id ?? '').trim();
    const dsId = String(s.dataset_id ?? '').trim();
    const tenant = String(s.tenant_id ?? '').trim();

    setConfig((prev) => ({
      ...prev,
      ...(tenant ? { tenantId: tenant } : {}),
      ...(wsId ? { workspaceId: wsId } : {}),
      ...(dsId ? { datasetId: dsId } : {}),
    }));
    if (wsId) setSelectedWorkspaceId(wsId);
    if (dsId) setSelectedDatasetId(dsId);

    const wsName = String(s.workspace_name ?? '').trim();
    if (wsId) {
      setWorkspaces((prev) => {
        if (prev.some((w) => w.id === wsId)) return prev;
        return [{ id: wsId, name: wsName || wsId, raw: {} }, ...prev];
      });
    }
    const dsName = String(s.dataset_name ?? '').trim();
    if (dsId) {
      setDatasets((prev) => {
        if (prev.some((d) => d.id === dsId)) return prev;
        return [{ id: dsId, name: dsName || dsId, raw: {} }, ...prev];
      });
    }
  };

  const loadAccountPowerBiStatus = async () => {
    try {
      const s = await browserApiFetchAuth<PowerBiStatus>('/powerbi/status', { method: 'GET' });
      applySavedPowerBiFromStatus(s);
    } catch {
      setAccountStatus({ connected: false, lastSync: null });
      setConfig({ workspaceId: '', datasetId: '', tenantId: '' });
      setSelectedWorkspaceId('');
      setSelectedDatasetId('');
    }
  };

  /** Kiểm tra kết nối Power BI (global .env phía server). Lỗi chỉ qua toast khi gọi từ nút Kiểm tra kết nối. */
  const runConnectionTest = async (): Promise<{
    ok: boolean;
    detail?: string;
    suppressUserNotification?: boolean;
  }> => {
    try {
      const res = await browserApiFetchAuth<any>('/powerbi/test-connection', { method: 'GET' });
      const connected = Boolean(res?.connected);
      setIsConnected(connected);
      setLastCheckedAt(new Date());
      const msg = typeof res?.message === 'string' ? res.message.trim() : '';
      if (!connected) {
        const text = msg || t('powerbi.toast.test_fail_fallback');
        const suppress = isGlobalPowerBiEnvMissingMessage(text);
        return { ok: false, detail: suppress ? undefined : text, suppressUserNotification: suppress };
      }
      return { ok: true, detail: msg || undefined };
    } catch (err) {
      const text = formatUserFacingApiError(err, msgLocale);
      setIsConnected(false);
      setLastCheckedAt(new Date());
      const suppress = isGlobalPowerBiEnvMissingMessage(text);
      return { ok: false, detail: suppress ? undefined : text, suppressUserNotification: suppress };
    }
  };

  const handleConnect = async () => {
    const workspace_id = config.workspaceId.trim() || selectedWorkspaceId.trim();
    const dataset_id = selectedDatasetId.trim() || config.datasetId.trim();
    const tenant_id = config.tenantId.trim();

    if (!workspace_id) {
      const msg = t('powerbi.workspace_id_required');
      notifyError(t('powerbi.toast.connect_fail_title'), { description: msg, duration: 5000 });
      return;
    }
    if (!dataset_id) {
      const msg = t('powerbi.dataset_id_required');
      notifyError(t('powerbi.toast.connect_fail_title'), { description: msg, duration: 5000 });
      return;
    }
    if (!tenant_id) {
      const msg = t('powerbi.tenant_id_required');
      notifyError(t('powerbi.toast.connect_fail_title'), { description: msg, duration: 5000 });
      return;
    }

    setIsLoading(true);
    try {
      const workspace_name =
        workspaces.find((w) => w.id === workspace_id)?.name?.trim() || '';
      const dataset_name =
        datasets.find((d) => d.id === dataset_id)?.name?.trim() || '';
      const res = await browserApiFetchAuth<any>('/powerbi/configure', {
        method: 'POST',
        body: {
          workspace_id,
          dataset_id,
          tenant_id,
          ...(workspace_name ? { workspace_name } : {}),
          ...(dataset_name ? { dataset_name } : {}),
        },
      });
      setIsConnected(Boolean(res?.success ?? res?.connected ?? true));
      setLastCheckedAt(new Date());
      if (workspace_id) setSelectedWorkspaceId(workspace_id);
      if (dataset_id) setSelectedDatasetId(dataset_id);
      setConfig((prev) => ({
        ...prev,
        tenantId: tenant_id,
        workspaceId: workspace_id,
        datasetId: dataset_id,
      }));
      const apiMsg = typeof res?.message === 'string' ? res.message.trim() : '';
      const lines = [
        `${t('powerbi.workspace_id')}: ${workspace_id}`,
        `${t('powerbi.dataset_id')}: ${dataset_id}`,
        `${t('powerbi.tenant_id')}: ${tenant_id}`,
        ...(apiMsg ? [apiMsg] : []),
      ];
      notifySuccess(t('powerbi.toast.connect_ok_title'), {
        description: lines.join('\n'),
        duration: 5200,
      });
      await loadAccountPowerBiStatus();
    } catch (err) {
      setIsConnected(false);
      const detail = formatUserFacingApiError(err, msgLocale);
      notifyError(t('powerbi.toast.connect_fail_title'), { description: detail, duration: 6500 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const result = await runConnectionTest();

      let accountLine = t('powerbi.toast.test_account_status_unknown');
      let accountConnected: boolean | null = null;
      try {
        const st = await browserApiFetchAuth<{ connected?: boolean }>('/powerbi/status', { method: 'GET' });
        accountConnected = Boolean(st?.connected);
        accountLine = accountConnected
          ? t('powerbi.toast.test_account_configured')
          : t('powerbi.toast.test_account_not_configured');
      } catch {
        accountConnected = null;
        accountLine = t('powerbi.toast.test_account_status_unknown');
      }

      if (result.ok) {
        const parts = [
          t('powerbi.toast.test_stable_summary'),
          result.detail ? `${t('powerbi.toast.test_server_detail')}: ${result.detail}` : '',
          accountLine,
        ].filter((x) => String(x).trim().length > 0);
        notifySuccess(t('powerbi.toast.test_stable_title'), {
          description: parts.join('\n'),
          duration: 6200,
        });
      } else if (result.suppressUserNotification) {
        const desc =
          accountConnected === true
            ? t('powerbi.toast.test_not_assessed_desc_with_account')
            : [t('powerbi.toast.test_not_assessed_desc'), accountLine].join('\n\n');
        notifyInfo(t('powerbi.toast.test_not_assessed_title'), {
          description: desc,
          duration: accountConnected === true ? 7200 : 6000,
        });
      } else {
        const parts = [
          t('powerbi.toast.test_unstable_summary'),
          result.detail ? `${t('powerbi.toast.test_server_detail')}: ${result.detail}` : t('powerbi.toast.test_fail_fallback'),
          accountLine,
        ];
        notifyError(t('powerbi.toast.test_unstable_title'), {
          description: parts.join('\n'),
          duration: 7800,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const res = await browserApiFetchAuth<{ success?: boolean; message?: string }>('/powerbi/disconnect', {
        method: 'DELETE',
      });
      setIsConnected(false);
      setLastCheckedAt(new Date());
      const serverMsg = typeof res?.message === 'string' ? res.message.trim() : '';
      notifySuccess(t('powerbi.toast.disconnect_ok_title'), {
        description: serverMsg || t('powerbi.toast.disconnect_ok_desc'),
        duration: 5200,
      });
      await loadAccountPowerBiStatus();
    } catch (err) {
      const detail = formatUserFacingApiError(err, msgLocale);
      notifyError(t('powerbi.toast.disconnect_fail_title'), { description: detail, duration: 6500 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshDataset = async () => {
    if (!selectedDatasetId) return;
    setIsLoading(true);
    setRefreshResult(null);
    try {
      const res = await browserApiFetchAuth<any>('/powerbi/refresh-dataset', {
        method: 'POST',
        body: { dataset_id: selectedDatasetId, datasetId: selectedDatasetId },
      });
      setRefreshResult(res);
      await loadAccountPowerBiStatus();
    } catch (err) {
      notifyError(t('powerbi.refresh_dataset'), { description: formatUserFacingApiError(err, msgLocale), duration: 6500 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // Tải danh sách trước, rồi mới hydrate từ /status — tránh setWorkspaces/setDatasets ghi đè workspace/dataset đã lưu.
        await Promise.allSettled([loadWorkspaces(), loadDatasets()]);
        await loadAccountPowerBiStatus();
        await runConnectionTest();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('powerbi.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('powerbi.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('powerbi.config_title')}</CardTitle>
              <CardDescription>
                {t('powerbi.config_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenantId">{t('powerbi.tenant_id')}</Label>
                <Input
                  id="tenantId"
                  placeholder={t('powerbi.tenant_id_ph')}
                  value={config.tenantId}
                  onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
                  disabled={isConnected === true}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspaceId">{t('powerbi.workspace_id')}</Label>
                <Input
                  id="workspaceId"
                  placeholder={t('powerbi.workspace_id_ph')}
                  value={config.workspaceId}
                  onChange={(e) => setConfig({ ...config, workspaceId: e.target.value })}
                  disabled={isConnected === true}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="datasetId">{t('powerbi.dataset_id')}</Label>
                <Input
                  id="datasetId"
                  placeholder={t('powerbi.dataset_id_ph')}
                  value={config.datasetId}
                  onChange={(e) => setConfig({ ...config, datasetId: e.target.value })}
                  disabled={isConnected === true}
                />
                <p className="text-xs text-muted-foreground">{t('powerbi.dataset_id_hint')}</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleConnect} disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.connecting')}
                    </>
                  ) : (
                    <>
                      <PlugZap className="mr-2 h-4 w-4" />
                      {t('powerbi.connect')}
                    </>
                  )}
                </Button>
                <Button onClick={handleTestConnection} disabled={isLoading} variant="outline" className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.testing')}
                    </>
                  ) : (
                    t('powerbi.test_connection')
                  )}
                </Button>
                <Button onClick={handleDisconnect} disabled={isLoading} variant="outline" className="flex-1">
                  <Unplug className="mr-2 h-4 w-4" />
                  {t('common.disconnect')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('powerbi.view_workspaces')}</CardTitle>
              <CardDescription>
                {t('powerbi.view_datasets')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('powerbi.workspace')}</Label>
                  <Select
                    value={selectedWorkspaceId}
                    onValueChange={(v) => {
                      setSelectedWorkspaceId(v);
                      setConfig((prev) => ({ ...prev, workspaceId: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('powerbi.workspace_id_ph')} />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await loadWorkspaces();
                        } catch (err) {
                          notifyError(t('powerbi.view_workspaces'), { description: formatUserFacingApiError(err, msgLocale), duration: 6500 });
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('common.refresh')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConfig((prev) => ({ ...prev, workspaceId: selectedWorkspaceId }));
                      }}
                      disabled={!selectedWorkspaceId}
                    >
                      {t('common.use')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('powerbi.view_datasets')}</Label>
                  <Select
                    value={selectedDatasetId}
                    onValueChange={(v) => {
                      setSelectedDatasetId(v);
                      setConfig((prev) => ({ ...prev, datasetId: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await loadDatasets();
                        } catch (err) {
                          notifyError(t('powerbi.view_datasets'), { description: formatUserFacingApiError(err, msgLocale), duration: 6500 });
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('common.refresh')}
                    </Button>
                    <Button onClick={handleRefreshDataset} disabled={isLoading || !selectedDatasetId}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('powerbi.refresh_dataset')}
                    </Button>
                  </div>
                </div>
              </div>

              {(workspaces.length > 0 || datasets.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>{t('common.name')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workspaces.slice(0, 10).map((w) => (
                          <TableRow
                            key={w.id}
                            className={w.id === selectedWorkspaceId ? 'bg-secondary/60' : undefined}
                          >
                            <TableCell className="font-mono text-xs">{w.id}</TableCell>
                            <TableCell>{w.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>{t('common.name')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datasets.slice(0, 10).map((d) => (
                          <TableRow key={d.id} className={d.id === selectedDatasetId ? 'bg-secondary/60' : undefined}>
                            <TableCell className="font-mono text-xs">{d.id}</TableCell>
                            <TableCell>{d.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {refreshResult && (
                <div className="rounded-md border bg-secondary p-3">
                  <p className="text-sm font-medium">{t('powerbi.refresh_result')}</p>
                  <pre className="mt-2 max-h-64 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(refreshResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('powerbi.status_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                <Badge className="mt-2" variant={isConnected ? 'secondary' : 'outline'}>
                  {isConnected ? t('common.connected') : t('common.not_connected')}
                </Badge>
              </div>

              {lastCheckedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.last_checked')}</p>
                  <p className="font-medium mt-2">{formatDateTimeVietnam(lastCheckedAt, locale)}</p>
                </div>
              )}

              {accountStatus.connected && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('powerbi.workspace')}</p>
                    <p className="font-medium mt-2">{config.workspaceId || t('common.na')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('powerbi.last_synced')}</p>
                    <p className="font-medium mt-2">
                      {accountStatus.lastSync
                        ? formatDateTimeVietnam(accountStatus.lastSync, locale)
                        : t('common.na')}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
