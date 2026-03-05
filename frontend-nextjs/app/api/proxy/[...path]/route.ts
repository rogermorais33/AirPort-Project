import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveBackendBaseUrl(): string {
  const envUrl =
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ??
    "http://localhost:8000";

  return envUrl.replace(/\/$/, "");
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } },
) {
  const segments = context.params.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json({ detail: "Proxy path ausente" }, { status: 400 });
  }

  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(
    `${resolveBackendBaseUrl()}/api/${segments.join("/")}`,
  );
  backendUrl.search = incomingUrl.search;

  const response = await fetch(backendUrl.toString(), {
    method: "GET",
    headers: {
      Accept: request.headers.get("accept") ?? "application/json",
    },
    cache: "no-store",
  });

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
