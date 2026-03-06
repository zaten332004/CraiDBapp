'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, Unplug, PlugZap } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';

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

export default function PowerBIConfigPage() {
  const { t } = useI18n();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [config, setConfig] = useState({
    workspaceId: '',
    clientId: '',
    clientSecret: '',
    tenantId: '',
  });
  const [workspaces, setWorkspaces] = useState<PowerBIWorkspace[]>([]);
  const [datasets, setDatasets] = useState<PowerBIDataset[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [refreshResult, setRefreshResult] = useState<any>(null);
  const [dataChecks, setDataChecks] = useState<any>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
  );

  const formatApiError = (err: unknown) => {
    if (err instanceof ApiError) {
      return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
    }
    return err instanceof Error ? err.message : String(err);
  };

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

  const checkConnection = async () => {
    try {
      setError(null);
      const res = await browserApiFetchAuth<any>('/powerbi/test-connection', { method: 'GET' });
      setIsConnected(Boolean(res?.connected ?? true));
      setLastCheckedAt(new Date());
    } catch (err) {
      setIsConnected(false);
      setLastCheckedAt(new Date());
      setError(formatApiError(err));
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await browserApiFetchAuth<any>('/powerbi/configure', {
        method: 'POST',
        body: config,
      });
      setIsConnected(Boolean(res?.connected ?? true));
      setLastCheckedAt(new Date());
      if (config.workspaceId) setSelectedWorkspaceId(config.workspaceId);
    } catch (err) {
      setIsConnected(false);
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await checkConnection();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await browserApiFetchAuth('/powerbi/disconnect', { method: 'DELETE' });
      setIsConnected(false);
      setLastCheckedAt(new Date());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshDataset = async () => {
    if (!selectedDatasetId) return;
    setIsLoading(true);
    setError(null);
    setRefreshResult(null);
    try {
      const res = await browserApiFetchAuth<any>('/powerbi/refresh-dataset', {
        method: 'POST',
        body: { dataset_id: selectedDatasetId, datasetId: selectedDatasetId },
      });
      setRefreshResult(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const runDataCheck = async (kind: 'risk-data' | 'portfolio-metrics' | 'customer-risk-profile') => {
    setIsLoading(true);
    setError(null);
    setDataChecks(null);

    try {
      if (kind === 'risk-data') {
        const res = await browserApiFetchAuth<any>('/powerbi/risk-data', { method: 'GET' });
        setDataChecks({ kind, res });
        return;
      }
      if (kind === 'portfolio-metrics') {
        const res = await browserApiFetchAuth<any>('/powerbi/portfolio-metrics', { method: 'GET' });
        setDataChecks({ kind, res });
        return;
      }
      const id = customerId.trim();
      if (!id) {
        setError(t('powerbi.customer_id_required'));
        return;
      }
      const res = await browserApiFetchAuth<any>(`/powerbi/customer/${encodeURIComponent(id)}/risk-profile`, { method: 'GET' });
      setDataChecks({ kind, customerId: id, res });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.allSettled([checkConnection(), loadWorkspaces(), loadDatasets()]);
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

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      {isConnected && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">
            {t('powerbi.connected')}
          </AlertDescription>
        </Alert>
      )}

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
                <Label htmlFor="clientId">{t('powerbi.client_id')}</Label>
                <Input
                  id="clientId"
                  placeholder={t('powerbi.client_id_ph')}
                  value={config.clientId}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  disabled={isConnected === true}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">{t('powerbi.client_secret')}</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder={t('powerbi.client_secret_ph')}
                  value={config.clientSecret}
                  onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
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
                  <Select value={selectedWorkspaceId} onValueChange={(v) => setSelectedWorkspaceId(v)}>
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
                        setError(null);
                        try {
                          await loadWorkspaces();
                        } catch (err) {
                          setError(formatApiError(err));
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
                  <Select value={selectedDatasetId} onValueChange={(v) => setSelectedDatasetId(v)}>
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
                        setError(null);
                        try {
                          await loadDatasets();
                        } catch (err) {
                          setError(formatApiError(err));
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

          <Card>
            <CardHeader>
              <CardTitle>{t('powerbi.data_checks_title')}</CardTitle>
              <CardDescription>{t('powerbi.data_checks_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void runDataCheck('risk-data')} disabled={isLoading}>
                  {t('powerbi.fetch_risk_data')}
                </Button>
                <Button variant="outline" onClick={() => void runDataCheck('portfolio-metrics')} disabled={isLoading}>
                  {t('powerbi.fetch_portfolio_metrics')}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <Label htmlFor="powerbi-customer-id">{t('powerbi.customer_id')}</Label>
                  <Input
                    id="powerbi-customer-id"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder={t('powerbi.customer_id_ph')}
                    className="mt-2"
                  />
                </div>
                <Button onClick={() => void runDataCheck('customer-risk-profile')} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('powerbi.fetch_customer_risk_profile')}
                </Button>
              </div>

              {dataChecks && (
                <div className="rounded-md border bg-secondary p-3">
                  <p className="text-sm font-medium">{t('common.result')}</p>
                  <pre className="mt-2 max-h-72 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(dataChecks, null, 2)}
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
                  <p className="font-medium mt-2">{lastCheckedAt.toLocaleString()}</p>
                </div>
              )}

              {isConnected && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('powerbi.workspace')}</p>
                    <p className="font-medium mt-2">{config.workspaceId || t('common.na')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('powerbi.last_synced')}</p>
                    <p className="font-medium mt-2">{t('powerbi.last_synced_value')}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('common.quick_links')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setSelectedWorkspaceId(config.workspaceId)}
              >
                {t('powerbi.workspace')}: {config.workspaceId ? config.workspaceId.slice(0, 12) + '…' : t('common.na')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  setIsLoading(true);
                  setError(null);
                  try {
                    await Promise.all([loadWorkspaces(), loadDatasets()]);
                  } catch (err) {
                    setError(formatApiError(err));
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('common.refresh')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
