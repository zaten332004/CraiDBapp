export type ApiAuthLevel = "public" | "auth" | "admin";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEndpoint = {
  method: HttpMethod;
  path: string;
  auth: ApiAuthLevel;
  notes?: string;
};

export type ApiGroup = {
  name: string;
  endpoints: ApiEndpoint[];
};

export const API_BASE_URL_DISPLAY = "http(s)://<host>:<port>/api/v1";

export const API_HEADERS_DISPLAY = [
  "Content-Type: application/json",
  "Authorization: Bearer <access_token> (protected APIs)",
];

export const API_GROUPS: ApiGroup[] = [
  {
    name: "System / Auth",
    endpoints: [
      { method: "GET", path: "/health", auth: "public" },
      { method: "POST", path: "/auth/login", auth: "public", notes: "Returns access_token" },
    ],
  },
  {
    name: "Registration",
    endpoints: [
      { method: "POST", path: "/auth/register/signup", auth: "public" },
      { method: "GET", path: "/auth/register/verify-email?token=...", auth: "public" },
      {
        method: "GET",
        path: "/auth/register/pending?reg_type=manager|analyst",
        auth: "admin",
      },
      { method: "POST", path: "/auth/register/approve", auth: "admin" },
      { method: "POST", path: "/auth/register/reject", auth: "admin" },
      { method: "GET", path: "/auth/register/registration/{user_id}", auth: "admin" },
      { method: "GET", path: "/auth/register/list?status_filter=pending", auth: "admin" },
    ],
  },
  {
    name: "Customers",
    endpoints: [
      {
        method: "GET",
        path: "/customers?page=&limit=&search_name=&risk_level=",
        auth: "auth",
      },
      { method: "GET", path: "/customers/{customer_id}", auth: "auth" },
      { method: "POST", path: "/customers", auth: "auth" },
      { method: "PUT", path: "/customers/{customer_id}", auth: "auth" },
      { method: "GET", path: "/customers/{customer_id}/history", auth: "auth" },
      { method: "POST", path: "/customers/search", auth: "auth" },
    ],
  },
  {
    name: "Risk",
    endpoints: [
      { method: "POST", path: "/risk/score", auth: "auth" },
      { method: "GET", path: "/risk/score/{customer_id}", auth: "auth" },
      { method: "POST", path: "/risk/analyze", auth: "auth" },
      { method: "POST", path: "/risk/simulation", auth: "auth" },
      { method: "GET", path: "/risk/model/version", auth: "auth" },
      { method: "GET", path: "/risk/explain/{customer_id}", auth: "auth" },
    ],
  },
  {
    name: "Portfolio",
    endpoints: [
      { method: "GET", path: "/portfolio/kpi", auth: "auth" },
      { method: "GET", path: "/portfolio/risk-distribution", auth: "auth" },
      { method: "GET", path: "/portfolio/concentration", auth: "auth" },
      {
        method: "GET",
        path: "/portfolio/trend?metric=total_exposure|avg_pd|npl_ratio|expected_loss|var_99&interval=month",
        auth: "auth",
      },
      { method: "GET", path: "/portfolio/risk-factor-impact", auth: "auth" },
      { method: "POST", path: "/portfolio/compare", auth: "auth" },
    ],
  },
  {
    name: "Chat (internal)",
    endpoints: [
      { method: "POST", path: "/chat", auth: "auth" },
      { method: "POST", path: "/chat/query", auth: "auth" },
      { method: "GET", path: "/chat/sessions", auth: "auth" },
      { method: "GET", path: "/chat/sessions/{session_id}", auth: "auth" },
      { method: "GET", path: "/chat/suggest?customer_id=", auth: "auth" },
    ],
  },
  {
    name: "AI Chat (Gemini/Mock)",
    endpoints: [
      { method: "GET", path: "/ai-chat/models", auth: "auth" },
      { method: "POST", path: "/ai-chat/start", auth: "auth" },
      {
        method: "POST",
        path: "/ai-chat/send",
        auth: "auth",
        notes: "Returns sources (e.g. powerbi:portfolio_metrics)",
      },
      { method: "GET", path: "/ai-chat/sessions", auth: "auth" },
      { method: "GET", path: "/ai-chat/history/{session_id}?limit=", auth: "auth" },
      { method: "POST", path: "/ai-chat/close/{session_id}", auth: "auth" },
      { method: "GET", path: "/ai-chat/debug", auth: "auth" },
      { method: "GET", path: "/ai-chat/context-preview", auth: "auth" },
    ],
  },
  {
    name: "Power BI",
    endpoints: [
      { method: "POST", path: "/powerbi/configure", auth: "auth", notes: "Returns connected" },
      { method: "GET", path: "/powerbi/config", auth: "auth" },
      { method: "GET", path: "/powerbi/test-connection", auth: "auth" },
      { method: "GET", path: "/powerbi/workspaces", auth: "auth" },
      { method: "GET", path: "/powerbi/datasets", auth: "auth" },
      { method: "GET", path: "/powerbi/risk-data", auth: "auth" },
      { method: "GET", path: "/powerbi/portfolio-metrics", auth: "auth" },
      { method: "GET", path: "/powerbi/customer/{customer_id}/risk-profile", auth: "auth" },
      { method: "POST", path: "/powerbi/refresh-dataset", auth: "auth" },
      { method: "DELETE", path: "/powerbi/disconnect", auth: "auth" },
    ],
  },
  {
    name: "Alerts",
    endpoints: [
      { method: "GET", path: "/alerts?status=&type=", auth: "auth" },
      { method: "POST", path: "/alerts/subscribe", auth: "auth" },
      { method: "PUT", path: "/alerts/{alert_id}/resolve", auth: "auth" },
    ],
  },
  {
    name: "Admin",
    endpoints: [
      { method: "GET", path: "/admin/users", auth: "admin" },
      { method: "POST", path: "/admin/users", auth: "admin" },
      { method: "GET", path: "/admin/users/search?user_id=&name=&name_contains=", auth: "admin" },
      { method: "POST", path: "/admin/manager-registrations/decision", auth: "admin" },
      { method: "GET", path: "/admin/audit-logs", auth: "admin" },
      { method: "POST", path: "/admin/export", auth: "admin" },
      {
        method: "PATCH",
        path: "/admin/users/{target_user_id}/status?is_active=true|false",
        auth: "admin",
      },
    ],
  },
  {
    name: "Ingestion",
    endpoints: [
      { method: "POST", path: "/upload/data", auth: "auth", notes: "multipart file" },
      { method: "GET", path: "/jobs/{job_id}", auth: "auth" },
    ],
  },
  {
    name: "UI test (not API)",
    endpoints: [{ method: "GET", path: "/chat-ui", auth: "public", notes: "Web page" }],
  },
];
