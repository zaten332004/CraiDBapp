import Image from "next/image";
import { cookies } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  API_BASE_URL_DISPLAY,
  API_GROUPS,
  API_HEADERS_DISPLAY,
  type ApiAuthLevel,
  type HttpMethod,
} from "@/lib/api/endpoints";
import { normalizeLocale } from "@/lib/i18n/cookies";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

function authVariant(level: ApiAuthLevel) {
  switch (level) {
    case "public":
      return "outline" as const;
    case "auth":
      return "secondary" as const;
    case "admin":
      return "destructive" as const;
  }
}

function methodVariant(method: HttpMethod) {
  switch (method) {
    case "GET":
      return "outline" as const;
    case "POST":
      return "default" as const;
    case "PUT":
    case "PATCH":
      return "secondary" as const;
    case "DELETE":
      return "destructive" as const;
  }
}

export default async function ApiDocsPage() {
  const cookieStore = await cookies();
  const locale = (normalizeLocale(cookieStore.get("locale")?.value) ?? "vi") as Locale;
  const t = (key: string) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;

  const authLabel = (level: ApiAuthLevel) => {
    switch (level) {
      case "public":
        return t("api_docs.auth.public");
      case "auth":
        return t("api_docs.auth.auth");
      case "admin":
        return t("api_docs.auth.admin");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="CRAI DB" width={44} height={44} priority />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("api_docs.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("api_docs.desc")}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("api_docs.base_url_title")}</CardTitle>
              <CardDescription>{t("api_docs.base_url_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm">
              <div className="rounded-md border border-border bg-secondary px-4 py-3 text-foreground">
                {API_BASE_URL_DISPLAY}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("api_docs.headers_title")}</CardTitle>
              <CardDescription>{t("api_docs.headers_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {API_HEADERS_DISPLAY.map((line) => (
                <div
                  key={line}
                  className="rounded-md border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground"
                >
                  {line}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-10" />

        <div className="space-y-10">
          {API_GROUPS.map((group) => (
            <section key={group.name} className="scroll-mt-24">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-semibold text-foreground">{group.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {group.endpoints.length} {t("api_docs.endpoints")}
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">{t("api_docs.method")}</TableHead>
                      <TableHead>{t("api_docs.path")}</TableHead>
                      <TableHead className="w-[110px]">{t("api_docs.auth")}</TableHead>
                      <TableHead className="w-[220px]">{t("api_docs.notes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.endpoints.map((ep) => (
                      <TableRow key={`${ep.method}:${ep.path}`}>
                        <TableCell className="py-3">
                          <Badge variant={methodVariant(ep.method)}>{ep.method}</Badge>
                        </TableCell>
                        <TableCell className="py-3 font-mono text-sm">{ep.path}</TableCell>
                        <TableCell className="py-3">
                          <Badge variant={authVariant(ep.auth)}>{authLabel(ep.auth)}</Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {ep.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
