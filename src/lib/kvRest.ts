import "server-only";

type UpstashResult<T> = { result?: T; error?: string };

export class KvNotConfiguredError extends Error {
  public readonly code = "KV_NOT_CONFIGURED" as const;

  constructor() {
    super("KV(온라인 저장소) 설정이 필요합니다.");
    this.name = "KvNotConfiguredError";
  }
}

function getKvConfig(): { url: string; token: string } {
  // Support both Vercel KV env names and raw Upstash Redis REST env names.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new KvNotConfiguredError();
  }

  return { url: url.replace(/\/$/, ""), token };
}

function encodeSegment(v: string | number): string {
  return encodeURIComponent(String(v));
}

async function kvFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, token } = getKvConfig();

  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Avoid caching; this is a DB call.
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Some failures may not return JSON.
    data = null;
  }

  // Upstash REST returns {result} or {error}
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `KV request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export async function kvCommand<T = unknown>(command: string, ...args: Array<string | number>): Promise<T> {
  const path = `/${encodeSegment(command)}${args.length ? "/" + args.map(encodeSegment).join("/") : ""}`;
  const data = await kvFetchJson<UpstashResult<T>>(path);

  if (data?.error) throw new Error(data.error);
  return data.result as T;
}

export async function kvPipeline(commands: any[][]): Promise<any[]> {
  const data = await kvFetchJson<Array<{ result?: any; error?: string }>>("/pipeline", {
    method: "POST",
    body: JSON.stringify(commands),
  });

  // Each item can have {result} or {error}
  for (const item of data) {
    if (item?.error) throw new Error(item.error);
  }
  return data.map((x) => x.result);
}

export async function kvMultiExec(commands: any[][]): Promise<any[]> {
  const data = await kvFetchJson<Array<{ result?: any; error?: string }> | { error: string }>("/multi-exec", {
    method: "POST",
    body: JSON.stringify(commands),
  });

  if ((data as any)?.error) {
    throw new Error((data as any).error);
  }

  const arr = data as Array<{ result?: any; error?: string }>;
  for (const item of arr) {
    if (item?.error) throw new Error(item.error);
  }
  return arr.map((x) => x.result);
}
