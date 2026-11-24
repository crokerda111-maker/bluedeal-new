import Link from "next/link";
import { PC_PARTS, PC_SCORE_RULES, isPcToday, kstDay, pcPartReview, rankDailyPcs, type PcSlot, type BuildReview, type QualityReview, type PcKind, type PcObservation } from "../lib/dailyPc";
import { readDailyPc } from "../lib/dailyPcStore";
import buildReviews from "../content/pcBuildReviews.json";
import fullPcReviews from "../content/fullPcReviews.json";
import verifiedFullPcSnapshot from "../content/fullPcVerifiedSnapshot.json";
import { matchFullPcObservation } from "../lib/fullPcReview";
import { assessMarketplaceFullPc } from "../lib/marketplacePcQuality";
import { getPartEditorial } from "../lib/productEditorial";
import FullPcConfiguration from "./FullPcConfiguration";
import ProductPhoto from "./ProductPhoto";
import { fmtWon, formatPriceTime } from "./PriceOffer";

const qualityReviews = buildReviews.parts as QualityReview[];

function Observation({ row, priceBadge, bestQuality, rank, score }: { row: PcObservation; priceBadge?: string; bestQuality?: boolean; rank?: number; score?: number }) {
  const total = row.price !== null && row.shipping !== null ? row.price + row.shipping : null;
  const configurationReview = matchFullPcObservation(row, fullPcReviews);
  const assessment = configurationReview ? assessMarketplaceFullPc(configurationReview) : undefined;
  const casePhoto = configurationReview ? getPartEditorial(configurationReview.parts.case)?.photo : undefined;
  const budgetNotes = [
    row.quantities?.ram === 1 && /\[\s*\d+GB\s*\]/i.test(row.parts.ram ?? "") ? "RAM 모듈 1개. 추가 장착 비용 확인" : null,
    /\[500GB\]|\[512GB\]/i.test(row.parts.storage ?? "") ? "SSD 500GB급 구성. 설치할 게임과 작업 파일 용량 확인" : null,
    row.excluded?.includes("ram") ? "RAM 별도 구매" : null,
    row.excluded?.includes("storage") ? "SSD·HDD 별도 구매" : null,
  ].filter(Boolean);
  return <article className="rounded-xl border border-white/15 bg-slate-950/30 p-4">
    <div className="flex flex-wrap gap-3 text-sm font-semibold text-cyan-200">
      {rank ? <span>종합 {rank}위 · {score}점</span> : null}
      {priceBadge ? <span>{priceBadge}</span> : null}
      {bestQuality ? <span>비교군 부품 평가 최고</span> : null}
      {assessment ? <span>부품 확인 {assessment.confirmed}/40점 · {assessment.checked}/40개 기준 확인</span> : null}
    </div>
    <h4 className="break-words font-semibold text-white">{row.merchantUrl ? <a className="hover:underline focus-visible:underline" href={row.merchantUrl} target="_blank" rel="noopener noreferrer">{row.title || "판매처에서 보기"} <span className="sr-only">새 창</span></a>
      : <Link className="hover:underline focus-visible:underline" href={`/products/${row.productId}`}>{row.title || "기존 상품 정보"}</Link>}</h4>
    <p className="mt-2 text-sm text-white/70">{row.seller || "컴퓨존"} · {formatPriceTime(row.checkedAt)}</p>
    {total !== null ? <p className="mt-2 text-lg font-semibold text-cyan-100">{fmtWon(total)} <span className="text-sm font-normal text-white/70">기본 배송 포함</span></p>
      : <p className="mt-2 text-sm text-amber-100">{row.note}</p>}
    {total !== null ? <p className="mt-1 text-xs leading-5 text-white/65">{row.note}</p> : null}
    {casePhoto ? <div className="mt-3">
      <p className="mb-2 text-xs text-white/75">기본 케이스 외관</p>
      <ProductPhoto photo={casePhoto} compact />
    </div> : null}
    {budgetNotes.length ? <p className="mt-2 text-xs leading-6 text-amber-100">{budgetNotes.join(" · ")}</p> : null}
    {row.state === "observed" ? <details className="mt-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-cyan-200">{configurationReview ? "부품별 점수·감점 사유 보기" : "선택 부품·사양 확인"}</summary>
      {configurationReview && assessment ? <FullPcConfiguration review={configurationReview} quality={assessment} /> : <dl className="space-y-3 border-t border-white/10 pt-3 text-sm">
        {Object.entries(PC_PARTS).map(([key, label]) => {
          const slot = key as PcSlot;
          const part = row.parts[slot];
          const rating = pcPartReview(slot, part);
          const quality = qualityReviews.find(entry => entry.slot === slot && entry.name === part);
          const name = part ?? (slot === "cpu" ? row.cpu : slot === "gpu" ? row.gpu : null);
          return <div key={slot} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
            <dt className="text-white/65">{label}</dt>
            <dd className="break-words">{name ?? (row.excluded?.includes(slot) ? "기본 구성 미포함" : "모델 확인 필요")}
              {(row.quantities?.[slot] ?? 0) > 1 ? <span className="text-white/70"> × {row.quantities?.[slot]}</span> : null}
              {!part && name && !(slot === "gpu" && row.kind === "halfpc") ? <span className="text-white/60"> · 판매명 표기</span> : null}
              {quality ? <div className="mt-2 text-xs leading-6 text-white/75">
                <p className="font-semibold text-cyan-100">부품 품질 {quality.criteria.filter(criterion => criterion.met).length}/5점</p>
                <ul className="list-disc pl-4">{quality.criteria.map(criterion => <li key={criterion.label}>{criterion.label} · {criterion.met ? "충족" : "미충족"}</li>)}</ul>
                {quality.sources.map(source => <a key={source.url} href={source.url} className="mr-3 text-cyan-200 underline" target="_blank" rel="noopener noreferrer">{source.kind === "official" ? "공식 사양" : "독립 측정"} ({source.checkedOn}) <span className="sr-only">새 창</span></a>)}
              </div> : rating ? <div className="mt-2 text-xs leading-6 text-white/75">
                <p className="font-semibold text-cyan-100">사양 {rating.score}/{rating.criteria.length}점</p>
                <ul className="list-disc pl-4">{rating.criteria.map(criterion => <li key={criterion.label}>{criterion.label} · {criterion.met ? "충족" : "미충족"}</li>)}</ul>
                <p>{rating.caveat}</p>
                <a href={rating.url} className="text-cyan-200 underline" target="_blank" rel="noopener noreferrer">공식 사양 ({rating.checkedOn}) <span className="sr-only">새 창</span></a>
              </div> : name && slot !== "cpu" && slot !== "gpu" ? <span className="text-white/60"> · 사양 평가 대기</span> : null}
            </dd>
          </div>;
        })}
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2"><dt className="text-white/65">OS·보증</dt><dd>{row.os ?? "OS 확인 필요"} · {row.warranty ?? "본체 보증 확인 필요"}</dd></div>
      </dl>}
    </details> : null}
  </article>;
}

