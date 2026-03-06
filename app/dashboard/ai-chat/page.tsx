'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';
import { getUserRole, type UserRole } from '@/lib/auth/token';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, MessageSquarePlus, RefreshCw, Send, Trash2, X, Pin, PinOff } from 'lucide-react';

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

type ChatMessage = {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: Date;
  sources?: string[];
  raw?: unknown;
};

type ChatSession = {
  id: string;
  title?: string | null;
  updatedAt?: string | null;
  pinned?: boolean;
  raw: unknown;
};

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

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
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
  const title = String(item.title ?? item.name ?? item.label ?? '').trim() || null;
  const updatedAt = String(item.updated_at ?? item.updatedAt ?? item.last_active_at ?? item.lastActiveAt ?? '').trim() || null;
  const pinned = Boolean(item.is_pinned ?? item.isPinned ?? item.pinned ?? false);
  return { id, title, updatedAt, pinned, raw: item };
}

function normalizeHistoryMessage(item: any, idx: number): ChatMessage | null {
  if (!item || typeof item !== 'object') return null;
  const role = String(item.sender ?? item.role ?? item.type ?? '').toLowerCase();
  const sender: ChatSender = role === 'user' ? 'user' : 'assistant';
  const text = String(item.text ?? item.content ?? item.message ?? item.response ?? '').trim();
  if (!text) return null;
  const tsRaw = item.timestamp ?? item.created_at ?? item.createdAt ?? item.time ?? null;
  const ts = tsRaw ? new Date(String(tsRaw)) : new Date();
  return {
    id: String(item.id ?? `${sender}-${idx}-${ts.getTime()}`),
    text,
    sender,
    timestamp: Number.isFinite(ts.getTime()) ? ts : new Date(),
    sources: Array.isArray(item.sources) ? item.sources.map(String) : undefined,
    raw: item,
  };
}

