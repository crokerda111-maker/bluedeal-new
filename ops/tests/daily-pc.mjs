import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { kstDay, PC_PARTS, PC_SCORE_RULES, rankDailyPcs, pcPartReview } from "../../src/lib/dailyPc.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "./pcModelNames" || specifier === "./dailyPc") return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { parseCompuzonePc, discoverCompuzonePcs, compuzonePcUrl } = await import("../../src/lib/pcCompuzone.ts");
const { matchFullPcObservation, scoreFullPcParts, separatePcTotal } = await import("../../src/lib/fullPcReview.ts");
const { fullPcBestCpu, fullPcGpuChip, fullPcTier, fullPcComparisonKey, fullPcPricePoints, rankComparableFullPcs } = await import("../../src/lib/fullPcTiers.ts");
const { default: fullPcReviews } = await import("../../src/content/fullPcReviews.json", { with: { type: "json" } });
const { default: fullPcSnapshot } = await import("../../src/content/fullPcVerifiedSnapshot.json", { with: { type: "json" } });

const at = "2026-11-22T00:03:00Z";
const now = Date.parse("2026-11-22T01:00:00Z");

test("급수 분류는 RTX·RX 모델을 식별하고 복수 선택형 제목은 사용하지 않는다", () => {
  assert.equal(fullPcTier(fullPcGpuChip("서린 V100 7500F/5060/32G", true)), "entry");
  assert.equal(fullPcTier(fullPcGpuChip("AMD 9800X3D_RX9070_GRE 12GB")), "balanced");
  assert.equal(fullPcTier(fullPcGpuChip("GeForce RTX 5080 D7 16GB")), "high");
  assert.equal(fullPcTier(fullPcGpuChip("내장 그래픽 사용")), "office");
  assert.equal(fullPcTier(fullPcGpuChip("RTX 5060 / RTX 5080 선택")), "unknown");
});

test("메인 베스트는 인텔 14세대를 제외하고 실속형 우선 CPU를 식별한다", () => {
  for (const cpu of ["Intel Core i5-14600KF", "14400", "인텔 코어 i7-14700K", "Intel i9-14900KS"]) {
    assert.deepEqual(fullPcBestCpu(cpu, "게이밍 완본체"), { excluded: true, preferred: false });
  }
  assert.equal(fullPcBestCpu(undefined, "컴집 i5-14400F RTX 5060 Ti").excluded, true);
  for (const cpu of ["AMD Ryzen 5 9600X", "AMD 라이젠 5 7500F", "Core Ultra 5 250K Plus", "인텔 울트라5 250KF Plus"]) {
    assert.deepEqual(fullPcBestCpu(cpu, "게이밍 완본체"), { excluded: false, preferred: true });
  }
  for (const cpu of ["AMD Ryzen 7 9800X3D", "Intel Core i5-13400F"]) {
    assert.deepEqual(fullPcBestCpu(cpu, "게이밍 완본체"), { excluded: false, preferred: false });
  }
});

test("같은 CPU·GPU·VRAM·OS 안에서 배송 포함 가격 변동을 순위에 반영한다", () => {
  assert.equal(fullPcComparisonKey("AMD Ryzen 7 9800X3D", "ASUS PRIME RX 9070 XT 16GB", "Free DOS"),
    fullPcComparisonKey("AMD Ryzen 9800X3D", "SAPPHIRE RX9070XT OC 16GB", "Windows 미포함"));
  assert.notEqual(fullPcComparisonKey("AMD Ryzen 9800X3D", "RX 9070 XT 16GB", "Windows 11 Home DSP"),
    fullPcComparisonKey("AMD Ryzen 9800X3D", "RX 9070 XT 16GB", "Windows 미포함"));
  assert.equal(fullPcComparisonKey("AMD Ryzen 9800X3D", "RX 9070 XT", "Windows 미포함"), null);
  const a = { id: "better-parts", score: 90, total: 2000000 };
  const b = { id: "cheaper", score: 85, total: 1960000 };
  assert.equal(rankComparableFullPcs([a, b])[0].candidate.id, a.id);
  assert.equal(rankComparableFullPcs([a, { ...b, total: 1500000 }])[0].candidate.id, b.id);
  assert.equal(rankComparableFullPcs([b]).length, 0);
  assert.equal(fullPcPricePoints(1960000, 1960000), 40);
  assert.equal(fullPcPricePoints(2000000, 1960000), 39.2);
  assert.equal(rankComparableFullPcs([a, b], 1600000)[0].points, 86);
});

