import { createHash } from "node:crypto";
import { load } from "cheerio";
import { cpuModel, gpuModel, explicitOs } from "./pcModelNames";
import type { PcKind, PcObservation, PcParts, PcSlot } from "./dailyPc";

export const PC_ORIGIN = "https://www.compuzone.co.kr";
export const PC_LIST = PC_ORIGIN + "/product/Allassembled.htm?bannerid=GNBBannerPremium";
export const compuzonePcUrl = (id: string) => PC_ORIGIN + "/product/product_detail.htm?ProductNo=" + id;
export type CompuzoneTarget = { sourceId: string; productId: string; kind: PcKind; merchantUrl: string };
const text = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 220);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const money = (value: string) => /^\d{1,3}(,\d{3})+(?:원)?$|^\d{1,8}(?:원)?$/.test(text(value))
  ? Number(value.replace(/[^0-9]/g, "")) : NaN;
const slots: Record<string, PcSlot> = {
  CPU: "cpu", 그래픽카드: "gpu", 메인보드: "board", 메모리: "ram", SSD: "storage",
  파워: "psu", 쿨러: "cooler", 케이스: "case",
};

export function discoverCompuzonePcs(html: string): CompuzoneTarget[] {
  const $ = load(html);
  const targets = new Map<string, CompuzoneTarget>();
  for (const anchor of $('a[href*="product_detail.htm"]').toArray()) {
    const name = text($(anchor).find("p.name").text());
    if (!name.startsWith("[컴퓨존]") || /DIY/i.test(name) || !/조립PC|아이웍스/i.test(name)) continue;
    const href = $(anchor).attr("href");
    if (!href || !/^\.\.?\/product_detail\.htm\?|^\.\.\/product\/product_detail\.htm\?|^\/product\/product_detail\.htm\?/.test(href)) continue;
    const url = new URL(href, PC_LIST);
    const ids = url.searchParams.getAll("ProductNo");
    if (url.origin !== PC_ORIGIN || url.pathname !== "/product/product_detail.htm" || ids.length !== 1 || !/^\d{6,8}$/.test(ids[0])) continue;
    const sourceId = ids[0];
    targets.set(sourceId, { sourceId, productId: "compuzone-pc-" + sourceId,
      kind: /반본체/.test(name) ? "halfpc" : "fullpc", merchantUrl: compuzonePcUrl(sourceId) });
  }
  const values = [...targets.values()];
  return [...values.filter(row => row.kind === "halfpc").slice(0, 15), ...values.filter(row => row.kind === "fullpc").slice(0, 20)];
}

export function parseCompuzonePc(html: string, target: CompuzoneTarget, checkedAt: string): PcObservation {
  const $ = load(html);
  const title = text($("h2.tit_p_name").text());
  const row: PcObservation = { ...target, checkedAt, title, seller: "컴퓨존", state: "option-review",
    price: null, shipping: null, cpu: null, gpu: null, parts: {}, os: null, warranty: null,
    configuration: null, detailDigest: null, note: "" };
  if (!title && html.length < 600 && /현재 판매 중인 상품이 아닙니다/.test(html)) {
    return { ...row, state: "sold-out", note: "현재 판매하지 않는 상품" };
  }
  if ($("input#ProductNo").length !== 1 || $("input#ProductNo").attr("value") !== target.sourceId ||
      !title.startsWith("[컴퓨존]") || /반본체/.test(title) !== (target.kind === "halfpc")) {
    return { ...row, note: "판매 상품 번호·구성 분류 대조 필요" };
  }
  const directText = (selector: string) => $(selector).contents().toArray().filter(node => node.type === "text").map(node => node.data).join("");
  const price = money(directText(".pd.info_price .price_real"));
  const total = money(directText("#end_price0"));
  const modalTotal = money(directText("#Ly_end_price0"));
  const shippingLabel = text(directText(".pd.delivery_price .txt"));
  const fee = shippingLabel.match(/^본체 ([\d,]+)원 \/ 부품박스 ([\d,]+)원 \(1박스\)$/);
  const shipping = fee ? money(fee[1]) : shippingLabel === "무료배송" ? 0 : NaN;
  if (!Number.isSafeInteger(price) || price < 1 || price > 100_000_000 || price !== total || price !== modalTotal ||
      $("#last_ea1").attr("value") !== "1" || $("#ly_last_ea1").attr("value") !== "1" ||
      !Number.isSafeInteger(shipping) || !/구매하기/.test($("a.optionOpen").text())) {
    return { ...row, note: "수량 1 합계 또는 기본 배송 조건 대조 필요" };
  }
  const inputs = $('input[name="upgrade_zone_default_product_list[]"]').toArray();
  const parts: PcParts = {};
  const quantities: NonNullable<PcObservation["quantities"]> = {};
  const componentList: { label: string; sku: string; name: string; quantity: number }[] = [];
  for (const input of inputs) {
    const label = $(input).attr("data-list-div-name") ?? "";
    const sku = $(input).attr("value") ?? "";
    const tr = $(input).closest("tr");
    const name = text(tr.find("td.name > a").text() || tr.find("td.name .pdtl_opt_select > span.txt").text());
    const quantityText = text(tr.find(".optionEa").text());
    const quantity = Number(quantityText);
    const status = text(tr.find(".opt_sepa").text());
    if (!/^\d{5,8}$/.test(sku) || !name || !/^\d{1,2}$/.test(quantityText) || quantity < 1 ||
        status !== "기본" || /품절|랜덤|대체품|동급 제품|변경\s*예정/.test(name)) {
      return { ...row, note: "기본 부품 목록의 모델·수량·판매 상태 대조 필요" };
    }
    const slot = slots[label];
    componentList.push({ label, sku, name, quantity });
    if (slot) {
      if (parts[slot]) return { ...row, note: "같은 분류의 부품이 여러 개 있어 기본 구성 대조 필요" };
      parts[slot] = name;
      quantities[slot] = quantity;
    } else if (/^운영체제$|^OS$/i.test(label)) {
      row.os = explicitOs(name);
    }
  }
  if (!parts.cpu || !parts.board || !parts.psu || !parts.case || !parts.cooler ||
      (target.kind === "fullpc" && (!parts.ram || !parts.storage))) {
    return { ...row, note: "기본 부품표의 필수 구성 대조 필요" };
  }
  const excluded: PcSlot[] = target.kind === "halfpc" ? (["gpu", "ram", "storage"] as const).filter(slot => !parts[slot]) : [];
  if (target.kind === "halfpc" && parts.gpu) return { ...row, note: "외장 그래픽카드 포함 범위 대조 필요" };
  row.parts = parts;
  row.quantities = quantities;
  row.excluded = excluded;
  row.cpu = cpuModel(parts.cpu);
  row.gpu = target.kind === "halfpc" ? "외장 GPU 미포함" : gpuModel(parts.gpu ?? title, target.kind);
  const warranty = $("th").filter((_, element) => text($(element).text()) === "품질보증기준").next("td").text();
  if (/\d+\s*(?:년|개월)/.test(warranty)) row.warranty = text(warranty);
  row.price = price;
  row.shipping = shipping;
  row.state = "observed";
  row.detailDigest = digest(componentList);
  row.configuration = digest([target.sourceId, title, row.detailDigest, row.os, row.warranty]);
  row.note = fee
    ? `본체 1대 기본 택배 기준. 부품 박스 배송은 1박스 ${fee[2]}원 별도. 쿠폰·카드·회원 혜택 별도.`
    : "본체 1대 기본 무료배송 표기. 지역 추가비와 쿠폰·카드·회원 혜택은 별도 확인.";
  return row;
}
