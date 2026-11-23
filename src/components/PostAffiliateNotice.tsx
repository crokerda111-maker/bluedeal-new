import type { PostLinkInfo } from "../lib/postTypes";

const messages = {
  linkprice: "이 포스팅은 제휴마케팅이 포함된 광고로 커미션을 지급 받습니다.",
  coupang: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  bluedeal: "이 글에는 제휴 링크가 포함되어 있습니다. 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.",
  external: "이 글에는 외부 제휴 링크가 포함되어 있습니다. 해당 링크를 통한 구매로 링크 제공자에게 수수료가 발생할 수 있습니다.",
};

export default function PostAffiliateNotice({ info, compact = false }: { info: PostLinkInfo | undefined; compact?: boolean }) {
  if (!info || (!info.disclosures.length && !info.unavailableHrefs.length)) return null;
  return <div role="note" aria-label="제휴 안내" className={compact
    ? "mt-3 space-y-1 border-l-2 border-cyan-300/60 pl-3 text-sm leading-relaxed text-slate-200"
    : "mt-4 space-y-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm leading-relaxed text-cyan-100"}>
    {info.disclosures.map(kind => <p key={kind}>{compact && kind === "bluedeal"
      ? "제휴 링크로 구매하시면 조건에 따라 블루딜이 수수료를 받아요."
      : messages[kind]}</p>)}
    {info.unavailableHrefs.length ? <p>일부 판매처 링크를 확인하지 못해 이동을 제공하지 않습니다. 링크 내용을 확인한 후 이용해 주세요.</p> : null}
  </div>;
}
