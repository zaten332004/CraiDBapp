'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, Loader2, ListChecks, RefreshCw, Trash2, Unplug, PlugZap } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import { ApiError } from '@/lib/api/shared';
import { POWER_BI_REFERENCE_EXTENDED_TABLES } from '@/lib/powerbi/reference-tables';
import {
  getDefaultPowerBiTableSuggestions,
  loadPowerBiTableSuggestions,
  savePowerBiTableSuggestions,
} from '@/lib/powerbi/table-suggestions-storage';
import { isPowerBiTableNotInDatasetError } from '@/lib/powerbi/schema-table-error';

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
  table_names?: string[] | null;
  last_sync?: string | null;
};

type PowerBiSchemaResponse = {
  ok?: boolean;
  tables?: string[];
  table_list_source?: string;
  schema_row_sample_max?: number;
  schemas?: Array<{
    name: string;
    columns: string[];
    sample_rows?: unknown[];
    row_count?: number | null;
    column_count?: number | null;
  }>;
  errors?: Record<string, string>;
  message?: string;
  requires_table_hints?: boolean;
};

type PowerBiReadinessResponse = {
  ready_for_ai_context?: boolean;
  discovered_table_count?: number;
  hint_table_count?: number;
  warnings?: string[];
};

const TABLE_DATA_PREVIEW_ROW_LIMIT = 100;

/** Lỗi probe global từ server (thiếu .env) — không hiển thị toast/banner cho người dùng cuối. */
function isGlobalPowerBiEnvMissingMessage(text: string): boolean {
  return /missing\s+power_bi_/i.test(text);
}

