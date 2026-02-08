import type { BoardKey, Post, PostExtra, PostType } from "./postTypes";

export type CreatePostPayload = {
  boardKey: BoardKey;
  type: PostType;
  title: string;
  content: string;
  authorName?: string;
  extra?: PostExtra;
  isPrivate?: boolean;
  password?: string | null;
};

async function parseJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiListPosts(boardKey: BoardKey, limit = 50): Promise<Post[]> {
  const res = await fetch(`/api/posts?boardKey=${encodeURIComponent(boardKey)}&limit=${encodeURIComponent(String(limit))}`, {
    method: "GET",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = data?.error || `Failed to load posts (${res.status})`;
    throw new Error(msg);
  }
  return Array.isArray(data?.posts) ? (data.posts as Post[]) : [];
}

export async function apiGetPost(id: string): Promise<Post> {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: "GET" });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = data?.error || `Failed to load post (${res.status})`;
    throw new Error(msg);
  }
  if (!data?.post) throw new Error("Post payload missing");
  return data.post as Post;
}

export async function apiCreatePost(payload: CreatePostPayload): Promise<Post> {
  const res = await fetch(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = data?.error || `Failed to create post (${res.status})`;
    throw new Error(msg);
  }
  if (!data?.post) throw new Error("Post payload missing");
  return data.post as Post;
}
