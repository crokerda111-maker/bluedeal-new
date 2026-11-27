import Link from "next/link";
import { asrockRyzen9000Advisory, hasAsrockRyzen9000Advisory, motherboardExpansionCheckedOn, type MotherboardExpansion as Profile } from "../lib/motherboardExpansion";

export default function MotherboardExpansion({ profile, system = false, cpu }: { profile: Profile; system?: boolean; cpu?: string }) {
  const advisory = system ? hasAsrockRyzen9000Advisory(profile, cpu) : profile.asrockAm5;
  return <div data-motherboard-expansion className="space-y-3 text-sm leading-6">
    {system ? <p className="font-medium text-cyan-100">판매처 표기 보드의 확장 조건</p> : null}
    {advisory ? <div data-board-advisory className="space-y-2 rounded-xl border border-amber-200/30 bg-amber-200/5 p-3 text-amber-100">
      <p className="font-semibold">{asrockRyzen9000Advisory.title}</p>
      <p>{asrockRyzen9000Advisory.summary} {asrockRyzen9000Advisory.advice}</p>
      <ul className="flex flex-wrap gap-x-4">
        {asrockRyzen9000Advisory.sources.map(source => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4">{source.label}<span className="sr-only"> (새 창)</span></a>
        </li>)}
      </ul>
    </div> : null}
    <p className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-amber-100">{profile.sharing}</p>
    <p className="text-white/80">{profile.tip}</p>
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {profile.slots.map(([slot, link]) => <div key={slot} className="min-w-0 rounded-lg bg-white/5 px-3 py-2">
        <dt className="font-medium text-cyan-100">{slot}</dt>
        <dd className="break-words text-white/75">{link}</dd>
      </div>)}
    </dl>
    {profile.power ? <p className="text-white/80"><span className="font-medium text-cyan-100">전원부</span> · {profile.power}</p> : null}
    <p className="text-xs text-white/70">제조사 표기 최대 NVMe {profile.slots.length}개 · CPU·동시 장착 조건에 따라 달라집니다.{profile.revision ? " · " + profile.revision : ""}</p>
    <p className="flex flex-wrap items-center gap-x-3 text-xs text-white/70">
      <a href={profile.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4">제조사 공식 사양<span className="sr-only"> (새 창)</span></a>
      {profile.bios ? <a href={profile.bios.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4">공식 BIOS {profile.bios.version} · {profile.bios.publishedOn}<span className="sr-only"> (새 창)</span></a> : null}
      <span>{motherboardExpansionCheckedOn} KST 확인</span>
      {system ? <Link prefetch={false} href={`/products/${profile.ids[0]}#motherboard-expansion`} className="inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4">메인보드 상품 상세</Link> : null}
    </p>
  </div>;
}
