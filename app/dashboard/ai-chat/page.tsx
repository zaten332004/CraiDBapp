'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { getAccessToken, getUserRole, type UserRole } from '@/lib/auth/token';
import { cn } from '@/lib/utils';
import { notifyError } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { ChatMarkdown } from '@/components/ai-chat/chat-markdown';
import {
  BarChart3,
  CircleX,
  FileText,
  LayoutDashboard,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

type ChatSender = 'user' | 'assistant';
type ModelTier = 'fast' | 'thinking' | 'pro' | (string & {});

type ModelOption = {
  tier: ModelTier;
  model: string;
  minRole: UserRole | null;
  label?: string | null;
  description?: string | null;
  raw: unknown;
};

type MessageAttachment = {
  id: string;
  name: string;
  context_text?: string;
  columns?: string[];
  preview_rows?: Record<string, unknown>[];
  row_count?: number;
  column_count?: number;
  extension?: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: Date;
  sources?: string[];
  attachments?: MessageAttachment[];
  raw?: unknown;
};

type ChatSession = {
  id: string;
  title?: string | null;
  updatedAt?: string | null;
  pinned?: boolean;
  raw: unknown;
};

type UploadedFileCtx = {
  id: string;
  name: string;
  context_text?: string;
  row_count?: number;
  column_count?: number;
  columns?: string[];
  preview_rows?: Record<string, unknown>[];
  extension?: string;
  [key: string]: unknown;
};

type AiDataSource = 'portfolio' | 'customer' | 'upload' | 'powerbi';

function normalizeCustomerSearchResponse(data: unknown): Array<{ customer_id: number; label: string }> {
  if (data == null || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  let items: unknown[] = [];
  if (Array.isArray(d.items)) items = d.items;
  else if (Array.isArray(d.customers)) items = d.customers;
  else if (Array.isArray(d.data)) items = d.data;
  else if (Array.isArray(d.results)) items = d.results;
  const out: Array<{ customer_id: number; label: string }> = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const id = Number(o.customer_id ?? o.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const full = String(o.full_name ?? o.name ?? '').trim();
    const ref = String(o.external_customer_ref ?? o.national_id ?? '').trim();
    const label = full ? (ref ? `${full} (${ref})` : full) : ref || `#${id}`;
    out.push({ customer_id: id, label });
  }
  return out;
}

const PENDING_FILES_STORAGE_KEY = 'crs_ai_chat_pending_uploads_v1';
const LAST_AI_CHAT_MODEL_STORAGE_KEY = 'crs_ai_chat_last_model_v1';

function readStoredLastAiChatModel(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(LAST_AI_CHAT_MODEL_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function writeStoredLastAiChatModel(model: string) {
  if (typeof window === 'undefined') return;
  const s = String(model || '').trim();
  if (!s) return;
  try {
    window.localStorage.setItem(LAST_AI_CHAT_MODEL_STORAGE_KEY, s);
  } catch {
    // ignore quota / private mode
  }
}
const ATTACHMENT_PREVIEW_ROW_CAP_SEND = 50;
const ATTACHMENT_PREVIEW_ROW_CAP_STORAGE = 40;
const CHAT_INPUT_MIN_PX = 48;
/** ~18 lines at ~22px line-height before inner scroll */
const CHAT_INPUT_MAX_PX = 400;
const UPLOAD_FILE_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function filterAiChatAcceptedFiles(list: FileList | null | undefined): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter((f) => {
    const n = f.name.toLowerCase();
    return n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls');
  });
}

function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  if (!dt?.types?.length) return false;
  try {
    return Array.from(dt.types as unknown as string[]).includes('Files');
  } catch {
    return false;
  }
}

function loadPendingFilesFromStorage(): UploadedFileCtx[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PENDING_FILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is UploadedFileCtx =>
        Boolean(x) && typeof x === 'object' && typeof (x as UploadedFileCtx).id === 'string' && typeof (x as UploadedFileCtx).name === 'string',
    );
  } catch {
    return [];
  }
}

function normalizeMessageAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? '').trim();
    const name = String(o.name ?? o.file_name ?? o.fileName ?? '').trim();
    if (!id || !name) continue;
    const pr = o.preview_rows ?? o.previewRows;
    out.push({
      id,
      name,
      context_text:
        typeof o.context_text === 'string'
          ? o.context_text
          : typeof o.contextText === 'string'
            ? o.contextText
            : undefined,
      columns: Array.isArray(o.columns) ? o.columns.map(String) : undefined,
      preview_rows: Array.isArray(pr) ? (pr as Record<string, unknown>[]) : undefined,
      row_count: typeof o.row_count === 'number' ? o.row_count : Number(o.rowCount) || undefined,
      column_count: typeof o.column_count === 'number' ? o.column_count : Number(o.columnCount) || undefined,
      extension: typeof o.extension === 'string' ? o.extension : undefined,
    });
  }
  return out;
}

function uploadedCtxToMessageAttachments(files: UploadedFileCtx[]): MessageAttachment[] {
  return files.map((f) => {
    const pr = Array.isArray(f.preview_rows) ? f.preview_rows.slice(0, ATTACHMENT_PREVIEW_ROW_CAP_SEND) : undefined;
    return {
      id: f.id,
      name: f.name,
      context_text: typeof f.context_text === 'string' ? f.context_text : undefined,
      columns: Array.isArray(f.columns) ? f.columns.map(String) : undefined,
      preview_rows: pr,
      row_count: f.row_count,
      column_count: f.column_count,
      extension: typeof f.extension === 'string' ? f.extension : undefined,
    };
  });
}

function roleRank(role: UserRole | null) {
  switch (role) {
    case 'viewer':
      return 0;
    case 'analyst':
      return 1;
    case 'manager':
      return 2;
    case 'admin':
      return 3;
    default:
      return 0;
  }
}

