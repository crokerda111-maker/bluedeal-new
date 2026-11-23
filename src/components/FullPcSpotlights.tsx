"use client";

import { Fragment, useState, type ReactNode } from "react";

export default function FullPcSpotlights({ groups }: { groups: { tier: string; cards: ReactNode[] }[] }) {
  const [selected, setSelected] = useState(() => groups.map(() => 0));
  const canRotate = groups.some(group => group.cards.length > 1);

  function rotate() {
    const offsets = groups.map(({ cards }) => cards.length > 1 ? 1 + Math.floor(Math.random() * (cards.length - 1)) : 0);
    setSelected(previous => groups.map((group, index) => {
      const count = group.cards.length;
      return count > 1 ? (previous[index] + offsets[index]) % count : 0;
    }));
  }

  return <>
    <ul aria-label="세 급수 완본체" aria-live="polite" className="grid gap-3 lg:grid-cols-3">
      {groups.map(({ tier, cards }, index) => <Fragment key={tier}>{cards[selected[index]] ?? cards[0]}</Fragment>)}
    </ul>
    {canRotate ? <button type="button" onClick={rotate}
      className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-medium text-cyan-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
      다른 완본체 보기
    </button> : null}
  </>;
}