function isUnauthorizedError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export default function PowerBIConfigPage() {
  const router = useRouter();
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
  const [tableSuggestions, setTableSuggestions] = useState<string[]>(() => getDefaultPowerBiTableSuggestions());
  const [newTableName, setNewTableName] = useState('');
  const [powerBiSchemaPreview, setPowerBiSchemaPreview] = useState<PowerBiSchemaResponse | null>(null);
  const [powerBiSchemaLoading, setPowerBiSchemaLoading] = useState(false);
  const [tableHintsReadiness, setTableHintsReadiness] = useState<PowerBiReadinessResponse | null>(null);
  const [selectedSchemaName, setSelectedSchemaName] = useState<string | null>(null);

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

  const refreshWorkspaceAndDatasetLists = async () => {
    await Promise.allSettled([loadWorkspaces(), loadDatasets()]);
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
    } catch (err) {
      // Keep current connection snapshot for transient/backend errors.
      // Only clear when the session is unauthorized (logout / expired auth).
      if (!isUnauthorizedError(err)) return;
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
      if (isUnauthorizedError(err)) setIsConnected(false);
      setLastCheckedAt(new Date());
      const suppress = isGlobalPowerBiEnvMissingMessage(text);
      return { ok: false, detail: suppress ? undefined : text, suppressUserNotification: suppress };
    }
  };

  /** Đẩy danh sách gợi ý (localStorage) lên máy chủ để /schema và DAX dùng đúng tên bảng — tránh lệch với mặc định .env (CustomerMaster, …). */
  const pushBrowserTableHintsToServer = async () => {
    const cleaned = [...new Set(tableSuggestions.map((s) => String(s).trim()).filter(Boolean))];
    if (!cleaned.length) return;
    await browserApiFetchAuth<{ success?: boolean; table_names?: string[] }>('/powerbi/table-hints', {
      method: 'POST',
      body: { table_names: cleaned },
    });
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
      const workspace_name_prefetch =
        workspaces.find((w) => w.id === workspace_id)?.name?.trim() || '';
      const dataset_name_prefetch =
        datasets.find((d) => d.id === dataset_id)?.name?.trim() || '';
      const res = await browserApiFetchAuth<any>('/powerbi/configure', {
        method: 'POST',
        body: {
          workspace_id,
          dataset_id,
          tenant_id,
          ...(workspace_name_prefetch ? { workspace_name: workspace_name_prefetch } : {}),
          ...(dataset_name_prefetch ? { dataset_name: dataset_name_prefetch } : {}),
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
      const wsFromApi = typeof res?.workspace_name === 'string' ? res.workspace_name.trim() : '';
      const dsFromApi = typeof res?.dataset_name === 'string' ? res.dataset_name.trim() : '';
      const workspaceDisplay =
        workspace_name_prefetch || wsFromApi || workspace_id;
      const datasetDisplay = dataset_name_prefetch || dsFromApi || dataset_id;
      const lines = [
        `${t('powerbi.workspace')}: ${workspaceDisplay}`,
        `${t('powerbi.dataset')}: ${datasetDisplay}`,
        `${t('powerbi.tenant_id')}: ${tenant_id}`,
        ...(apiMsg ? [apiMsg] : []),
      ];
      notifySuccess(t('powerbi.toast.connect_ok_title'), {
        description: lines.join('\n'),
        duration: 5200,
      });
      try {
        await pushBrowserTableHintsToServer();
      } catch {
        /* gợi ý bảng không bắt buộc để kết nối thành công */
      }
      await loadAccountPowerBiStatus();
      await refreshWorkspaceAndDatasetLists();
    } catch (err) {
      if (isUnauthorizedError(err)) setIsConnected(false);
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
      let statusPayload: PowerBiStatus | null = null;
      try {
        statusPayload = await browserApiFetchAuth<PowerBiStatus>('/powerbi/status', { method: 'GET' });
        accountConnected = Boolean(statusPayload?.connected);
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
        let tables: string[] = [];
        let sourceKey: 'api' | 'hints_saved' | 'account' | 'local' | null = null;

        if (accountConnected === true) {
          try {
            await pushBrowserTableHintsToServer();
          } catch {
            /* bỏ qua — vẫn thử đọc schema / fallback */
          }
        }

        try {
          const schema = await browserApiFetchAuth<PowerBiSchemaResponse>(
            `/powerbi/schema?limit=${TABLE_DATA_PREVIEW_ROW_LIMIT}`,
            { method: 'GET' },
          );
          if (Array.isArray(schema?.tables) && schema.tables.length > 0) {
            tables = schema.tables.map((x) => String(x).trim()).filter(Boolean);
            sourceKey =
              schema.table_list_source === 'saved_hints' ? 'hints_saved' : 'api';
          }
        } catch {
          /* 400 nếu chưa lưu workspace/dataset — bỏ qua */
        }

        if (!tables.length && Array.isArray(statusPayload?.table_names)) {
          const fromAccount = statusPayload.table_names.map((x) => String(x).trim()).filter(Boolean);
          if (fromAccount.length) {
            tables = fromAccount;
            sourceKey = 'account';
          }
        }

        if (!tables.length && tableSuggestions.length > 0) {
          tables = [...tableSuggestions];
          sourceKey = 'local';
        }

        if (tables.length > 0) {
          const sourceLine = sourceKey ? t(`powerbi.toast.test_tables_source_${sourceKey}`) : '';
          const body = [
            sourceLine,
            `${tables.length} ${t('powerbi.use_table_data_ok_suffix')}`,
          ]
            .filter((x) => String(x).trim().length > 0)
            .join('\n');
          notifySuccess(t('powerbi.toast.test_tables_title'), {
            description: body,
            duration: 6200,
          });
        } else {
          notifyInfo(t('powerbi.toast.test_tables_empty_title'), {
            description: [t('powerbi.toast.test_tables_empty_desc'), accountLine].filter(Boolean).join('\n\n'),
            duration: 5600,
          });
        }
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
      const isSuccess = Boolean(res?.success);
      const msg = typeof res?.message === 'string' ? res.message.trim() : '';
      const sync = typeof res?.last_sync === 'string' ? res.last_sync.trim() : '';
      if (isSuccess) {
        const lines = [msg || t('powerbi.refresh_result')];
        if (sync) {
          lines.push(`${t('powerbi.last_synced')}: ${formatDateTimeVietnam(sync, locale)}`);
        }
        notifySuccess(t('powerbi.refresh_dataset'), {
          description: lines.join('\n'),
          duration: 5200,
        });
      } else {
        notifyError(t('powerbi.refresh_dataset'), {
          description: msg || t('powerbi.toast.test_fail_fallback'),
          duration: 6500,
        });
      }
      await loadAccountPowerBiStatus();
    } catch (err) {
      notifyError(t('powerbi.refresh_dataset'), { description: formatUserFacingApiError(err, msgLocale), duration: 6500 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTableSuggestions(loadPowerBiTableSuggestions());
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // Tải danh sách trước, rồi mới hydrate từ /status — tránh setWorkspaces/setDatasets ghi đè workspace/dataset đã lưu.
        await refreshWorkspaceAndDatasetLists();
        await loadAccountPowerBiStatus();
        await runConnectionTest();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTableSuggestions = (next: string[]) => {
    const cleaned = [...new Set(next.map((s) => s.trim()).filter(Boolean))];
    setTableSuggestions(cleaned);
    savePowerBiTableSuggestions(cleaned);
  };

  const handleAddTableSuggestion = () => {
    const name = newTableName.trim();
    if (!name) return;
    if (tableSuggestions.includes(name)) {
      setNewTableName('');
      return;
    }
    updateTableSuggestions([...tableSuggestions, name]);
    setNewTableName('');
  };

  const handleRemoveTableSuggestion = (name: string) => {
    updateTableSuggestions(tableSuggestions.filter((x) => x !== name));
  };

  const handleResetTableSuggestions = () => {
    const defaults = getDefaultPowerBiTableSuggestions();
    setTableSuggestions(defaults);
    savePowerBiTableSuggestions(defaults);
    setTableHintsReadiness(null);
  };

  const handleAppendExtendedSuggestion = (name: string) => {
    if (tableSuggestions.includes(name)) return;
    updateTableSuggestions([...tableSuggestions, name]);
  };

  const handleUseTableData = async () => {
    if (!accountStatus.connected) {
      notifyInfo(t('powerbi.use_table_data_need_account'), { duration: 5200 });
      return;
    }
    setPowerBiSchemaLoading(true);
    setPowerBiSchemaPreview(null);
    try {
      try {
        await pushBrowserTableHintsToServer();
      } catch (hintErr) {
        notifyError(t('powerbi.table_hints_sync_fail_title'), {
          description: formatUserFacingApiError(hintErr, msgLocale),
          duration: 6500,
        });
        return;
      }
      const data = await browserApiFetchAuth<PowerBiSchemaResponse>(
        `/powerbi/schema?limit=${TABLE_DATA_PREVIEW_ROW_LIMIT}`,
        { method: 'GET' },
      );
      if (data.ok === false && data.requires_table_hints) {
        notifyError(t('powerbi.use_table_data_fail_title'), {
          description:
            (typeof data.message === 'string' && data.message.trim()) || t('powerbi.use_table_data_hints_required'),
          duration: 7000,
        });
        return;
      }
      const tableCount = Array.isArray(data.tables) ? data.tables.length : 0;
      const schemaList = Array.isArray(data.schemas) ? data.schemas : [];
      if (!tableCount && !schemaList.length) {
        notifyError(t('powerbi.use_table_data_fail_title'), {
          description:
            (typeof data.message === 'string' && data.message.trim()) || t('powerbi.use_table_data_hints_required'),
          duration: 7000,
        });
        return;
      }
      setPowerBiSchemaPreview(data);
      const displayCount = tableCount || schemaList.length;
      notifySuccess(t('powerbi.use_table_data_ok_title'), {
        description: `${displayCount} ${t('powerbi.use_table_data_ok_suffix')}`,
        duration: 4800,
      });
    } catch (err) {
      notifyError(t('powerbi.use_table_data_fail_title'), {
        description: formatUserFacingApiError(err, msgLocale),
        duration: 7000,
      });
    } finally {
      setPowerBiSchemaLoading(false);
    }
  };

  const tableDataPreviewSection =
    powerBiSchemaPreview &&
    (() => {
      const p = powerBiSchemaPreview;
      const schemas = Array.isArray(p.schemas) ? p.schemas : [];
      const tablesOnly = Array.isArray(p.tables) ? p.tables : [];
      if (!schemas.length && !tablesOnly.length) return null;
      return (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{t('powerbi.table_data_preview_title')}</span>
          </div>
          {schemas.length > 0 ? (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {schemas.map((sch) => {
                const err = p.errors?.[sch.name];
                const cols = Array.isArray(sch.columns) ? sch.columns : [];
                const rawSampleRows = Array.isArray(sch.sample_rows) ? sch.sample_rows : [];
                // "Tổng dòng" ở khu vực preview chỉ phản ánh phần đã nạp (bị chặn bởi limit).
                const rowTotal = Math.min(rawSampleRows.length, TABLE_DATA_PREVIEW_ROW_LIMIT);
                const colNum =
                  typeof sch.column_count === 'number' && sch.column_count >= 0
                    ? sch.column_count
                    : cols.length;
                const namesJoined = cols.join(', ');
                const namesPreview =
                  namesJoined.length > 200 ? `${namesJoined.slice(0, 200).trimEnd()}…` : namesJoined;
                return (
                  <button
                    key={sch.name}
                    type="button"
                    className="w-full rounded-md border border-border bg-background/80 p-2.5 text-left text-sm transition-colors hover:bg-muted/30"
                    onClick={() => setSelectedSchemaName(sch.name)}
                  >
                    <p className="font-mono font-semibold text-foreground">{sch.name}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t('powerbi.table_data_column_count_label')}:</span>{' '}
                      {colNum > 0 ? colNum : '—'}
                    </p>
                    {namesPreview ? (
                      <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground/90">{namesPreview}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t('powerbi.table_data_total_rows')}:</span>{' '}
                      {rowTotal.toLocaleString()}
                    </p>
                    {err ? (
                      <p className="mt-1 text-xs text-destructive">
                        {isPowerBiTableNotInDatasetError(err)
                          ? t('powerbi.table_data_table_not_in_dataset').replace(/\{name\}/g, sch.name)
                          : `${t('powerbi.table_data_error_prefix')}: ${
                              err.length > 240 ? `${err.slice(0, 240)}…` : err
                            }`}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {locale === 'vi' ? 'Nhấn để xem bảng chi tiết' : 'Click to open detailed table'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <ul className="max-h-48 list-inside list-disc overflow-y-auto font-mono text-sm text-muted-foreground">
              {tablesOnly.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      );
    })();

  const selectedSchemaDetail = useMemo(() => {
    const schemas = Array.isArray(powerBiSchemaPreview?.schemas) ? powerBiSchemaPreview.schemas : [];
    const picked = schemas.find((sch) => sch.name === selectedSchemaName);
    if (!picked) return null;
    const columns = Array.isArray(picked.columns) ? picked.columns.map((c) => String(c)) : [];
    const rows = (Array.isArray(picked.sample_rows) ? picked.sample_rows : [])
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item }))
      .slice(0, TABLE_DATA_PREVIEW_ROW_LIMIT);
    return { name: picked.name, columns, rows };
  }, [powerBiSchemaPreview, selectedSchemaName]);

  /** Đồng bộ danh sách gợi ý lên server + kiểm tra token/DAX/bảng — để biết AI có đọc được dữ liệu không. */
  const handleVerifyTableHintsForAi = async () => {
    setIsLoading(true);
    setTableHintsReadiness(null);
    try {
      await browserApiFetchAuth('/powerbi/table-hints', {
        method: 'POST',
        body: { table_names: tableSuggestions },
      });
    } catch (err) {
      const detail = formatUserFacingApiError(err, msgLocale);
      notifyError(t('powerbi.verify_error_title'), { description: detail, duration: 7000 });
      setIsLoading(false);
      return;
    }
    try {
      const r = await browserApiFetchAuth<PowerBiReadinessResponse>('/ai-chat/powerbi-readiness', { method: 'GET' });
      setTableHintsReadiness(r);
      const apiN = Number(r.discovered_table_count ?? 0);
      const hintN = Number(r.hint_table_count ?? 0);
      const lines = [
        `${t('powerbi.verify_line_api_tables')}: ${apiN}`,
        `${t('powerbi.verify_line_server_hints')}: ${hintN}`,
      ];
      if (r.ready_for_ai_context) {
        notifySuccess(t('powerbi.verify_ready_title'), { description: lines.join('\n'), duration: 6500 });
      } else {
        const w = Array.isArray(r.warnings) && r.warnings.length ? r.warnings.join('\n') : t('powerbi.verify_not_ready_fallback');
        notifyInfo(t('powerbi.verify_not_ready_title'), { description: [lines.join('\n'), w].filter(Boolean).join('\n\n'), duration: 11000 });
      }
    } catch (err) {
      setTableHintsReadiness(null);
      notifyError(t('powerbi.verify_error_title'), { description: formatUserFacingApiError(err, msgLocale), duration: 7000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('powerbi.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('powerbi.desc')}
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">{t('powerbi.config_title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
              <div
                className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
                aria-label={t('powerbi.status_title')}
              >
                <p className="text-sm font-semibold text-foreground">{t('powerbi.status_title')}</p>
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{t('powerbi.status_server_label')}:</span>
                    <Badge variant={isConnected ? 'secondary' : 'outline'}>
                      {isConnected ? t('common.connected') : t('common.not_connected')}
                    </Badge>
                  </div>
                  {lastCheckedAt ? (
                    <p className="text-muted-foreground">
                      {t('common.last_checked')}:{' '}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatDateTimeVietnam(lastCheckedAt, locale)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('powerbi.status_account_label')}:</span>
                  <Badge variant={accountStatus.connected ? 'secondary' : 'outline'}>
                    {accountStatus.connected ? t('powerbi.account_configured') : t('powerbi.account_not_configured')}
                  </Badge>
                </div>
                {accountStatus.connected && accountStatus.lastSync ? (
                  <p className="text-xs text-muted-foreground">
                    {t('powerbi.last_synced')}:{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatDateTimeVietnam(accountStatus.lastSync, locale)}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantId" required>
                    {t('powerbi.tenant_id')}
                  </Label>
                  <Input
                    id="tenantId"
                    placeholder={t('powerbi.tenant_id_ph')}
                    value={config.tenantId}
                    onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspaceId" required>
                    {t('powerbi.workspace_id')}
                  </Label>
                  <Input
                    id="workspaceId"
                    placeholder={t('powerbi.workspace_id_ph')}
                    value={config.workspaceId}
                    onChange={(e) => setConfig({ ...config, workspaceId: e.target.value })}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="datasetId" required>
                    {t('powerbi.dataset_id')}
                  </Label>
                  <Input
                    id="datasetId"
                    placeholder={t('powerbi.dataset_id_ph')}
                    value={config.datasetId}
                    onChange={(e) => setConfig({ ...config, datasetId: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
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

              <div className="space-y-6 rounded-lg border border-border bg-muted/20 p-4">
                <div className="space-y-3">
                  <Label>{t('powerbi.workspace_select_label')}</Label>
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await loadWorkspaces();
                        } catch (err) {
                          notifyError(t('powerbi.view_workspaces'), {
                            description: formatUserFacingApiError(err, msgLocale),
                            duration: 6500,
                          });
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
                  {workspaces.length > 0 ? (
                    <ScrollableTableRegion className="max-h-56 rounded-md bg-background/60 shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className={scrollableTableHeaderRowClass}>
                            <TableHead>ID</TableHead>
                            <TableHead>{t('common.name')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workspaces.map((w) => (
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
                    </ScrollableTableRegion>
                  ) : null}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await loadDatasets();
                        } catch (err) {
                          notifyError(t('powerbi.view_datasets'), {
                            description: formatUserFacingApiError(err, msgLocale),
                            duration: 6500,
                          });
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
                  {datasets.length > 0 ? (
                    <ScrollableTableRegion className="max-h-56 rounded-md bg-background/60 shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className={scrollableTableHeaderRowClass}>
                            <TableHead>ID</TableHead>
                            <TableHead>{t('common.name')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {datasets.map((d) => (
                            <TableRow
                              key={d.id}
                              className={d.id === selectedDatasetId ? 'bg-secondary/60' : undefined}
                            >
                              <TableCell className="font-mono text-xs">{d.id}</TableCell>
                              <TableCell>{d.name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableRegion>
                  ) : null}
                </div>

                {refreshResult ? (
                  <div className="rounded-md border border-border bg-secondary p-3">
                    <p className="text-sm font-medium">{t('powerbi.refresh_result')}</p>
                    <pre className="mt-2 max-h-48 overflow-auto text-xs text-muted-foreground">
                      {JSON.stringify(refreshResult, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">{t('powerbi.hints_title')}</CardTitle>
              <CardDescription>{t('powerbi.hints_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <section className="rounded-lg border border-amber-200/90 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/25">
                <p className="font-medium text-foreground">{t('powerbi.hints_prereq_label')}</p>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{t('powerbi.hints_prereq_body')}</p>
                <p className="mt-2 text-[13px]">
                  <a
                    href="https://app.powerbi.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:opacity-90"
                  >
                    {t('powerbi.hints_prereq_powerbi_service_link')}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  </a>
                </p>
              </section>
              <section className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium text-foreground">{t('powerbi.hints_sp_label')}</p>
                <p className="mt-1 text-[13px] font-medium text-amber-900 dark:text-amber-100/90">
                  {t('powerbi.hints_sp_mandatory_note')}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
                  <li>
                    <span className="font-medium text-foreground">{t('powerbi.hints_sp_app_name')}</span> CreditRisk_Backend
                  </li>
                  <li>
                    <span className="font-medium text-foreground">{t('powerbi.hints_sp_client_id')}</span>{' '}
                    <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">53a7db35-5f93-4e5d-beba-34d0437ef94c</code>
                  </li>
                </ul>
                <p className="mt-2 text-[13px]">{t('powerbi.hints_sp_workspace_note')}</p>
              </section>
              <section>
                <p className="font-medium text-foreground">{t('powerbi.hints_tenant_label')}</p>
                <p className="mt-1.5">
                  {t('powerbi.hints_tenant_before')}
                  <a
                    href="https://entra.microsoft.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
                  >
                    {t('powerbi.hints_tenant_link')}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  </a>
                  {t('powerbi.hints_tenant_after')}
                </p>
              </section>
              <section>
                <p className="font-medium text-foreground">{t('powerbi.hints_workspace_label')}</p>
                <p className="mt-1.5">{t('powerbi.hints_workspace_body')}</p>
              </section>
              <section>
                <p className="font-medium text-foreground">{t('powerbi.hints_dataset_label')}</p>
                <p className="mt-1.5">{t('powerbi.hints_dataset_body')}</p>
              </section>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ListChecks className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
                  {t('powerbi.table_suggestions_title')}
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => void handleVerifyTableHintsForAi()}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                  {t('powerbi.table_suggestions_verify_button')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleResetTableSuggestions} className="shrink-0">
                  {t('powerbi.table_suggestions_reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {accountStatus.connected ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{t('powerbi.rules_intro')}</p>
            ) : null}
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <p className="font-medium text-foreground">{t('powerbi.rules_naming_title')}</p>
              <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
                <li>{t('powerbi.rules_naming_dim')}</li>
                <li>{t('powerbi.rules_naming_fact')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newTableSuggestion">{t('powerbi.table_suggestions_add_label')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="newTableSuggestion"
                  placeholder={t('powerbi.table_suggestions_placeholder')}
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTableSuggestion();
                    }
                  }}
                  className="font-mono sm:flex-1"
                />
                <Button type="button" variant="secondary" onClick={handleAddTableSuggestion} disabled={!newTableName.trim()}>
                  {t('powerbi.table_suggestions_add')}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">{t('powerbi.table_suggestions_list_label')}</p>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-background/80 p-2 font-mono text-sm">
                {tableSuggestions.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-muted/60"
                  >
                    <span className="min-w-0 truncate">{name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveTableSuggestion(name)}
                      aria-label={`${t('powerbi.table_suggestions_remove')}: ${name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('powerbi.rules_ref_extended')}</p>
              <p className="text-xs text-muted-foreground">{t('powerbi.table_suggestions_extended_hint')}</p>
              <div className="flex flex-wrap gap-2">
                {POWER_BI_REFERENCE_EXTENDED_TABLES.filter((name) => !tableSuggestions.includes(name)).map(
                  (name) => (
                    <Button
                      key={name}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => handleAppendExtendedSuggestion(name)}
                    >
                      + {name}
                    </Button>
                  ),
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleUseTableData}
                    disabled={!accountStatus.connected || powerBiSchemaLoading}
                  >
                    {powerBiSchemaLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    {t('powerbi.use_table_data')}
                  </Button>
                  {powerBiSchemaPreview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push('/dashboard/ai-chat?source=powerbi')}
                    >
                      {t('powerbi.ask_ai')}
                    </Button>
                  ) : null}
                </div>
                {!accountStatus.connected ? (
                  <p className="text-xs text-muted-foreground sm:max-w-md">{t('powerbi.use_table_data_need_account')}</p>
                ) : null}
              </div>

              {tableDataPreviewSection}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedSchemaDetail != null} onOpenChange={(open) => (!open ? setSelectedSchemaName(null) : null)}>
        <DialogContent className="!w-[96vw] !max-w-none h-[88vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedSchemaDetail?.name ?? t('powerbi.table_data_preview_title')}</DialogTitle>
            <DialogDescription>
              {selectedSchemaDetail
                ? `${Math.min(selectedSchemaDetail.rows.length, TABLE_DATA_PREVIEW_ROW_LIMIT)} / ${TABLE_DATA_PREVIEW_ROW_LIMIT} ${t('powerbi.table_data_total_rows').toLowerCase()}, ${selectedSchemaDetail.columns.length} ${t('powerbi.table_data_column_count_label').toLowerCase()}`
                : t('powerbi.table_data_preview_title')}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(88vh-110px)] overflow-hidden rounded-md border border-border">
            {selectedSchemaDetail ? (
              <ScrollableTableRegion className="h-full rounded-none border-0">
                <Table>
                  <TableHeader>
                    <TableRow className={scrollableTableHeaderRowClass}>
                      <TableHead className="w-14">#</TableHead>
                      {selectedSchemaDetail.columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSchemaDetail.rows.map((row, idx) => (
                      <TableRow key={`${selectedSchemaDetail.name}-${idx}`}>
                        <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                        {selectedSchemaDetail.columns.map((col) => (
                          <TableCell key={`${idx}-${col}`} className="max-w-[280px] truncate" title={String(row?.[col] ?? '-')}>
                            {String(row?.[col] ?? '-')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableRegion>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
