import type { CatalogProduct, ProductSource } from "./productCatalog";
import { isSpecificationSource } from "./productBuyingNotes";

type Evidence = { value: string; source: ProductSource };
type Criterion = { label: string; met: boolean | null; evidence?: Evidence[] };
type Read = (keys: string[], labels?: string[]) => Evidence | undefined;

const unspecified = /확인 필요|확인 중|미확인|미공개|확인되지|변경없음|최대 지원 모델 기준/;
const supported = /^(있음|지원|탑재|yes)$/i;
const absent = /^(없음|미지원|미탑재|no|외장 그래픽카드 필요)$/i;

function specReader(product: CatalogProduct): Read {
  const sources = product.sources.filter(isSpecificationSource);
  const source = sources.find(item => /^manufacturer-(specifications|datasheet)$/.test(item.kind)) ??
    sources.find(item => item.kind === "distributor-list");
  return (keys, labels = []) => {
    const facts = (product.facts ?? []).filter(fact => keys.includes(fact.key) &&
      !unspecified.test(fact.value) && isSpecificationSource(fact.source));
    if (facts.length) return new Set(facts.map(fact => fact.value)).size === 1 ? facts[0] : undefined;
    if (!source) return;
    const values = [...new Set(product.specifications.filter(item => labels.includes(item.label) &&
      !unspecified.test(item.value)).map(item => item.value))];
    if (values.length === 1) return { value: values[0], source };
  };
}

function check(label: string, result: boolean | undefined, ...evidence: (Evidence | undefined)[]): Criterion {
  return { label, met: result ?? null, evidence: result === undefined ? undefined : evidence.filter(item => item !== undefined) };
}

