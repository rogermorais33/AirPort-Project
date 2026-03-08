import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveBackendBaseUrl(): string {
  const envUrl =
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ??
    "http://localhost:8000";

  return envUrl.replace(/\/$/, "");
}

async function proxyRequest(
  request: Request,
  context: { params: { path: string[] } },
  method: string,
) {
  const segments = context.params.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json({ detail: "Proxy path ausente" }, { status: 400 });
  }

  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(`${resolveBackendBaseUrl()}/api/${segments.join("/")}`);
  backendUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (!["GET", "HEAD"].includes(method)) {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(backendUrl.toString(), init);

  const outputHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "content-length") {
      continue;
    }
    outputHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers: outputHeaders,
  });
}

export async function GET(request: Request, context: { params: { path: string[] } }) {
  return proxyRequest(request, context, "GET");
}

export async function POST(request: Request, context: { params: { path: string[] } }) {
  return proxyRequest(request, context, "POST");
}

export async function PUT(request: Request, context: { params: { path: string[] } }) {
  return proxyRequest(request, context, "PUT");
}

export async function PATCH(request: Request, context: { params: { path: string[] } }) {
  return proxyRequest(request, context, "PATCH");
}

export async function DELETE(request: Request, context: { params: { path: string[] } }) {
  return proxyRequest(request, context, "DELETE");
}
