"use client";

import { Fragment, useState, type ReactNode } from "react";

export default function FullPcSpotlights({ cards }: { cards: { key: string; card: ReactNode }[] }) {
  const [start, setStart] = useState(0);
  const visible = Array.from({ length: Math.min(3, cards.length) }, (_, index) => cards[(start + index) % cards.length]);

  function rotate() {
    const offset = 1 + Math.floor(Math.random() * (cards.length - 1));
    setStart(previous => (previous + offset) % cards.length);
  }

  return <>
    <ul aria-label="서로 다른 CPU·GPU 조합" aria-live="polite" className="grid gap-3 lg:grid-cols-3">
      {visible.map(({ key, card }) => <Fragment key={key}>{card}</Fragment>)}
    </ul>
    {cards.length > 3 ? <button type="button" onClick={rotate}
      className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-medium text-cyan-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
      다른 CPU·GPU 조합 보기
    </button> : null}
  </>;
}
