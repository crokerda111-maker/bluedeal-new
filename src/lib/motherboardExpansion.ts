import data from "../content/products/motherboard-expansion.json";
import media from "../content/products/motherboard-media.json";
import { cpuModel } from "./pcModelNames";

export type MotherboardExpansion = {
  ids: string[];
  aliases?: string[];
  source: string;
  revision?: string;
  slots: string[][];
  sharing: string;
  tip: string;
  power?: string;
  bios?: { version: string; publishedOn: string; source: string };
  asrockAm5?: boolean;
};

export type MotherboardMedia = {
  gallery: string;
  white?: string;
  main: string;
  pcb: string;
  photoRevision?: string;
};

const profiles: MotherboardExpansion[] = data.boards;
const partKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const byCatalogId = new Map(profiles.flatMap(profile => profile.ids.map(id => [id, profile] as const)));
const byPartName = new Map(data.boards.flatMap(profile =>
  [...(profile.aliases ?? []), ...(profile.newModel ? [profile.newModel[0]] : [])]
    .map(name => [partKey(name), profile as MotherboardExpansion] as const)));

export const motherboardExpansionCheckedOn = data.checkedOn;
export const getMotherboardExpansion = (id: string) => byCatalogId.get(id);
export const getBoardPartExpansion = (name: string) => byPartName.get(partKey(name));
export const getMotherboardMedia = (id: string) => (media as Record<string, MotherboardMedia | undefined>)[id];

export const asrockRyzen9000Advisory = {
  title: "ASRock AM5 + 라이젠 9000 구매 비추천",
  summary: "ASRock AM5 보드에 장착한 라이젠 9000에서 CPU 접점의 물리적 손상 사례와 부팅 실패가 보고됐습니다. ASRock은 CPU 손상 사례를 조사했다고 밝혔고, 이후 부팅 실패를 개선하는 BIOS를 배포했습니다. 이 BIOS 공지에서 CPU 손상 재발 방지 여부는 확인할 수 없습니다.",
  advice: "라이젠 9000으로 새로 조립한다면 블루딜은 다른 제조사의 AM5 보드를 권합니다. 이미 사용 중이라면 정확한 보드 모델의 BIOS 안내와 국내 유통사 A/S 조건을 확인하세요.",
  sources: [
    { label: "ASRock CPU 손상·부팅 조사", url: "https://www.asrock.com/news/index.us.asp?iD=5612" },
    { label: "Gamers Nexus ASRock 인터뷰", url: "https://www.youtube.com/watch?v=EpEJRa_Rxo0" },
    { label: "ASRock 라이젠 9000 후속 입장", url: "https://www.asrock.com/news/index.asp?iD=5743" },
    { label: "ASRock 부팅 개선 BIOS 공지", url: "https://www.asrock.com/news/index.asp?iD=5744" },
  ],
};

export function hasAsrockRyzen9000Advisory(board: MotherboardExpansion | undefined, cpu: string | undefined) {
  return Boolean(board?.asrockAm5 && cpu && /^Ryzen 9\d{3}/.test(cpuModel(cpu) ?? ""));
}
