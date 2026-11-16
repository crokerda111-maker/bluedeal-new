import "server-only";

type UpstashResult<T> = { result?: T; error?: string };

export class KvRequestError extends Error {
  constructor(status?: number) {
    super(status ? `온라인 저장소 요청을 완료하지 못했습니다. (HTTP ${status})` : "온라인 저장소 응답을 확인하지 못했습니다.");
    this.name = "KvRequestError";
  }
}

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
    signal: init?.signal ?? AbortSignal.timeout(8000),
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
    throw new KvRequestError(res.status);
  }
  if (data === null || typeof data !== "object") throw new KvRequestError();

  return data as T;
}

export async function kvCommand<T = unknown>(command: string, ...args: Array<string | number>): Promise<T> {
  // Keep post bodies, private contact details and password hashes out of URLs.
  // Upstash REST accepts a complete Redis command as a JSON array at its root.
  const data = await kvFetchJson<UpstashResult<T>>("/", {
    method: "POST",
    body: JSON.stringify([command, ...args]),
  });

  if (data?.error || Array.isArray(data) || !Object.hasOwn(data, "result")) throw new KvRequestError();
  return data.result as T;
}

export async function kvPipeline(commands: any[][]): Promise<any[]> {
  const data = await kvFetchJson<Array<{ result?: any; error?: string }>>("/pipeline", {
    method: "POST",
    body: JSON.stringify(commands),
  });

  // Each item can have {result} or {error}
  if (!Array.isArray(data) || data.length !== commands.length) throw new KvRequestError();
  for (const item of data) {
    if (!item || typeof item !== "object" || item.error || !Object.hasOwn(item, "result")) throw new KvRequestError();
  }
  return data.map((x) => x.result);
}

export async function kvMultiExec(commands: any[][]): Promise<any[]> {
  const data = await kvFetchJson<Array<{ result?: any; error?: string }> | { error: string }>("/multi-exec", {
    method: "POST",
    body: JSON.stringify(commands),
  });

  if (!Array.isArray(data) || data.length !== commands.length) throw new KvRequestError();
  const arr = data;
  for (const item of arr) {
    if (!item || typeof item !== "object" || item.error || !Object.hasOwn(item, "result")) throw new KvRequestError();
  }
  return arr.map((x) => x.result);
}
