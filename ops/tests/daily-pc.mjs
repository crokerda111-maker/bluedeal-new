import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { kstDay, PC_SCORE_RULES, rankDailyPcs, pcPartReview } from "../../src/lib/dailyPc.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "./pcModelNames") return next("./pcModelNames.ts", context);
  return next(specifier, context);
} });
const { parseCompuzonePc, discoverCompuzonePcs, compuzonePcUrl } = await import("../../src/lib/pcCompuzone.ts");

const at = "2026-11-22T00:03:00Z";
const now = Date.parse("2026-11-22T01:00:00Z");
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
