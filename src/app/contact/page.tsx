"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INQUIRY_BOARD } from "../../lib/boardConfig";
import { apiListBoardPosts, mapApiPostToPost } from "../../lib/apiClient";
import type { Post } from "../../lib/postTypes";
import { formatKoreanDate } from "../../lib/postStorage";

export default function ContactPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiListBoardPosts(INQUIRY_BOARD.key, 1, 50);
        if (ignore) return;
        setPosts(data.items.map(mapApiPostToPost));
      } catch (e: any) {
        if (ignore) return;
        setError(e?.message ?? "문의글을 불러오지 못했습니다.");
        setPosts([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const visible = useMemo(() => {
    return [...posts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">문의</h1>
          <p className="mt-1 text-sm text-white/60">운영/버그/제휴 문의를 남겨주세요.</p>
        </div>
        <Link
          href="/contact/write"
          className="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
        >
          문의 작성
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-white/70">
            <tr>
              <th className="px-4 py-3">제목</th>
              <th className="hidden px-4 py-3 md:table-cell">작성자</th>
              <th className="px-4 py-3">작성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-white/60">
                  불러오는 중…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-rose-200">
                  {error}
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-white/60">
                  아직 문의글이 없습니다.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/contact/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-white/70 md:table-cell">{p.authorName}</td>
                  <td className="px-4 py-3 text-white/70">{formatKoreanDate(p.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p className="font-medium text-white">운영 메모</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>문의글은 서버에 저장됩니다(WordPress DB).</li>
          <li>개인정보(전화번호/주소 등)는 글에 남기지 마세요.</li>
        </ul>
      </div>
    </div>
  );
}