function numeric(evidence: Evidence | undefined, unit?: string) {
  if (!evidence) return;
  const pattern = unit ? new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(?:${unit})?$`, "i") : /^\d+(?:\.\d+)?$/;
  const value = evidence.value.replace(/,/g, "").trim().match(pattern)?.[0];
  return value === undefined ? undefined : Number.parseFloat(value);
}

function atLeast(label: string, evidence: Evidence | undefined, min: number, unit?: string) {
  const value = numeric(evidence, unit);
  return check(label, value === undefined ? undefined : value >= min, evidence);
}

function has(label: string, evidence: Evidence | undefined, yes: RegExp, no: RegExp) {
  const value = evidence?.value.trim();
  return check(label, value && yes.test(value) ? true : value && no.test(value) ? false : undefined, evidence);
}

function capacity(read: Read, label: string, min: number) {
  const inGb = read(["capacity"], ["판매 용량(GB)", "등록 용량(GB)", "판매명 그래픽 메모리(GB)"]);
  if (inGb) return atLeast(label, inGb, min, "GB");
  const size = read([], ["제조사 표기 용량", "판매 총 용량"]);
  const parts = size?.value.match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
  return check(label, parts ? Number(parts[1]) * (parts[2].toUpperCase() === "TB" ? 1000 : 1) >= min : undefined, size);
}

function warranty(read: Read, min: number) {
  const evidence = read(["warrantyYears"], ["제조사 표기 보증 기간", "제조사 보증", "제조사 제한적 보증 표기"]);
  const years = evidence && (/^\d+$/.test(evidence.value) ? evidence.value
    : evidence.value.match(/(\d+)\s*(?:년|years?\b|yrs?\b)/i)?.[1]);
  return check(`제조사 보증 ${min}년 이상`, evidence && /평생|lifetime/i.test(evidence.value)
    ? true : years !== undefined ? Number(years) >= min : undefined, evidence);
}

function yesNo(label: string, read: Read, key: string) {
  return has(label, read([key]), supported, absent);
}

function ramSpeed(read: Read) {
  const memory = read(["memory"], ["메모리 규격", "메모리 종류"]);
  const speed = read(["speed"]);
  const latency = read(["latency"]);
  const rate = numeric(speed, "MT/s");
  const cl = numeric(latency, "CL");
  const cutoff = memory?.value === "DDR5" ? [6000, 36] : memory?.value === "DDR4" ? [3200, 18] : undefined;
  return check("규격별 속도·지연 기준 (DDR5-6000 CL36 / DDR4-3200 CL18)",
    cutoff && rate !== undefined && cl !== undefined ? rate >= cutoff[0] && cl <= cutoff[1] : undefined, memory, speed, latency);
}

function coolerCriteria(product: CatalogProduct, read: Read): Criterion[] {
  if (product.subtype === "case-fan") {
    return [
      has("PWM 속도 제어", read(["pwm"], ["속도 제어"]), /^(PWM|지원)$/i, /^(DC|미지원)$/i),
      has("유체·자기 베어링", read(["bearing"], ["베어링"]), /FDB|액체|유체|MagLev/i, /슬리브|Sleeve/i),
      atLeast("정압 1.5 mmH₂O 이상", read(["staticPressure"]), 1.5),
      warranty(read, 3),
      yesNo("동일 규격 부하 소음 실측 양호", read, "fanNoiseTest"),
    ];
  }
  if (product.subtype === "ssd-heatsink" || product.subtype === "ram-cooler") {
    return [
      yesNo("대상 부품 장착 규격 확인", read, "mountSupport"),
      yesNo("주변 부품 간섭 검증", read, "clearanceTest"),
      yesNo("고정 부품·열전달 패드 포함", read, "mountAccessories"),
      warranty(read, 2),
      yesNo("동일 부품 온도 개선 실측", read, "coolingTest"),
    ];
  }
  const liquid = product.subtype === "cpu-liquid-cooler";
  const sockets = new Set((product.facts ?? []).filter(fact => fact.key === "socket" &&
    isSpecificationSource(fact.source)).map(fact => fact.value));
  const socketList = read([], ["제조사 표기 지원 소켓", "지원 소켓", "제조사 매뉴얼 표기 지원 소켓"]);
  return [
    check("AM5 또는 LGA1851 장착 지원", sockets.has("AM5") || sockets.has("LGA1851") ? true
      : socketList ? /AM5|LGA\s?1851/.test(socketList.value) : undefined,
    (product.facts ?? []).find(fact => fact.key === "socket" && /^(AM5|LGA1851)$/.test(fact.value) && isSpecificationSource(fact.source)) ?? socketList),
    liquid ? atLeast("라디에이터 240mm 이상", read(["radiator"], ["라디에이터 규격"]), 240, "mm")
      : atLeast("히트파이프 5개 이상", read(["heatpipes"], ["히트파이프 수"]), 5, "개"),
    warranty(read, 3),
    yesNo("메모리·케이스 간섭 검증", read, "clearanceTest"),
    yesNo("온도·소음 동시 비교 실측 양호", read, "coolingTest"),
  ];
}

function getCriteria(product: CatalogProduct, read: Read): Criterion[] {
  switch (product.category) {
    case "cpu":
      return [
        atLeast("게이밍 코어 6개 이상 (인텔은 P코어)", product.brand === "Intel" ?
          read(["performanceCores"], ["P코어 수"]) : read(["cores"], ["코어 수"]), 6, "코어"),
        has("DDR5 지원", read([], ["지원 메모리"]), /DDR5/, /^DDR4(?:[-\s/\dMTs]+)?$/i),
        has("화면 출력용 내장그래픽", read(["graphics"], ["내장그래픽"]), /^(present|AMD Radeon|Intel(?:®)? (?:UHD|Graphics|Arc))|^있음/, /^(absent|없음|외장 그래픽카드 필요)$/),
        yesNo("복수 게임 CPU 독립 벤치 상위권", read, "gamingBenchmark"),
        warranty(read, 3),
      ];
    case "gpu":
      return [
        capacity(read, "그래픽 메모리 12GB 이상", 12),
        yesNo("QHD 다중 게임 평균 60fps 이상 실측", read, "gpuQhdBenchmark"),
        yesNo("동일 카드 부하 소음 35dBA 이하 실측", read, "gpuNoiseTest"),
        yesNo("동일 카드 온도·전력 실측 양호", read, "gpuThermals"),
        warranty(read, 3),
      ];
    case "motherboard":
      return [
        atLeast("메모리 슬롯 4개 이상", read(["memorySlots"], ["메모리 슬롯"]), 4, "개|슬롯"),
        atLeast("NVMe 슬롯 3개 이상", read(["nvmeSlots"]), 3),
        atLeast("2.5GbE 이상 유선랜", read(["ethernetGbps"], ["유선 네트워크"]), 2.5, "GbE|Gbps"),
        yesNo("GPU 대역폭 유지하며 NVMe 2개 이상", read, "laneSharingTest"),
        yesNo("장시간 CPU 부하에서 전원부 85°C 이하 실측", read, "vrmThermalTest"),
      ];
    case "ram":
      return [
        capacity(read, "키트 총용량 32GB 이상", 32),
        atLeast("매칭 모듈 2개 이상", read(["modules"], ["모듈 수"]), 2, "개"),
        ramSpeed(read),
        yesNo("출고 IC와 다이 리비전 고정 확인", read, "fixedMemoryDie"),
        warranty(read, 5),
      ];
    case "ssd": {
      const bus = read(["storageBus"], ["인터페이스", "제조사 표기 연결 규격"]);
      const readSpeed = read(["sequentialRead"], ["제조사 표기 순차 읽기"]);
      const sata = bus && /^SATA/i.test(bus.value);
      const usb = bus && /^USB/i.test(bus.value);
      const nvme = bus && /PCIe|NVMe/i.test(bus.value);
      return [
        capacity(read, "SSD 용량 1TB 이상", 1000),
        has("TLC 낸드 확인", read(["nand"], ["낸드"]), /\bTLC\b/i, /\bQLC\b/i),
        has("전용 DRAM 탑재", read(["dram"], ["전용 DRAM"]), /^(present|있음|탑재)$/i, /^(absent|없음|미탑재)$/i),
        sata || usb || nvme ? atLeast(sata ? "SATA 순차 읽기 500MB/s 이상" : usb ? "외장 순차 읽기 1,000MB/s 이상"
          : "NVMe 순차 읽기 5,000MB/s 이상", readSpeed, sata ? 500 : usb ? 1000 : 5000, "MB/s")
          : check("연결 규격에 맞는 순차 읽기 성능", undefined),
        warranty(read, 5),
      ];
    }
    case "hdd":
      return [
        capacity(read, "저장 용량 4TB 이상", 4000),
        has("CMR 기록 방식", read(["recording"], ["기록 방식"]), /^CMR$/, /^SMR$/),
        atLeast("내부 전송 속도 180MB/s 이상", read(["transferSpeed"], ["제조사 내부 전송 속도 최대"]), 180, "MB/s"),
        atLeast("캐시 256MB 이상", read(["cacheMB"], ["캐시"]), 256, "MB"),
        warranty(read, 3),
      ];
    case "psu":
      return [
        atLeast("ATX 3.0 이상 설계", read(["atx"]), 3),
        has("Gold 이상 효율 인증", read(["efficiency"], ["효율 인증"]), /gold|platinum|titanium|골드|플래티넘|티타늄/i, /bronze|silver|standard|white|실버|브론즈|스탠다드|화이트/i),
        has("풀모듈러 케이블", read(["modular"], ["케이블 방식"]), /^풀모듈러$|^full(?:y)? modular$/i, /고정|세미|fixed|semi/i),
        yesNo("부하 소음 35dBA 이하 실측 또는 LAMBDA A− 이상", read, "psuNoiseTest"),
        warranty(read, 7),
      ];
    case "case": {
      const small = read(["caseType"], ["케이스 종류"])?.value.match(/미니ITX|SFF/i);
      return [
        atLeast("기본 제공 팬 2개 이상", read(["includedFans"], ["기본 팬 수"]), 2, "개"),
        yesNo("메시 등 제약이 적은 흡기", read, "meshIntake"),
        atLeast(`GPU 장착 길이 ${small ? 300 : 350}mm 이상`, read(["gpuLength"], ["제조사 표기 최대 GPU 길이"]), small ? 300 : 350, "mm"),
        atLeast(`CPU 공랭 높이 ${small ? 67 : 160}mm 이상`, read(["coolerHeight"], ["최대 CPU 쿨러 높이"]), small ? 67 : 160, "mm"),
        yesNo("동일 기본 팬 구성에서 냉각·소음 실측 양호", read, "caseThermals"),
      ];
    }
    case "cooler": return coolerCriteria(product, read);
    default: return [];
  }
}

export function assessComponentQuality(product: CatalogProduct) {
  const criteria = getCriteria(product, specReader(product));
  if (!criteria.length) return;
  const points = criteria.filter(item => item.met === true).length;
  const checked = criteria.filter(item => item.met !== null).length;
  const exact = product.kind !== "product-family" && product.kind !== "listed-wattage-option";
  return { criteria, exact, points, checked, max: points + criteria.length - checked,
    score: exact && checked === criteria.length ? points : null };
}