function normalizeMinRole(value: unknown): UserRole | null {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'admin' || v === 'manager' || v === 'analyst' || v === 'viewer') return v;
  return null;
}

function normalizeTier(value: unknown): ModelTier {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'fast' || v === 'thinking' || v === 'pro') return v;
  return v || 'fast';
}

function toModelOption(item: any): ModelOption | null {
  if (!item || typeof item !== 'object') return null;
  const model = String(item.model ?? item.model_id ?? item.modelId ?? item.name ?? item.id ?? '').trim();
  if (!model) return null;
  const tier = normalizeTier(item.tier ?? item.kind ?? item.group ?? item.level);
  const minRole = normalizeMinRole(item.min_role ?? item.minRole ?? item.required_role ?? item.requiredRole);
  const label = String(item.label ?? item.title ?? '').trim() || null;
  const description = String(item.description ?? item.desc ?? '').trim() || null;
  return { tier, model, minRole, label, description, raw: item };
}

function normalizeSession(item: any): ChatSession | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.session_id ?? item.sessionId ?? item.id ?? '').trim();
  if (!id) return null;
  const title =
    String(item.session_name ?? item.sessionName ?? item.title ?? item.name ?? item.label ?? '').trim() || null;
  const updatedAt = String(item.updated_at ?? item.updatedAt ?? item.last_active_at ?? item.lastActiveAt ?? '').trim() || null;
  const pinned = Boolean(item.is_pinned ?? item.isPinned ?? item.pinned ?? false);
  return { id, title, updatedAt, pinned, raw: item };
}

function normalizeHistoryMessage(item: any, idx: number): ChatMessage | null {
  if (!item || typeof item !== 'object') return null;
  const role = String(item.sender ?? item.role ?? item.type ?? '').toLowerCase();
  const sender: ChatSender = role === 'user' ? 'user' : 'assistant';
  const text = String(item.text ?? item.content ?? item.message ?? item.response ?? '').trim();
  const attachments = sender === 'user' ? normalizeMessageAttachments(item.attachments) : [];
  if (!text && attachments.length === 0) return null;
  const tsRaw = item.timestamp ?? item.created_at ?? item.createdAt ?? item.time ?? null;
  const ts = tsRaw ? new Date(String(tsRaw)) : new Date();
  return {
    id: String(item.id ?? `${sender}-${idx}-${ts.getTime()}`),
    text,
    sender,
    timestamp: Number.isFinite(ts.getTime()) ? ts : new Date(),
    sources: Array.isArray(item.sources) ? item.sources.map(String) : undefined,
    attachments: attachments.length ? attachments : undefined,
    raw: item,
  };
}

async function postAiChatUpload(file: File): Promise<UploadedFileCtx[]> {
  const form = new FormData();
  form.append('file', file);
  const token = getAccessToken();
  const res = await fetch('/api/v1/ai-chat/upload-file', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Upload failed (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail?: unknown }).detail ?? res.statusText)
        : text || res.statusText;
    throw new Error(msg);
  }
  const uploaded =
    typeof data === 'object' && data && 'uploaded_files' in data
      ? (data as { uploaded_files?: unknown }).uploaded_files
      : null;
  if (!Array.isArray(uploaded)) return [];
  return uploaded.filter((x): x is UploadedFileCtx => x && typeof x === 'object' && typeof (x as UploadedFileCtx).id === 'string');
}

/** Cap preview_rows for request size; backend persists columns + preview for history UI. */
function slimUploadedFilesForSend(files: UploadedFileCtx[]): Record<string, unknown>[] {
  return files.map((f) => {
    const ext =
      typeof f.extension === 'string'
        ? f.extension
        : String(f.name || '').includes('.')
          ? String(f.name).split('.').pop() || ''
          : '';
    const columns = Array.isArray(f.columns) ? f.columns.map(String).filter(Boolean) : [];
    const previewSlice =
      Array.isArray(f.preview_rows) && f.preview_rows.length
        ? (f.preview_rows as Record<string, unknown>[]).slice(0, ATTACHMENT_PREVIEW_ROW_CAP_SEND)
        : [];
    const base: Record<string, unknown> = {
      id: f.id,
      name: f.name,
      file_name: f.name,
      status: 'ready',
      extension: ext,
      row_count: f.row_count,
      column_count: f.column_count,
      context_text: String(f.context_text ?? '').trim(),
    };
    if (columns.length) base.columns = columns;
    if (previewSlice.length) base.preview_rows = previewSlice;
    return base;
  });
}

