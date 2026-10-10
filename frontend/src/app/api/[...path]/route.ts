import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.BACKEND_URL || "https://outreach-engine-h5lx.onrender.com"
).replace(/\/$/, "");

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const targetPath = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/${targetPath}${search}`;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("host");

  try {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody ? await req.blob() : undefined;

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body,
      cache: "no-store",
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: `Gateway proxy failed: ${error?.message || error}` },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
