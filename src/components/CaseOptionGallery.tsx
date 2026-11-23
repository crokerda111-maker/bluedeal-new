"use client";

import { useState } from "react";
import type { ProductPhoto as Photo } from "../lib/productEditorial";
import ProductPhoto from "./ProductPhoto";

export default function CaseOptionGallery({ options }: { options: { label: string; photo: Photo }[] }) {
  const [selected, setSelected] = useState(0);
  const option = options[selected] ?? options[0];
  if (!option) return null;

  return <div className="space-y-3">
    {options.length > 1 ? <label className="block text-sm font-medium text-white/85">
      제조사 색상·옵션
      <select
        value={selected}
        onChange={event => setSelected(Number(event.target.value))}
        className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-950 px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        {options.map((value, index) => <option key={value.label} value={index}>{value.label}</option>)}
      </select>
    </label> : <p className="text-sm text-white/75">제조사 옵션 · {option.label}</p>}
    <ProductPhoto photo={option.photo} />
  </div>;
}