test("개별 견적은 8종 동일 모델·수량과 당일 배송비, 조립 및 동일 구매조건이 있어야 계산한다", () => {
  const review = structuredClone(fullPcReviews.find(row => row.productId === "reviewed-fullpc-11st-9423305936"));
  const source = "https://store.example/price";
  const parts = Object.fromEntries(Object.keys(PC_PARTS).map(slot => [slot, {
    model: review.parts[slot], quantity: review.quantities?.[slot] ?? 1,
    price: 100_000, shipping: 3_000, checkedAt: at, source,
  }]));
  const assembly = { ...review.purchaseTerms, price: 40_000, shipping: 6_000, checkedAt: at, source };
  review.costComparison = { parts, assembly };
  assert.equal(separatePcTotal(review, now), 970_000);
  assert.equal(separatePcTotal(review, now + 86_400_000), null);
  assert.equal(separatePcTotal({ ...review, costComparison: { parts, assembly: { ...assembly, warranty: "조립 보증 없음" } } }, now), null);
  assert.equal(separatePcTotal({ ...review, costComparison: { parts, assembly: { ...assembly, os: "Windows 11 Home" } } }, now), null);
  parts.ram.quantity = 1;
  assert.equal(separatePcTotal(review, now), null);
  parts.ram.quantity = 2;
  parts.ram.model = "다른 브랜드의 DDR5-5600";
  assert.equal(separatePcTotal(review, now), null);
  parts.ram.model = review.parts.ram;
  parts.ram.shipping = null;
  assert.equal(separatePcTotal(review, now), null);
  delete parts.ram;
  assert.equal(separatePcTotal(review, now), null);
});
const target = { sourceId: "1234567", productId: "pc-a", kind: "fullpc", merchantUrl: compuzonePcUrl("1234567") };
const title = "[컴퓨존] 추천 조립PC";
function parts(label, name, id) {
  return `<tr><td><input name="upgrade_zone_default_product_list[]" data-list-div-name="${label}" value="${id}"></td>
  <td class="name"><a>${name}</a></td><td class="optionEa">1</td><td class="opt_sepa">기본</td></tr>`;
}
function listing(cooler = "3RSYS RC1900 ARGB 솔더링 블랙", price = 1050000) {
  return `<h2 class="tit_p_name">${title}</h2><input id="ProductNo" value="1234567">
  <div class="pd info_price"><div class="price_real"><div style="display:none">999000</div>${price}</div></div>
  <div class="pd delivery_price"><p class="txt">본체 5,000원 / 부품박스 2,500원 (1박스)</p></div>
  <input id="last_ea1" value="1"><input id="ly_last_ea1" value="1"><font id="end_price0">${price}</font>
  <span id="Ly_end_price0">${price}</span><a class="optionOpen">구매하기</a>
  <table>${parts("CPU", "AMD Ryzen 9800X3D", "1230001")}${parts("그래픽카드", "RTX 5060 Ti 예시 16GB", "1230002")}
  ${parts("메인보드", "B850 예시", "1230003")}${parts("메모리", "32GB", "1230004")}${parts("SSD", "1TB", "1230005")}
  ${parts("파워", "750W", "1230006")}${parts("쿨러", cooler, "1230007")}${parts("케이스", "예시 케이스", "1230008")}</table>`;
}

test("가격 변경은 가격만 갱신하고, 같은 URL의 부품 교체는 이전 평가를 무효화한다", () => {
  const original = parseCompuzonePc(listing(), target, at);
  assert.equal(original.gpu, "RTX 5060 TI 16GB");
  assert.equal(original.price, 1050000);
  assert.equal(parseCompuzonePc(listing().replace("본체 5,000원 / 부품박스 2,500원 (1박스)", "무료배송"), target, at).shipping, 0);
  assert.equal(pcPartReview("cooler", original.parts.cooler)?.score, 5);
  assert.equal(parseCompuzonePc(listing(undefined, 999000), target, at).configuration, original.configuration);
  const changed = parseCompuzonePc(listing("다른 쿨러"), target, at);
  assert.notEqual(changed.configuration, original.configuration);
  assert.equal(pcPartReview("cooler", changed.parts.cooler), null);
});