export default function AIChatPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const apiErr = (err: unknown) => formatUserFacingApiError(err, msgLocale);

  const [aiDataSource, setAiDataSource] = useState<AiDataSource>('portfolio');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<Array<{ customer_id: number; label: string }>>(
    [],
  );
  const [selectedCustomer, setSelectedCustomer] = useState<{ customer_id: number; label: string } | null>(null);

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<UploadedFileCtx[]>([]);
  const skipPendingPersistOnceRef = useRef(true);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [resolvedAttachment, setResolvedAttachment] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    truncated: boolean;
    row_count: number;
    returned_rows: number;
  } | null>(null);
  const [attachmentDetailLoading, setAttachmentDetailLoading] = useState(false);
  const [attachmentFullFetchFailed, setAttachmentFullFetchFailed] = useState(false);

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  /** Incremented when sending the first message from the hero layout (triggers bottom snap animation). */
  const [composerSnapGeneration, setComposerSnapGeneration] = useState(0);
  const [composerSnapPlaying, setComposerSnapPlaying] = useState(false);
  const [firstSessionMessagesAnim, setFirstSessionMessagesAnim] = useState(false);
  const [dropChatHighlight, setDropChatHighlight] = useState(false);
  const dragChatDepthRef = useRef(0);

  const hasConversation = useMemo(() => {
    if (messages.some((m) => m.sender === 'user')) return true;
    if (messages.some((m) => m.sender === 'assistant')) return true;
    return false;
  }, [messages]);

  const canSubmitComposer = useMemo(() => {
    if (!input.trim() && pendingFiles.length === 0) return false;
    if (aiDataSource === 'upload') return pendingFiles.length > 0;
    if (aiDataSource === 'customer') return Boolean(selectedCustomer);
    return true;
  }, [input, pendingFiles.length, aiDataSource, selectedCustomer]);

  const selectedModelOption = useMemo(
    () => (selectedModel ? modelOptions.find((o) => o.model === selectedModel) ?? null : null),
    [modelOptions, selectedModel],
  );

  const previewTableColumns = useMemo(() => {
    if (resolvedAttachment?.columns?.length) return resolvedAttachment.columns;
    const att = previewAttachment;
    if (!att) return [];
    if (att.columns?.length) return att.columns;
    const pr = att.preview_rows;
    if (pr?.length && pr[0] && typeof pr[0] === 'object') return Object.keys(pr[0] as object);
    return [];
  }, [previewAttachment, resolvedAttachment]);

  const previewTableRows = useMemo(() => {
    if (resolvedAttachment?.rows?.length) return resolvedAttachment.rows;
    return previewAttachment?.preview_rows ?? [];
  }, [previewAttachment, resolvedAttachment]);

  const isShowingFullAttachmentData = Boolean(resolvedAttachment?.rows?.length);

  const syncChatInputHeight = useCallback(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(CHAT_INPUT_MAX_PX, Math.max(CHAT_INPUT_MIN_PX, el.scrollHeight));
    el.style.height = `${next}px`;
  }, []);

  useLayoutEffect(() => {
    syncChatInputHeight();
  }, [input, syncChatInputHeight, hasConversation, pendingFiles.length]);

  useLayoutEffect(() => {
    if (!hasConversation) {
      setComposerSnapPlaying(false);
      setFirstSessionMessagesAnim(false);
      return;
    }
    if (composerSnapGeneration === 0) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setFirstSessionMessagesAnim(true);
          setComposerSnapPlaying(true);
        }
      });
    });
    const tid = window.setTimeout(() => {
      if (!cancelled) {
        setComposerSnapPlaying(false);
        setFirstSessionMessagesAnim(false);
      }
    }, 1000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      window.clearTimeout(tid);
    };
  }, [hasConversation, composerSnapGeneration]);

  useEffect(() => {
    if (!composerSnapPlaying || typeof window === 'undefined') return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setComposerSnapPlaying(false);
    setFirstSessionMessagesAnim(false);
  }, [composerSnapPlaying]);

  useEffect(() => {
    if (!selectedModel || modelOptions.length === 0) return;
    const opt = modelOptions.find((o) => o.model === selectedModel);
    if (!opt || !isModelAllowed(opt)) return;
    writeStoredLastAiChatModel(selectedModel);
  }, [selectedModel, modelOptions, userRole]);

  useEffect(() => {
    if (!previewAttachment?.id) {
      setResolvedAttachment(null);
      setAttachmentDetailLoading(false);
      setAttachmentFullFetchFailed(false);
      return;
    }
    const id = previewAttachment.id.trim();
    let cancelled = false;
    setResolvedAttachment(null);
    setAttachmentFullFetchFailed(false);
    if (!UPLOAD_FILE_ID_UUID_RE.test(id)) {
      setAttachmentDetailLoading(false);
      return;
    }
    setAttachmentDetailLoading(true);
    (async () => {
      try {
        const data = await browserApiFetchAuth<{
          columns?: unknown;
          rows?: unknown;
          truncated?: boolean;
          row_count?: number;
          returned_rows?: number;
        }>(`/ai-chat/uploaded-file/${encodeURIComponent(id)}`, { method: 'GET' });
        if (cancelled) return;
        const rows = Array.isArray(data?.rows) ? (data.rows as Record<string, unknown>[]) : [];
        let cols = Array.isArray(data?.columns) ? data.columns.map(String) : [];
        if (!cols.length && rows.length && rows[0] && typeof rows[0] === 'object') {
          cols = Object.keys(rows[0] as object);
        }
        if (rows.length === 0 && cols.length === 0) {
          setResolvedAttachment(null);
        } else {
          setResolvedAttachment({
            columns: cols,
            rows,
            truncated: Boolean(data?.truncated),
            row_count: Number(data?.row_count) || rows.length,
            returned_rows: Number(data?.returned_rows) || rows.length,
          });
        }
      } catch {
        if (!cancelled) {
          setResolvedAttachment(null);
          setAttachmentFullFetchFailed(true);
        }
      } finally {
        if (!cancelled) setAttachmentDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewAttachment?.id]);

  useEffect(() => {
    const restored = loadPendingFilesFromStorage();
    if (restored.length) {
      setPendingFiles(restored);
      setAiDataSource('upload');
      setSelectedCustomer(null);
    } else if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_FILES_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipPendingPersistOnceRef.current) {
      skipPendingPersistOnceRef.current = false;
      return;
    }
    try {
      if (pendingFiles.length === 0) {
        sessionStorage.removeItem(PENDING_FILES_STORAGE_KEY);
        return;
      }
      const capped = pendingFiles.map((f) => ({
        ...f,
        preview_rows: Array.isArray(f.preview_rows)
          ? f.preview_rows.slice(0, ATTACHMENT_PREVIEW_ROW_CAP_STORAGE)
          : f.preview_rows,
      }));
      sessionStorage.setItem(PENDING_FILES_STORAGE_KEY, JSON.stringify(capped));
    } catch {
      // ignore quota / private mode
    }
  }, [pendingFiles]);

  useEffect(() => {
    if (!customerPickerOpen) return;
    const q = customerSearchQuery.trim();
    if (!q) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }
    let cancelled = false;
    const tid = window.setTimeout(() => {
      void (async () => {
        setCustomerSearchLoading(true);
        try {
          const raw = await browserApiFetchAuth<Record<string, unknown>>(
            `/customers?page=1&limit=20&search_name=${encodeURIComponent(q)}`,
            { method: 'GET' },
          );
          if (cancelled) return;
          setCustomerSearchResults(normalizeCustomerSearchResponse(raw));
        } catch (err) {
          if (!cancelled) {
            setCustomerSearchResults([]);
            notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
          }
        } finally {
          if (!cancelled) setCustomerSearchLoading(false);
        }
      })();
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [customerPickerOpen, customerSearchQuery, t, msgLocale]);

  useEffect(() => {
    if (!sessionId || isLoading) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
    });
  }, [sessionId, messages, isLoading, isSending]);

  const resolveModelLabel = (tier: ModelTier, fallback?: string | null) => {
    if (fallback) return fallback;
    if (tier === 'fast') return t('ai_chat.model.fast');
    if (tier === 'thinking') return t('ai_chat.model.thinking');
    if (tier === 'pro') return t('ai_chat.model.pro');
    return String(tier);
  };

  const resolveModelDesc = (tier: ModelTier, fallback?: string | null) => {
    if (fallback) return fallback;
    if (tier === 'fast') return t('ai_chat.model.fast_desc');
    if (tier === 'thinking') return t('ai_chat.model.thinking_desc');
    if (tier === 'pro') return t('ai_chat.model.pro_desc');
    return '';
  };

  const isModelAllowed = (option: ModelOption) => {
    const currentRole = userRole ?? getUserRole();
    return roleRank(currentRole) >= roleRank(option.minRole);
  };

  const loadModels = async () => {
    try {
      const data = await browserApiFetchAuth<any>('/ai-chat/models', { method: 'GET' });
      const defaultModelValue = String(data?.default_model ?? data?.defaultModel ?? '').trim() || null;

      let options: ModelOption[] = [];
      if (Array.isArray(data)) {
        options = data.map(toModelOption).filter(Boolean) as ModelOption[];
      } else if (Array.isArray(data?.models)) {
        options = data.models.map(toModelOption).filter(Boolean) as ModelOption[];
      } else if (Array.isArray(data?.items)) {
        options = data.items.map(toModelOption).filter(Boolean) as ModelOption[];
      } else if (data?.tiers && typeof data.tiers === 'object') {
        const entries = Object.entries(data.tiers as Record<string, any>);
        options = entries
          .map(([tier, value]) => toModelOption({ tier, ...(value ?? {}) }))
          .filter(Boolean) as ModelOption[];
      }

      const order = (tier: ModelTier) => (tier === 'fast' ? 0 : tier === 'thinking' ? 1 : tier === 'pro' ? 2 : 9);
      options.sort((a, b) => order(a.tier) - order(b.tier));

      setModelOptions(options);

      setSelectedModel((prev) => {
        if (prev && options.some((o) => o.model === prev && isModelAllowed(o))) return prev;
        const saved = readStoredLastAiChatModel();
        if (saved && options.some((o) => o.model === saved && isModelAllowed(o))) return saved;
        if (defaultModelValue) {
          const def = options.find((o) => o.model === defaultModelValue);
          if (def && isModelAllowed(def)) return def.model;
        }
        const firstAllowed = options.find(isModelAllowed);
        return firstAllowed?.model ?? '';
      });
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: apiErr(err) });
    }
  };

  const loadSessions = async () => {
    try {
      const data = await browserApiFetchAuth<any>('/ai-chat/sessions', { method: 'GET' });
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.value)
            ? data.value
            : [];
      const list = rawList.map(normalizeSession).filter(Boolean) as ChatSession[];
      setSessions(list);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: apiErr(err) });
    }
  };

  const resetDraft = () => {
    setSessionId(null);
    setMessages([]);
    setInput('');
    setPendingFiles([]);
    setAiDataSource('portfolio');
    setSelectedCustomer(null);
    setCustomerPickerOpen(false);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setComposerSnapGeneration(0);
    setComposerSnapPlaying(false);
    setFirstSessionMessagesAnim(false);
    dragChatDepthRef.current = 0;
    setDropChatHighlight(false);
    if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_FILES_STORAGE_KEY);
  };

  const fetchHistoryMessages = async (id: string): Promise<ChatMessage[]> => {
    const data = await browserApiFetchAuth<any>(`/ai-chat/history/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data?.value)
            ? data.value
            : [];
    return rawList.map(normalizeHistoryMessage).filter(Boolean) as ChatMessage[];
  };

  const loadHistory = async (id: string) => {
    setMessages([]);
    setIsLoading(true);
    try {
      const list = await fetchHistoryMessages(id);
      setMessages(list);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: apiErr(err) });
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const closeSessionById = async (sid: string, opts?: { appendSummary?: boolean; clearIfActive?: boolean }) => {
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<any>(`/ai-chat/close/${encodeURIComponent(sid)}`, { method: 'POST' });
      if (opts?.appendSummary && sessionId === sid) {
        setMessages((prev) => [
          ...prev,
          {
            id: `close-${Date.now()}`,
            text: data?.summary ? String(data.summary) : t('ai_chat.session_closed'),
            sender: 'assistant',
            timestamp: new Date(),
            raw: data,
          },
        ]);
      }

      if (opts?.clearIfActive && sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: apiErr(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const setPinned = async (id: string, pinned: boolean) => {
    setIsLoading(true);
    try {
      const endpoint = pinned
        ? `/ai-chat/sessions/${encodeURIComponent(id)}/pin`
        : `/ai-chat/sessions/${encodeURIComponent(id)}/unpin`;
      await browserApiFetchAuth<any>(endpoint, { method: 'POST' });
      await loadSessions();
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: apiErr(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (id?: string | null) => {
    const sid = (id ?? sessionId) ?? null;
    if (!sid) return;
    if (typeof window !== 'undefined' && !window.confirm(t('ai_chat.delete_confirm'))) return;
    setIsLoading(true);
    try {
      await browserApiFetchAuth<any>(`/ai-chat/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      if (sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: apiErr(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && pendingFiles.length === 0) return;
    if (aiDataSource === 'upload' && pendingFiles.length === 0) {
      notifyError(t('ai_chat.error_upload_mode_no_files'));
      return;
    }
    if (aiDataSource === 'customer' && !selectedCustomer) {
      notifyError(t('ai_chat.error_customer_mode_no_customer'));
      return;
    }

    const pickLowestAllowedModel = (): string => {
      const allowed = modelOptions.filter((o) => isModelAllowed(o));
      if (!allowed.length) return '';
      const order = (tier: ModelTier) => (tier === 'fast' ? 0 : tier === 'thinking' ? 1 : tier === 'pro' ? 2 : 9);
      return [...allowed].sort((a, b) => order(a.tier) - order(b.tier))[0]?.model ?? '';
    };
    const hadValidModelSelection =
      Boolean(selectedModel) &&
      modelOptions.some((o) => o.model === selectedModel && isModelAllowed(o));
    const resolvedModel = hadValidModelSelection ? selectedModel : pickLowestAllowedModel();

    if (!hasConversation) {
      setComposerSnapGeneration((g) => g + 1);
    }

    const text = input.trim();
    const attachForMsg = pendingFiles.length ? uploadedCtxToMessageAttachments(pendingFiles) : undefined;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
      ...(attachForMsg?.length ? { attachments: attachForMsg } : {}),
    };

    const customerContext: Record<string, unknown> = {
      ai_data_source: aiDataSource,
    };
    if (aiDataSource === 'customer' && selectedCustomer) {
      customerContext.customer_id = selectedCustomer.customer_id;
    }
    if (pendingFiles.length > 0) {
      customerContext.uploaded_files = slimUploadedFilesForSend(pendingFiles);
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const body: Record<string, unknown> = {
        message: text,
        ...(sessionId ? { session_id: sessionId, sessionId } : {}),
        ...(resolvedModel ? { model: resolvedModel } : {}),
        customer_context: customerContext,
      };
      const data = await browserApiFetchAuth<any>('/ai-chat/send', {
        method: 'POST',
        body,
      });

      if (!hadValidModelSelection && resolvedModel) {
        setSelectedModel(resolvedModel);
        writeStoredLastAiChatModel(resolvedModel);
      }

      const newSid = String(data?.session_id ?? data?.sessionId ?? '').trim();
      const created = Boolean(data?.created_session ?? data?.createdSession);
      setPendingFiles([]);

      if (created && newSid) {
        setSessionId(newSid);
        try {
          const list = await fetchHistoryMessages(newSid);
          setMessages(list);
        } catch (histErr) {
          notifyError(t('toast.load_failed'), { description: apiErr(histErr) });
          const reply =
            String(data?.response ?? data?.reply ?? data?.message ?? '').trim() || t('ai_chat.default_reply');
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== userMessage.id),
            userMessage,
            {
              id: `a-${Date.now() + 1}`,
              text: reply,
              sender: 'assistant',
              timestamp: new Date(),
              sources: Array.isArray(data?.sources) ? data.sources.map(String) : undefined,
              raw: data,
            },
          ]);
        }
        setSessionsOpen(true);
        void loadSessions();
      } else {
        const reply = String(data?.response ?? data?.reply ?? data?.message ?? '').trim() || t('ai_chat.default_reply');
        const assistantMessage: ChatMessage = {
          id: `a-${Date.now() + 1}`,
          text: reply,
          sender: 'assistant',
          timestamp: new Date(),
          sources: Array.isArray(data?.sources) ? data.sources.map(String) : undefined,
          raw: data,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        void loadSessions();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userMessage.id),
        {
          id: `e-${Date.now() + 2}`,
          text: t('ai_chat.error_generic'),
          sender: 'assistant',
          timestamp: new Date(),
        },
      ]);
      notifyError(t('ai_chat.send_failed'), { description: apiErr(err) });
    } finally {
      setIsSending(false);
    }
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (isSending) return;
    if (!canSubmitComposer) return;
    e.currentTarget.form?.requestSubmit();
  };

  const applyPickedFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsUploadingFile(true);
    try {
      const next: UploadedFileCtx[] = [];
      for (const file of files) {
        const uploaded = await postAiChatUpload(file);
        next.push(...uploaded);
      }
      if (next.length) {
        setAiDataSource('upload');
        setSelectedCustomer(null);
        setPendingFiles((prev) => [...prev, ...next]);
      }
    } catch (err) {
      notifyError(t('toast.upload_import_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [t, msgLocale]);

  const chatDropZoneProps = useMemo(() => {
    const disabled = isSending || isUploadingFile;
    return {
      onDragEnter: (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (!dataTransferHasFiles(e.dataTransfer)) return;
        dragChatDepthRef.current += 1;
        setDropChatHighlight(true);
      },
      onDragLeave: (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        dragChatDepthRef.current = Math.max(0, dragChatDepthRef.current - 1);
        if (dragChatDepthRef.current === 0) setDropChatHighlight(false);
      },
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (dataTransferHasFiles(e.dataTransfer)) {
          e.dataTransfer.dropEffect = 'copy';
        }
      },
      onDrop: async (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        dragChatDepthRef.current = 0;
        setDropChatHighlight(false);
        const accepted = filterAiChatAcceptedFiles(e.dataTransfer.files);
        const dropped = e.dataTransfer.files?.length ?? 0;
        if (!accepted.length) {
          if (dropped > 0) notifyError(t('ai_chat.drop_invalid_type'));
          return;
        }
        await applyPickedFiles(accepted);
      },
    };
  }, [isSending, isUploadingFile, applyPickedFiles, t]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    await applyPickedFiles(Array.from(files));
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        setUserRole(getUserRole());
        await loadModels();
        await loadSessions();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionDisplayTitle = (s: ChatSession) => {
    const base = (s.title || '').trim();
    if (base) return `${s.pinned ? '📌 ' : ''}${base}`;
    return `${s.pinned ? '📌 ' : ''}${t('ai_chat.session')}`;
  };

  const renderModelSelect = (roundedFull?: boolean) => (
    <Select
      value={selectedModel}
      onValueChange={(value) => {
        const option = modelOptions.find((o) => o.model === value);
        if (option && !isModelAllowed(option)) return;
        setSelectedModel(value);
      }}
    >
      <SelectTrigger
        size="default"
        className={cn(
          'min-w-[140px] justify-between rounded-full h-10',
          roundedFull && 'min-w-[150px]',
        )}
        aria-label={t('ai_chat.model.label')}
        disabled={isSending || modelOptions.length === 0}
      >
        <span className="truncate">
          {selectedModelOption ? resolveModelLabel(selectedModelOption.tier, selectedModelOption.label) : t('ai_chat.model.label')}
        </span>
      </SelectTrigger>
      <SelectContent>
        {modelOptions.map((o) => {
          const allowed = isModelAllowed(o);
          const label = resolveModelLabel(o.tier, o.label);
          const desc = resolveModelDesc(o.tier, o.description);
          const needs = o.minRole ? `${t('ai_chat.model.min_role')}: ${t(`role.${o.minRole}`)}` : '';
          return (
            <SelectItem key={o.model} value={o.model} disabled={!allowed}>
              <div className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {desc}
                  {!allowed && needs ? ` • ${needs}` : ''}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const renderDataSourcePlusMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-full h-10 w-10"
          disabled={isSending || isUploadingFile}
          aria-label={t('ai_chat.data_source_menu')}
        >
          {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(calc(100vw-2rem),17rem)]">
        <DropdownMenuItem
          onClick={() => {
            setAiDataSource('customer');
            setPendingFiles([]);
            setCustomerSearchQuery('');
            setCustomerSearchResults([]);
            setCustomerPickerOpen(true);
          }}
        >
          <Users className="mr-2 h-4 w-4 shrink-0 opacity-80" />
          {t('ai_chat.data_source_customer')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setAiDataSource('upload');
            setSelectedCustomer(null);
            window.setTimeout(() => fileInputRef.current?.click(), 0);
          }}
        >
          <Upload className="mr-2 h-4 w-4 shrink-0 opacity-80" />
          {t('ai_chat.data_source_upload')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setAiDataSource('powerbi');
            setSelectedCustomer(null);
            setPendingFiles([]);
            if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_FILES_STORAGE_KEY);
          }}
        >
          <BarChart3 className="mr-2 h-4 w-4 shrink-0 opacity-80" />
          {t('ai_chat.data_source_powerbi')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setAiDataSource('portfolio');
            setSelectedCustomer(null);
          }}
        >
          <LayoutDashboard className="mr-2 h-4 w-4 shrink-0 opacity-80" />
          {t('ai_chat.data_source_portfolio')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderComposerSourceHint = () => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
      <span className="shrink-0">{t('ai_chat.data_source_active')}:</span>
      <span className="min-w-0 max-w-full truncate font-medium text-foreground/90">
        {aiDataSource === 'customer'
          ? selectedCustomer
            ? `${t('ai_chat.data_source_customer')} — ${selectedCustomer.label}`
            : t('ai_chat.data_source_customer')
          : aiDataSource === 'portfolio'
            ? t('ai_chat.data_source_portfolio')
            : aiDataSource === 'upload'
              ? t('ai_chat.data_source_upload')
              : t('ai_chat.data_source_powerbi')}
      </span>
      {selectedCustomer ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs shrink-0"
          onClick={() => setSelectedCustomer(null)}
          disabled={isSending}
        >
          <X className="mr-1 h-3 w-3" />
          {t('ai_chat.clear_customer')}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-row items-stretch gap-0 md:gap-3 p-6 md:p-8 h-[calc(100vh-5rem)] min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        multiple
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      {/* Cột nút mở — cùng vùng điều khiển Lịch sử */}
      <div
        className={cn(
          'shrink-0 flex flex-col items-center pt-1 transition-[width,opacity,margin] duration-300 ease-in-out overflow-hidden',
          sessionsOpen ? 'w-0 opacity-0 pointer-events-none md:mr-0' : 'w-11 opacity-100 mr-1 md:mr-2',
        )}
      >
        {!sessionsOpen && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-lg h-10 w-10 border-border shadow-sm"
            aria-label={t('ai_chat.open_history')}
            onClick={() => setSessionsOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Panel Lịch sử — animation kéo ngang (đủ rộng để luôn thấy nút ⋯) */}
      <div
        className={cn(
          'shrink-0 min-h-0 overflow-hidden transition-[width] duration-300 ease-in-out',
          sessionsOpen ? 'w-[min(calc(100vw-2.5rem),22rem)] sm:w-96' : 'w-0',
        )}
      >
        <div className="h-full w-full min-h-0 flex flex-col pr-0 sm:pr-1">
          <Card className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border shadow-sm">
            <CardHeader className="space-y-3 pb-2 px-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-lg h-9 w-9"
                  aria-label={t('ai_chat.hide_sessions')}
                  onClick={() => setSessionsOpen(false)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base flex-1 min-w-0 truncate">{t('ai_chat.history_title')}</CardTitle>
                <Button
                  variant="outline"
                  onClick={() => void loadSessions()}
                  disabled={isLoading}
                  size="icon"
                  className="shrink-0 rounded-lg h-9 w-9"
                  aria-label="Refresh sessions"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                onClick={resetDraft}
                disabled={isLoading}
                variant="secondary"
                className="w-full justify-start"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4 shrink-0" />
                {t('ai_chat.new_draft')}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col px-3 pb-4 pt-0 overflow-hidden">
              <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="space-y-2 pb-2 min-w-0">
                  {sessions.length === 0 && (
                    <div className="text-sm text-muted-foreground">{t('ai_chat.no_sessions')}</div>
                  )}
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        'grid grid-cols-[minmax(0,1fr)_2.75rem] items-stretch rounded-md border transition-colors',
                        s.id === sessionId ? 'bg-secondary border-border' : 'border-border/60 hover:bg-secondary/60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSessionId(s.id);
                          void loadHistory(s.id);
                        }}
                        className="min-w-0 text-left pl-2.5 pr-1 py-2 rounded-l-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <p className="text-sm font-medium truncate">{sessionDisplayTitle(s)}</p>
                      </button>
                      <div className="flex min-h-9 min-w-[2.75rem] items-stretch justify-center border-l border-border/60 bg-muted/20">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-auto min-h-9 w-full min-w-[2.75rem] shrink-0 rounded-none rounded-r-md"
                              disabled={isLoading}
                              aria-label={t('ai_chat.more_actions')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4 shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              void setPinned(s.id, !s.pinned);
                            }}
                          >
                            {s.pinned ? (
                              <PinOff className="mr-2 h-4 w-4 shrink-0" />
                            ) : (
                              <Pin className="mr-2 h-4 w-4 shrink-0" />
                            )}
                            {s.pinned ? t('ai_chat.unpin') : t('ai_chat.pin')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              void closeSessionById(s.id, { appendSummary: false, clearIfActive: true });
                            }}
                          >
                            <CircleX className="mr-2 h-4 w-4 shrink-0" />
                            {t('ai_chat.close_session')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              void deleteSession(s.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                            {t('ai_chat.delete_session')}
                          </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle>{t('ai_chat.title')}</CardTitle>
          <CardDescription>{t('ai_chat.desc')}</CardDescription>
        </CardHeader>
        <CardContent
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            !hasConversation && 'py-10',
            hasConversation && 'pb-2 pt-0',
          )}
        >
          {!hasConversation ? (
            <div
              className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 px-1"
              {...chatDropZoneProps}
            >
              {dropChatHighlight ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent/12 px-4 text-center text-sm font-semibold text-accent-foreground ring-2 ring-inset ring-accent/25"
                  aria-hidden
                >
                  {t('ai_chat.drop_files_hint')}
                </div>
              ) : null}
              <div className="w-full max-w-5xl space-y-2 px-2 text-center">
                <h2 className="text-4xl font-semibold tracking-tight">{t('ai_chat.title')}</h2>
                <p className="text-muted-foreground">{t('ai_chat.hero_subtitle')}</p>
              </div>

              <div className="w-full max-w-5xl px-2">
                <form
                  onSubmit={handleSendMessage}
                  className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-muted/15 p-3 shadow-sm dark:bg-muted/20"
                >
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((f) => (
                        <Badge key={f.id} variant="secondary" className="gap-1 pr-1 font-normal max-w-full">
                          <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="truncate max-w-[min(280px,70vw)]">{f.name}</span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted shrink-0"
                            aria-label={t('ai_chat.remove_attachment')}
                            onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Textarea
                    ref={chatInputRef}
                    placeholder={t('ai_chat.placeholder')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onInput={syncChatInputHeight}
                    onKeyDown={onComposerKeyDown}
                    disabled={isSending}
                    rows={1}
                    style={{ maxHeight: CHAT_INPUT_MAX_PX, fieldSizing: 'fixed' }}
                    className="min-h-[48px] w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                  />
                  {renderComposerSourceHint()}
                  <div className="flex flex-wrap items-end justify-between gap-2 pt-1 border-t border-border/60">
                    {renderDataSourcePlusMenu()}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {renderModelSelect(true)}
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isSending || !canSubmitComposer}
                        className="shrink-0 rounded-full h-10 w-10"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {[t('ai_chat.prompt_1'), t('ai_chat.prompt_2'), t('ai_chat.prompt_3'), t('ai_chat.prompt_4')].map((prompt, idx) => (
                    <Button key={idx} variant="outline" size="sm" onClick={() => setInput(prompt)} className="rounded-full">
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col" {...chatDropZoneProps}>
              {dropChatHighlight ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/12 px-4 text-center text-sm font-semibold text-accent-foreground"
                  aria-hidden
                >
                  {t('ai_chat.drop_files_hint')}
                </div>
              ) : null}
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col pr-0',
                  firstSessionMessagesAnim && 'ai-chat-messages-reveal',
                )}
                onAnimationEnd={(ev) => {
                  if (ev.target !== ev.currentTarget) return;
                  if (String(ev.animationName || '').includes('ai-chat-messages-reveal')) {
                    setFirstSessionMessagesAnim(false);
                  }
                }}
              >
                <ScrollArea className="min-h-0 flex-1 pr-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-4xl min-w-0">
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            message.sender === 'user' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground'
                          }`}
                        >
                          {message.sender === 'user' && message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {message.attachments.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setPreviewAttachment(a)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-accent-foreground/25 bg-background/15 px-2 py-1 text-xs font-medium text-accent-foreground hover:bg-background/25 text-left max-w-full"
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-90" />
                                  <span className="truncate min-w-0">{a.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {message.sender === 'assistant' ? (
                            <ChatMarkdown text={message.text} />
                          ) : message.text ? (
                            <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                          ) : null}
                          <span className="text-xs opacity-70 mt-3 block">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.sources.map((source, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isSending && (
                    <div className="flex justify-start">
                      <div className="bg-secondary text-foreground rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              </div>

              <div
                className={cn(
                  'mt-auto w-full shrink-0 pt-3',
                  composerSnapPlaying && 'ai-chat-composer-snap-to-bottom',
                )}
                onAnimationEnd={(ev) => {
                  if (ev.target !== ev.currentTarget) return;
                  if (String(ev.animationName || '').includes('ai-chat-composer-snap-to-bottom')) {
                    setComposerSnapPlaying(false);
                  }
                }}
              >
                <form
                  onSubmit={handleSendMessage}
                  className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-muted/15 p-3 shadow-sm dark:bg-muted/20"
                >
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f) => (
                      <Badge key={f.id} variant="secondary" className="gap-1 pr-1 font-normal max-w-full">
                        <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        <span className="truncate max-w-[min(280px,55vw)]">{f.name}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-muted shrink-0"
                          aria-label={t('ai_chat.remove_attachment')}
                          onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Textarea
                  ref={chatInputRef}
                  placeholder={t('ai_chat.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={syncChatInputHeight}
                  onKeyDown={onComposerKeyDown}
                  disabled={isSending}
                  rows={1}
                  style={{ maxHeight: CHAT_INPUT_MAX_PX, fieldSizing: 'fixed' }}
                  className="min-h-[48px] w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                />
                {renderComposerSourceHint()}
                <div className="flex flex-wrap items-end justify-between gap-2 pt-1 border-t border-border/60">
                  {renderDataSourcePlusMenu()}
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {renderModelSelect(false)}
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isSending || !canSubmitComposer}
                      className="shrink-0 rounded-full h-10 w-10"
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={customerPickerOpen}
        onOpenChange={(open) => {
          setCustomerPickerOpen(open);
          if (!open) {
            setCustomerSearchQuery('');
            setCustomerSearchResults([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('ai_chat.customer_picker_title')}</DialogTitle>
            <DialogDescription>{t('ai_chat.customer_picker_desc')}</DialogDescription>
          </DialogHeader>
          <Input
            value={customerSearchQuery}
            onChange={(e) => setCustomerSearchQuery(e.target.value)}
            placeholder={t('ai_chat.customer_picker_search_placeholder')}
            autoFocus
          />
          <ScrollArea className="mt-2 h-64 rounded-md border p-2">
            {!customerSearchQuery.trim() ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('ai_chat.customer_picker_hint')}</p>
            ) : customerSearchLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('ai_chat.customer_picker_loading')}</p>
            ) : customerSearchResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('ai_chat.customer_picker_empty')}</p>
            ) : (
              <div className="space-y-1 pr-2">
                {customerSearchResults.map((row) => (
                  <Button
                    key={row.customer_id}
                    type="button"
                    variant="ghost"
                    className="flex h-auto w-full items-center justify-start gap-2 px-2 py-2 text-left font-normal"
                    onClick={() => {
                      setSelectedCustomer({ customer_id: row.customer_id, label: row.label });
                      setAiDataSource('customer');
                      setCustomerPickerOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">#{row.customer_id}</span>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
            setResolvedAttachment(null);
            setAttachmentDetailLoading(false);
            setAttachmentFullFetchFailed(false);
          }
        }}
      >
        <DialogContent className="flex h-[min(92vh,920px)] w-[min(98vw,1400px)] max-h-[92vh] max-w-[min(98vw,1400px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(98vw,1400px)]">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-2">
            <DialogTitle>{t('ai_chat.attachment_detail_title')}</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block truncate" title={previewAttachment?.name}>
                {previewAttachment?.name ?? ''}
              </span>
              {previewAttachment && previewTableColumns.length > 0 && previewTableRows.length > 0 ? (
                <span className="text-xs">
                  {isShowingFullAttachmentData
                    ? t('ai_chat.attachment_full_hint')
                        .replace('{rows}', String(previewTableRows.length))
                        .replace('{cols}', String(previewTableColumns.length))
                    : t('ai_chat.attachment_rows_hint')
                        .replace('{rows}', String(previewTableRows.length))
                        .replace('{cols}', String(previewTableColumns.length))}
                </span>
              ) : null}
              {resolvedAttachment?.truncated ? (
                <span className="text-xs text-amber-700 dark:text-amber-400 block">
                  {t('ai_chat.attachment_truncated')
                    .replace('{shown}', String(resolvedAttachment.returned_rows))
                    .replace('{total}', String(resolvedAttachment.row_count))}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-6 pb-5">
            {attachmentDetailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {t('ai_chat.attachment_loading')}
              </div>
            ) : null}
            {attachmentFullFetchFailed && (previewAttachment?.preview_rows?.length || previewAttachment?.context_text) ? (
              <p className="text-xs text-muted-foreground shrink-0">{t('ai_chat.attachment_preview_fallback')}</p>
            ) : null}
            {previewAttachment && previewTableColumns.length > 0 && previewTableRows.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-md border bg-muted/30 p-2">
                <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background">
                  <table className="w-max border-separate border-spacing-0 text-xs leading-5">
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-0 z-20 border-r border-border bg-muted px-2 py-2 text-left font-semibold w-10 min-w-[2.5rem]">
                          #
                        </th>
                        {previewTableColumns.map((col) => (
                          <th
                            key={col}
                            title={col}
                            className="sticky top-0 z-10 bg-muted px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[120px] max-w-[min(280px,40vw)]"
                          >
                            <span className="block truncate" title={col}>
                              {col}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTableRows.map((row, idx) => (
                        <tr key={`${previewAttachment.id}-${idx}`} className="border-t border-border/60">
                          <td className="sticky left-0 z-[1] border-r border-border bg-background px-2 py-1.5 text-muted-foreground align-top">
                            {idx + 1}
                          </td>
                          {previewTableColumns.map((col) => (
                            <td
                              key={`${idx}-${col}`}
                              title={row?.[col] == null ? '-' : String(row[col])}
                              className="px-2 py-1.5 align-top min-w-[120px] max-w-[min(280px,40vw)]"
                            >
                              <span className="block truncate" title={row?.[col] == null ? '-' : String(row[col])}>
                                {row?.[col] == null ? '-' : String(row[col])}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : previewAttachment?.context_text?.trim() ? (
              <ScrollArea className="h-[min(58vh,480px)] min-h-[240px] w-full rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('ai_chat.attachment_text_fallback')}</p>
                <pre className="text-xs whitespace-pre-wrap break-words font-mono">{previewAttachment.context_text}</pre>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t('ai_chat.attachment_no_preview')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
