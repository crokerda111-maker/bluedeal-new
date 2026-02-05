"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { CATEGORIES, DEALS } from "../../lib/mockDeals";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function formatAgo(min: number) {
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분 전` : `${h}시간 전`;
}

export default function HotDealsPage() {
  const sp = useSearchParams();
  const initialCat = sp.get("cat") ?? "전체";

  const [cat, setCat] = useState<string>(initialCat);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"latest" | "hot" | "priceAsc" | "priceDesc">("latest");

  useEffect(() => {
    // URL param 변경 반영
    const next = sp.get("cat") ?? "전체";
    setCat(next);
  }, [sp]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let list = DEALS.filter((d) => {
      const matchCat = cat === "전체" || d.category === cat;
      const matchQ =
        !query ||
        d.title.toLowerCase().includes(query) ||
        d.store.toLowerCase().includes(query) ||
        d.category.toLowerCase().includes(query) ||
        d.source.toLowerCase().includes(query);

      return matchCat && matchQ;
    });

    list = [...list].sort((a, b) => {
      if (sort === "latest") return a.minutesAgo - b.minutesAgo;
      if (sort === "hot") return b.heat - a.heat;
      if (sort === "priceAsc") return a.price - b.price;
      return b.price - a.price;
    });

    return list;
  }, [cat, q, sort]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">핫딜</h1>
            <p className="mt-2 text-sm text-white/70">메인에서는 제휴/외부 링크를 숨기고, 글 상세에서 안내합니다.</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
            >
              <option value="latest">최신</option>
              <option value="hot">인기(Heat)</option>
              <option value="priceAsc">가격↑</option>
              <option value="priceDesc">가격↓</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50 md:max-w-md"
            placeholder="검색: 제품명/스토어/카테고리"
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat("전체")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                cat === "전체"
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              )}
            >
              전체
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  cat === c
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
            조건에 맞는 핫딜이 없습니다.
          </div>
        ) : (
          filtered.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/55">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{d.category}</span>
                    <span>{d.store}</span>
                    <span>·</span>
                    <span>{d.shippingLabel}</span>
                    <span>·</span>
                    <span>{formatAgo(d.minutesAgo)}</span>
                    <span>·</span>
                    <span>Heat {d.heat}</span>
                  </div>

                  <Link href={`/deals/${d.id}`} className="mt-2 block text-base font-semibold text-white/90 hover:underline">
                    {d.title}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <a className="underline hover:text-white" href={d.sourceUrl} target="_blank" rel="noreferrer">
                      원문
                    </a>
                    <span className="text-white/35">·</span>
                    <Link className="underline hover:text-white" href={`/deals/${d.id}`}>
                      상세보기
                    </Link>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-2xl font-semibold">{d.priceLabel}</div>
                  <div className="mt-1 text-[12px] text-white/55">카테고리: {d.category}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