test("완본체 점수는 근거가 모두 있는 경우에 표시되며 현재 확인한 부품 목록과 일치해야 한다", () => {
  const row = fullPcSnapshot.rows.find(item => item.sourceId === "1388408");
  const review = matchFullPcObservation(row, fullPcReviews);
  assert.ok(review);
  assert.equal(scoreFullPcParts(review).score, 61);
  assert.equal(matchFullPcObservation({ ...row, price: row.price - 1000 }, fullPcReviews), review);
  assert.equal(matchFullPcObservation({ ...row, detailDigest: "다른 부품표" }, fullPcReviews), undefined);
  assert.equal(matchFullPcObservation({ ...row, state: "sold-out" }, fullPcReviews), undefined);
  const pending = { ...review, tested: { ...review.tested, psu: { ...review.tested.psu, results: [true, true, null] } } };
  assert.equal(scoreFullPcParts(pending).score, null);
  assert.deepEqual(scoreFullPcParts(pending).range, [61, 69]);
});

test("확인한 완본체마다 구성 평가가 연결되고 내장그래픽은 사무용 기준을 쓴다", () => {
  const passing = fullPcSnapshot.rows.map(row => matchFullPcObservation(row, fullPcReviews));
  assert.equal(passing.length, 16);
  assert.ok(passing.every(review => review && Object.values(review.parts).every(Boolean)));
  const office = passing.find(review => review.integratedOffice);
  assert.ok(office);
  const ram = scoreFullPcParts(office).slots.find(slot => slot.slot === "ram");
  assert.equal(ram.earned, 15);
  assert.equal(ram.criteria[0].label, "총 16GB 이상");
  const twoModuleKit = passing.find(review => review.productId === "compuzone-pc-1389996");
  assert.equal(scoreFullPcParts(twoModuleKit).slots.find(slot => slot.slot === "ram").earned, 15);
});

test("판매 종료, 가격 불일치와 다른 판매 상품은 순위에 들어가지 않는다", () => {
  const soldOut = parseCompuzonePc("<script>alert('현재 판매 중인 상품이 아닙니다.')</script>", target, at);
  assert.equal(soldOut.state, "sold-out");
  assert.equal(soldOut.price, null);
  assert.equal(parseCompuzonePc(listing().replace("1050000", "1049000"), target, at).price, null);
  assert.equal(parseCompuzonePc(listing(), { ...target, sourceId: "1234568" }, at).price, null);
  const anchor = '<a href="../product/product_detail.htm?ProductNo=1234567"><p class="name">[컴퓨존] 반본체 조립PC</p></a>';
  assert.equal(discoverCompuzonePcs(anchor + anchor).length, 1);
  assert.equal(discoverCompuzonePcs(anchor)[0].kind, "halfpc");
});

test("한국 자정과 VRAM·OS 차이가 랭킹을 분리하고, 근거를 갖춘 구성을 가격과 품질로 정렬한다", () => {
  const original = parseCompuzonePc(listing(), target, at);
  assert.equal(kstDay("2026-11-21T15:00:00Z"), "2026-11-22");
  const parts = Object.fromEntries(Object.keys(PC_SCORE_RULES).map(slot => [slot, slot + " exact"]));
  const a = { ...original, parts, os: "OS 미포함", warranty: "동일 보증 1년", detailDigest: "one" };
  const b = { ...a, sourceId: "2", configuration: "two", detailDigest: "two", price: 1150000 };
  const old = { ...a, sourceId: "3", checkedAt: "2026-11-21T14:59:59Z", price: 10000 };
  const different = { ...a, sourceId: "4", gpu: "RTX 5060 TI 8GB" };
  const windows = { ...a, sourceId: "5", os: "Windows 11 Home DSP" };
  const refs = [a, b].map(row => ({ configuration: row.configuration, detailDigest: row.detailDigest, slots: parts, compatible: true, issuesCleared: true }));
  const ratings = Object.entries(parts).map(([slot, name]) => ({ slot, name,
    criteria: Array.from({ length: 5 }, (_, i) => ({ label: String(i), met: true })),
    sources: [{ url: "https://example.test/lab", kind: "independent", checkedOn: "2026-11-22" }] }));
  const rows = [a, b, old, different, windows];
  assert.equal(rankDailyPcs(rows, now, refs)[0].ranked.length, 0);
  const group = rankDailyPcs(rows, now, refs, ratings).find(g => g.candidates.length === 2);
  assert.deepEqual(group?.ranked.map(item => item.row.sourceId), [a.sourceId, b.sourceId]);
  assert.deepEqual(group?.ranked.map(item => item.score), [100, 95]);
  assert.equal(rankDailyPcs([a, { ...b, detailDigest: "changed" }], now, refs, ratings)[0].ranked.length, 0);
});