export default function AIChatPage() {
  const { t } = useI18n();

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debugData, setDebugData] = useState<any>(null);
  const [contextPreview, setContextPreview] = useState<any>(null);
  const [activeSideTab, setActiveSideTab] = useState<'debug' | 'context'>('debug');

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedSession = useMemo(
    () => (sessionId ? sessions.find((s) => s.id === sessionId) ?? null : null),
    [sessionId, sessions],
  );

  const hasConversation = useMemo(() => {
    if (messages.some((m) => m.sender === 'user')) return true;
    if (messages.some((m) => m.id !== 'init')) return true;
    return false;
  }, [messages]);

  const selectedModelOption = useMemo(
    () => (selectedModel ? modelOptions.find((o) => o.model === selectedModel) ?? null : null),
    [modelOptions, selectedModel],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

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
    setError(null);
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
      setDefaultModel(defaultModelValue);

      setSelectedModel((prev) => {
        if (prev && options.some((o) => o.model === prev && isModelAllowed(o))) return prev;
        if (defaultModelValue) {
          const def = options.find((o) => o.model === defaultModelValue);
          if (def && isModelAllowed(def)) return def.model;
        }
        const firstAllowed = options.find(isModelAllowed);
        return firstAllowed?.model ?? '';
      });
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const loadSessions = async () => {
    setError(null);
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
      if (!sessionId && list[0]?.id) setSessionId(list[0].id);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const startSession = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (selectedModel) body.model = selectedModel;
      const data = await browserApiFetchAuth<any>('/ai-chat/start', { method: 'POST', body });
      const newId = String(data?.session_id ?? data?.sessionId ?? data?.id ?? '').trim();
      const usedModel = String(data?.model ?? data?.used_model ?? data?.model_id ?? data?.modelId ?? '').trim();
      if (usedModel) setActiveModel(usedModel);
      await loadSessions();
      if (newId) setSessionId(newId);
      setMessages([
        {
          id: 'init',
          text: t('ai_chat.initial_message'),
          sender: 'assistant',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async (id: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<any>(`/ai-chat/history/${encodeURIComponent(id)}?limit=50`, {
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
      const list = rawList.map(normalizeHistoryMessage).filter(Boolean) as ChatMessage[];
      setMessages(
        list.length > 0
          ? list
          : [
              {
                id: 'init',
                text: t('ai_chat.initial_message'),
                sender: 'assistant',
                timestamp: new Date(),
              },
            ],
      );
    } catch (err) {
      setError(formatApiError(err));
      setMessages([
        {
          id: 'init',
          text: t('ai_chat.initial_message'),
          sender: 'assistant',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDebug = async () => {
    setError(null);
    try {
      const data = await browserApiFetchAuth<any>('/ai-chat/debug', { method: 'GET' });
      setDebugData(data);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const refreshContext = async () => {
    setError(null);
    try {
      const data = await browserApiFetchAuth<any>('/ai-chat/context-preview', { method: 'GET' });
      setContextPreview(data);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const closeSessionById = async (sid: string, opts?: { appendSummary?: boolean; clearIfActive?: boolean }) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<any>(`/ai-chat/close/${encodeURIComponent(sid)}`, { method: 'POST' });
      if (opts?.appendSummary) {
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
      const usedModel = String(data?.model ?? data?.used_model ?? data?.model_id ?? data?.modelId ?? '').trim();
      if (usedModel) setActiveModel(usedModel);

      if (opts?.clearIfActive && sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const closeSession = async () => {
    if (!sessionId) return;
    return closeSessionById(sessionId, { appendSummary: true });
  };


  const setPinned = async (id: string, pinned: boolean) => {
    setError(null);
    setIsLoading(true);
    try {
      const endpoint = pinned
        ? `/ai-chat/sessions/${encodeURIComponent(id)}/pin`
        : `/ai-chat/sessions/${encodeURIComponent(id)}/unpin`;
      await browserApiFetchAuth<any>(endpoint, { method: 'POST' });
      await loadSessions();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (id?: string | null) => {
    const sid = (id ?? sessionId) ?? null;
    if (!sid) return;
    setError(null);
    setIsLoading(true);
    try {
      await browserApiFetchAuth<any>(`/ai-chat/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      if (sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!sessionId) return;

    const text = input;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const modelToSend =
        selectedModel && modelOptions.some((o) => o.model === selectedModel && isModelAllowed(o))
          ? selectedModel
          : '';
      const data = await browserApiFetchAuth<any>('/ai-chat/send', {
        method: 'POST',
        body: {
          session_id: sessionId,
          sessionId,
          message: text,
          ...(modelToSend ? { model: modelToSend } : {}),
        },
      });

      const reply = String(data?.response ?? data?.reply ?? data?.message ?? '').trim() || t('ai_chat.default_reply');
      const usedModel = String(data?.model ?? data?.used_model ?? data?.model_id ?? data?.modelId ?? '').trim();
      if (usedModel) setActiveModel(usedModel);
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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now() + 2}`,
          text: t('ai_chat.error_generic'),
          sender: 'assistant',
          timestamp: new Date(),
        },
      ]);
      setError(formatApiError(err));
    } finally {
      setIsSending(false);
    }
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

  useEffect(() => {
    if (!sessionId) return;
    void loadHistory(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    void refreshDebug();
    void refreshContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-8 h-[calc(100vh-5rem)]">
      {/* Sessions */}
      <Card className="lg:col-span-3 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{t('ai_chat.sessions')}</CardTitle>
          <CardDescription>{t('ai_chat.sessions_desc')}</CardDescription>
          <div className="flex gap-2">
            <Button onClick={startSession} disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
              {t('ai_chat.new_session')}
            </Button>
            <Button variant="outline" onClick={() => void loadSessions()} disabled={isLoading} size="icon" aria-label="Refresh sessions">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {selectedSession && (
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="font-mono">
                {selectedSession.id.slice(0, 8)}…
              </Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void setPinned(selectedSession.id, !Boolean(selectedSession.pinned))}
                  disabled={isLoading}
                >
                  {selectedSession.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                  {selectedSession.pinned ? t('ai_chat.unpin') || 'Bỏ ghim' : t('ai_chat.pin') || 'Ghim'}
                </Button>
                <Button variant="outline" size="sm" onClick={closeSession} disabled={isLoading}>
                  <X className="mr-2 h-4 w-4" />
                  {t('ai_chat.close_session')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void deleteSession(selectedSession.id)} disabled={isLoading}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('ai_chat.delete_session') || 'Xóa'}
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-2">
              {sessions.length === 0 && (
                <div className="text-sm text-muted-foreground">{t('ai_chat.no_sessions')}</div>
              )}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSessionId(s.id)}
                  className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                    s.id === sessionId ? 'bg-secondary border-border' : 'hover:bg-secondary/60 border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.pinned ? '📌 ' : ''}{s.title || t('ai_chat.session')}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{s.id}</p>
                    </div>
                    {s.updatedAt && (
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {s.updatedAt}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card
        className={cn(
          'flex flex-col min-h-0 min-w-0 overflow-hidden',
          hasConversation ? 'lg:col-span-6' : 'lg:col-span-9',
        )}
      >
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{t('ai_chat.title')}</CardTitle>
              <CardDescription>{t('ai_chat.desc')}</CardDescription>
            </div>
            {(activeModel || defaultModel) && (
              <Badge variant="outline" className="font-mono">
                {(activeModel || defaultModel) ?? ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn('flex-1 flex flex-col min-h-0', !hasConversation && 'py-10')}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}

          {!hasConversation ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6">
              <div className="text-center space-y-2 max-w-2xl">
                <h2 className="text-4xl font-semibold tracking-tight">{t('ai_chat.title')}</h2>
                <p className="text-muted-foreground">{t('ai_chat.desc')}</p>
              </div>

              <div className="w-full max-w-2xl">
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <Input
                    placeholder={t('ai_chat.placeholder')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isSending || !sessionId}
                    className="flex-1 rounded-full h-12 px-5"
                  />
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
                      className="min-w-[140px] justify-between rounded-full h-12"
                      aria-label={t('ai_chat.model.label')}
                      disabled={isSending || !sessionId || modelOptions.length === 0}
                    >
                      <span className="truncate">
                        {selectedModelOption
                          ? resolveModelLabel(selectedModelOption.tier, selectedModelOption.label)
                          : t('ai_chat.model.label')}
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
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !input.trim() || !sessionId}
                    className="shrink-0 rounded-full h-12 w-12"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {[t('ai_chat.prompt_1'), t('ai_chat.prompt_2'), t('ai_chat.prompt_3'), t('ai_chat.prompt_4')].map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(prompt)}
                      className="rounded-full"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0 pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-4xl min-w-0">
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            message.sender === 'user'
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-secondary text-foreground'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                          <span className="text-xs opacity-70 mt-2 block">
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
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="flex gap-2 mt-4 items-center">
                <Input
                  placeholder={t('ai_chat.placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isSending || !sessionId}
                  className="flex-1"
                />
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
                    className="min-w-[140px] justify-between rounded-full"
                    aria-label={t('ai_chat.model.label')}
                    disabled={isSending || !sessionId || modelOptions.length === 0}
                  >
                    <span className="truncate">
                      {selectedModelOption
                        ? resolveModelLabel(selectedModelOption.tier, selectedModelOption.label)
                        : t('ai_chat.model.label')}
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
                <Button type="submit" size="icon" disabled={isSending || !input.trim() || !sessionId} className="shrink-0">
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Debug / Context */}
      {hasConversation && (
        <Card className="lg:col-span-3 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{t('ai_chat.debug_tools')}</CardTitle>
          <CardDescription>{t('ai_chat.debug_tools_desc')}</CardDescription>
          <Tabs value={activeSideTab} onValueChange={(v) => setActiveSideTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="debug">{t('ai_chat.debug')}</TabsTrigger>
              <TabsTrigger value="context">{t('ai_chat.context_preview')}</TabsTrigger>
            </TabsList>
            <TabsContent value="debug" />
            <TabsContent value="context" />
          </Tabs>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (activeSideTab === 'debug' ? void refreshDebug() : void refreshContext())}
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('common.refresh')}
            </Button>
            <Button variant="outline" onClick={() => void loadModels()} size="icon" aria-label={t('ai_chat.model.refresh')}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-3">
            <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground">
              {JSON.stringify(activeSideTab === 'debug' ? debugData : contextPreview, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
      )}
    </div>
  );
}