export default async function DailyPcComparison({ kind, now }: { kind: PcKind; now: number }) {
  const day = kstDay(now);
  const { report, unavailable } = await readDailyPc(day).then(
    report => ({ report, unavailable: false }),
    () => ({ report: null, unavailable: true }),
  );
  const liveRows = report?.rows.filter(row => row.kind === kind && isPcToday(row.checkedAt, now)) ?? [];
  const snapshot = kind === "fullpc" && !liveRows.length && Date.parse(verifiedFullPcSnapshot.completedAt) <= now
    ? verifiedFullPcSnapshot : null;
  const rows = snapshot ? snapshot.rows as PcObservation[] : liveRows;
  const comparisonTime = snapshot ? Date.parse(snapshot.completedAt) : now;
  const groups = rankDailyPcs(rows, comparisonTime, snapshot ? [] : buildReviews.builds as BuildReview[], qualityReviews);
  const grouped = new Set(groups.flatMap(group => group.candidates.map(row => row.productId)));
  const pending = rows.filter(row => !grouped.has(row.productId));
  const hasRankings = groups.some(group => group.ranked.length);
  return <section id="today-pc" className="bd-surface-md scroll-mt-24 space-y-4 p-5 sm:p-6" aria-labelledby="today-pc-title">
    <h2 id="today-pc-title" className="text-xl font-semibold">{snapshot && snapshot.day !== day ? "최근 확인한" : "오늘의"} {kind === "halfpc" ? "반본체" : "완본체"} 비교</h2>
    <p className="text-sm text-white/75">{snapshot?.day ?? day} KST · 컴퓨존 조립PC 메인관의 기본 구성과 배송 포함 판매가를 비교합니다.</p>
    {snapshot ? <p className="text-sm text-white/70">판매 페이지 직접 확인 {rows.length}건 · {formatPriceTime(snapshot.completedAt)} 기준{snapshot.day !== day ? " · 현재 결제가는 판매처 확인" : ""}</p>
      : report ? <p className="text-sm text-white/70">수집 종료 {formatPriceTime(report.completedAt)} · 전체 수집 대상 {report.planned}건 중 {report.rows.length}건 확인 시도
      {report.sourceState === "stopped" ? " · 일부 판매 페이지 수집 중단" : ""}</p>
      : <p className="text-sm text-amber-100">{unavailable ? "오늘 확인한 판매 자료를 불러오지 못했습니다." : "오늘 판매처 확인 결과를 기다리고 있습니다."}</p>}
    {report && !rows.length ? <p className="text-sm text-white/70">이 분류의 당일 관측 자료가 없습니다.</p> : null}
    {groups.length > 0 && !hasRankings ? <p className="text-sm text-amber-100">종합 추천 보류. 같은 급에서 전체 부품 모델·호환·보증을 확인한 비교 대상이 더 필요합니다.</p> : null}
    {groups.map(group => {
      const priceBadge = group.candidates.length < 2 ? undefined : group.os && group.warranty ? "비교군 최저 관측가" : "같은 급에서 배송 포함 관측가가 낮음";
      const delivered = group.candidates.flatMap(row => row.price !== null && row.shipping !== null ? [row.price + row.shipping] : []);
      const priceGap = delivered.length > 1 ? Math.max(...delivered) - Math.min(...delivered) : 0;
      const rankedIndex = new Map(group.ranked.map((entry, i) => [entry.row.sourceId, { rank: i + 1, score: entry.score }]));
      const display = [...group.ranked.map(entry => entry.row), ...group.candidates.filter(row => !rankedIndex.has(row.sourceId))];
      return <div key={group.candidates[0].sourceId} className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="font-semibold">{group.label}</h3>
        <p className="text-sm text-white/65">{group.os ?? "OS 확인 필요"} · {group.warranty ?? "보증 확인 필요"} · {group.candidates.length}건
          {group.candidates[0].excluded?.filter(slot => slot !== "gpu").map(slot => ` · ${PC_PARTS[slot]} 미포함`)}</p>
        {kind === "fullpc" && priceGap > 0 ? <p className="text-sm text-white/75">배송 포함 관측가 차이 <strong className="text-cyan-100">{fmtWon(priceGap)}</strong> · RAM·SSD·보드 등 기본 구성 확인</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">{display.map(row => <Observation key={row.sourceId} row={row}
          priceBadge={row.sourceId === group.candidates[0].sourceId ? priceBadge : undefined} bestQuality={row.sourceId === group.qualityLeader}
          {...rankedIndex.get(row.sourceId)} />)}</div>
      </div>;
    })}
    {pending.length ? <details className="border-t border-white/10 pt-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-cyan-200">가격·CPU·GPU 추가 확인 {pending.length}건</summary>
      <div className="grid gap-3 lg:grid-cols-2">{pending.map(row => <Observation key={row.sourceId} row={row} />)}</div>
    </details> : null}
    <details className="border-t border-white/10 pt-3 text-sm leading-7 text-white/75">
      <summary className="min-h-11 cursor-pointer py-2 text-cyan-200">가격과 부품의 평가 기준</summary>
      <p>CPU 모델과 GPU 모델·VRAM으로 급을 정합니다. 부품 구성 점수는 상세 카드에서 사양별 충족 근거와 함께 볼 수 있습니다. OS와 본체 보증이 같고 실측 근거가 갖춰진 구성의 종합 순위에는 배송 포함 일반가 60%, 부품 평가 40%를 적용합니다.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(PC_SCORE_RULES).map(([part, rule]) => <li key={part}>{PC_PARTS[part as keyof typeof PC_PARTS]} {rule.weight}% · {rule.checks}</li>)}</ul>
      <p className="mt-2">정확한 모델이나 실측 근거가 빠지면 점수는 평가 대기입니다. 카드·쿠폰은 적용 조건을 별도 확인해야 합니다. 동일 부품을 직접 모으는 비용은 조립·OS·보증까지 맞춰 비교하세요.</p>
      <Link href="/evaluate#calculator" className="inline-flex min-h-11 items-center text-cyan-200 underline">동일 구성 직접 구매 비용 계산</Link>
    </details>
  </section>;
}
