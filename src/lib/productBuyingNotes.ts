import type { CatalogProduct, ProductSource } from "./productCatalog";
import { productFacetValues } from "./productFilters";

type BuyingNotes = {
  advantage: string;
  caution: string;
  sources: ProductSource[];
  issue?: { text: string; source: string };
};

const specificationSourceKinds = new Set([
  "manufacturer-specifications", "manufacturer-datasheet", "distributor-list",
  "retailer-listing", "independent-review",
]);

function isSpecificationSource(source: ProductSource) {
  if (!specificationSourceKinds.has(source.kind)) return false;
  try {
    const url = new URL(source.url);
    const observedAt = Date.parse(source.observedAt ?? "");
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && Number.isFinite(observedAt) && observedAt <= Date.now();
  } catch {
    return false;
  }
}

export function getProductBuyingNotes(product: CatalogProduct): BuyingNotes | undefined {
  const facts = (product.facts ?? []).filter(fact => isSpecificationSource(fact.source));
  const sourceList = [...product.sources, ...facts.map(fact => fact.source)].filter(isSpecificationSource);
  const sources = [...new Map(sourceList.map(source => [source.url, source])).values()];
  if (!sources.length) return;

  const values = productFacetValues({ ...product, facts });
  const single = (key: string) => values[key]?.length === 1 ? values[key][0] : undefined;
  const spec = (...labels: string[]) => product.specifications.find(item =>
    labels.includes(item.label) && !/추가 확인|확인 필요|미확인/.test(item.value))?.value;
  const notes = (advantage: string, caution: string, issue?: BuyingNotes["issue"]) => ({
    advantage, caution, sources, issue,
  });

  switch (product.category) {
    case "cpu": {
      const socket = single("socket") ?? spec("소켓", "CPU 소켓");
      const memory = spec("지원 메모리");
      if (!socket || !memory) return;
      const maxMemorySpeed = spec("제조사 표기 기본 메모리 속도 상한");
      const graphics = spec("내장그래픽");
      const advantage = `${socket} 보드와 ${memory} 메모리를 지원합니다.${maxMemorySpeed ? ` 제조사 기본 메모리 속도 기준은 ${maxMemorySpeed}입니다.` : ""}`;
      const checkMemory = memory.includes("DDR4") && memory.includes("DDR5")
        ? "메인보드에 맞춰 DDR4 또는 DDR5 중 하나를 선택하세요."
        : "메인보드와 메모리 키트에 맞는 규격·속도를 확인하세요.";
      return notes(advantage, `${checkMemory} 해당 메인보드의 CPU 지원 목록과 최소 BIOS 버전도 확인하세요.${graphics === "외장 그래픽카드 필요" ? " 화면을 연결하려면 외장 그래픽카드가 필요합니다." : ""}`);
    }
    case "motherboard": {
      const socket = single("socket");
      const memory = single("memory");
      const size = single("formFactor");
      const slots = spec("메모리 슬롯");
      if (!socket || !memory || !size || !slots) return;
      const wifi = spec("무선랜");
      const advantage = wifi
        ? `${wifi} 무선랜을 쓸 수 있어 랜선을 연결하기 어려운 자리에 두기 편합니다. ${memory} 슬롯은 ${slots}입니다.`
        : `${socket} CPU와 ${memory}를 쓰는 ${size} 보드입니다. 메모리 슬롯이 ${slots}이므로 현재 구성과 추후 증설 계획을 함께 비교할 수 있습니다.`;
      return notes(advantage, `케이스가 ${size}를 지원하는지 확인하세요. CPU 지원 목록에서 해당 CPU의 최소 BIOS 버전을 확인하고, 메모리 증설 전에는 슬롯 수와 지원 키트도 확인하세요.`);
    }
    case "ram": {
      const memory = single("memory");
      const capacity = single("capacity");
      const modules = single("modules");
      const speed = single("speed");
      if (!memory || !capacity) return;
      const distribution = modules === "2"
        ? " 두 슬롯이 있는 듀얼 채널 보드에서는 설명서에 지정된 슬롯에 한 개씩 꽂아 두 채널로 구성할 수 있습니다."
        : modules === "1" ? " 슬롯 하나에 장착하는 구성이어서 사용 가능한 슬롯 한 개로 해당 용량을 확보할 수 있습니다." : "";
      return notes(
        `${memory} 총 ${capacity}GB${modules ? `(${modules}개 구성)` : ""}입니다.${distribution}`,
        `메인보드의 ${memory} 지원과 슬롯 수를 확인하세요. ${speed ? `표기된 ${speed} MT/s` : "표기 속도"}는 CPU·보드와 장착 수에 따라 달라집니다. XMP·EXPO가 있다면 적용 조건과 판매 품번을 확인하세요.`,
      );
    }
    case "gpu": {
      const chip = single("chip");
      const capacity = single("capacity");
      if (!chip) return;
      const advantage = capacity
        ? `${chip}에 그래픽 메모리 ${capacity}GB가 확인됩니다. 사용할 게임의 텍스처 설정이나 작업 프로그램의 VRAM 요구량과 대조할 수 있습니다.`
        : `${chip} 칩을 쓰는 제품입니다. 판매 옵션의 용량을 확인한 뒤 게임·작업 프로그램의 VRAM 요구량과 대조하세요.`;
      const caution = "케이스의 그래픽카드 장착 길이와 슬롯 간격, 모니터 단자, 파워의 보조전원 커넥터가 판매 옵션의 실물 사양과 맞는지 확인하세요.";
      if (chip === "RTX 5060" || chip === "RTX 5060 Ti") {
        return notes(advantage, caution, {
          text: "일부 구형 메인보드에서 재부팅 시 화면이 나오지 않는 사례를 NVIDIA가 공지했습니다. RTX 5060·5060 Ti 사용 중 같은 증상이 있을 때 공식 도구로 UEFI 펌웨어 업데이트가 필요한지 확인하세요.",
          source: "https://nvidia.custhelp.com/app/answers/detail/a_id/5665",
        });
      }
      return notes(advantage, caution);
    }
    case "ssd": {
      const capacity = single("capacity");
      const connections = values.interface ?? [];
      const pcie = connections.filter(value => value.startsWith("PCIe "));
      const sata = connections.includes("SATA");
      const nvme = connections.includes("NVMe") || pcie.length > 0;
      const usb = connections.some(value => value.startsWith("USB"));
      const form = single("formFactor");
      if (!capacity || Number(sata) + Number(nvme) + Number(usb) !== 1) return;
      const size = Number(capacity) >= 1000 ? `${Number(capacity) / 1000}TB` : `${capacity}GB`;
      if (usb) return notes(`${size} USB 외장 SSD입니다. PC 내부 장착 슬롯을 쓰지 않고 파일을 옮길 수 있습니다.`, "기기에 맞는 케이블·단자와 호스트의 USB 전송 규격을 확인하세요. 단자 모양이 같아도 전송 규격은 다를 수 있습니다.");
      if (sata) return notes(`${size} SATA SSD입니다. 기존 SATA 저장장치를 교체할 때 사용할 수 있습니다.`, "SATA 연결을 지원하는지와 실제 장착 규격을 확인하세요. 2.5인치 SATA와 M.2 SATA는 연결 방법이 다릅니다.");
      const bus = pcie.length === 1 ? pcie[0] : "PCIe";
      const mount = form?.startsWith("M.2") ? form : "M.2";
      return notes(`${size} ${bus} NVMe SSD입니다. ${mount} 슬롯에 직접 장착하는 제품은 별도 SATA 데이터 케이블이 필요하지 않습니다.`, `보드 슬롯의 NVMe 지원, ${mount} 장착 길이, PCIe 세대와 방열판 간섭을 확인하세요. 슬롯에 따라 다른 포트와 대역폭을 공유할 수 있습니다.`);
    }
    case "hdd": {
      const size = spec("제조사 표기 용량");
      if (!size || single("recording") !== "CMR" || !spec("인터페이스")?.startsWith("SATA")) return;
      return notes(`${size} CMR 방식의 SATA 하드디스크로 사진·영상이나 자료를 모아 두는 데 활용할 수 있습니다.`, "3.5인치 베이, SATA 데이터·전원 연결, 정확한 품번을 확인하세요. 중요한 파일은 다른 저장장치에도 복사해 두세요.");
    }
    case "psu": {
      const watts = single("wattage");
      const form = single("formFactor");
      const modular = single("modular");
      const standard = single("atx");
      const efficiency = single("efficiency");
      if (!watts) return;
      const rating = efficiency ? ` 효율은 ${efficiency} 등급 표기가 있습니다.` : "";
      const advantage = modular === "풀모듈러"
        ? `${watts}W 풀모듈러 모델은 필요한 케이블만 연결할 수 있어 케이블 정리에 유리합니다.${rating}`
        : `${watts}W${form ? ` ${form}` : ""}${standard ? ` · ATX ${standard}` : ""} 표기를 확인했습니다.${rating} GPU 제조사의 권장 전원과 비교할 수 있습니다.`;
      return notes(advantage, `케이스의 파워 장착 규격과 길이, CPU·GPU용 커넥터 종류와 개수를 확인하세요.${modular !== "고정 케이블" ? " 탈착 케이블은 모델별 호환표에 따라 사용하세요." : ""}`);
    }
    case "cooler": {
      if (product.subtype === "cpu-air-cooler") {
        const height = single("height");
        const heatsink = single("heatsinkHeight") ?? spec("방열판 높이");
        const sockets = values.socket ?? [];
        const dimension = spec("팬 포함 치수", "방열판 치수");
        if (!height && !heatsink && !dimension && !sockets.length) return;
        const socketsText = sockets.length ? ` 지원 소켓 표기에는 ${sockets.join("·")}가 포함됩니다.` : "";
        const heightText = height ? `공랭 장착 높이는 ${height} mm입니다.`
          : heatsink ? `방열판 높이가 ${/mm/i.test(heatsink) ? heatsink : `${heatsink} mm`}로 공개돼 케이스와 대조할 수 있습니다.`
          : dimension ? `제조사 치수 ${dimension}를 기준으로 장착 공간을 비교할 수 있습니다.` : "";
        return notes(`${heightText}${socketsText}`.trim(), "메인보드 소켓용 브래킷이 해당 판매 구성에 포함되는지 확인하세요. 팬을 들어 올려 RAM 공간을 확보해야 하면 설치 높이도 늘어날 수 있습니다.");
      }
      if (product.subtype === "cpu-liquid-cooler") {
        const radiator = single("radiator");
        if (!radiator) return;
        const actual = spec("실제 라디에이터 치수 (길이 × 너비 × 두께)");
        return notes(`${radiator} mm급 라디에이터를 쓰는 일체형 수랭 쿨러입니다.${actual ? ` 실제 라디에이터 치수는 ${actual}로 케이스 내부 공간과 대조할 수 있습니다.` : ""}`, "케이스의 상단·전면 장착 규격과 팬을 포함한 두께, RAM·그래픽카드 간섭, CPU 소켓 브래킷 포함 여부를 확인하세요.");
      }
      if (product.subtype === "case-fan" && spec("속도 제어") === "PWM" && spec("팬 규격")) {
        return notes(`${spec("팬 규격")} PWM 팬입니다. 호환 단자에 연결하면 시스템 설정으로 회전 속도를 조절할 수 있습니다.`, "케이스의 팬 장착 위치와 메인보드 헤더를 확인하세요. 판매 선택값에 따라 팬과 컨트롤러 포함 수량이 달라질 수 있습니다.");
      }
      const dimension = spec("제품 치수");
      if (!dimension) return;
      if (product.subtype === "ssd-heatsink") {
        const mount = spec("제조사 모델 표기 장착 규격");
        return notes(`${mount ? `${mount}용 ` : ""}SSD 방열판입니다. 외형 ${dimension}를 그래픽카드 아래 공간과 비교할 수 있습니다.`, "SSD 길이와 단면·양면 지원, 기존 메인보드 방열판과의 중복 설치 여부를 확인하세요.");
      }
      if (product.subtype === "ram-cooler") {
        return notes(`외형 ${dimension}의 RAM 냉각용 제품입니다. 메모리 주변의 장착 공간을 도면과 비교할 수 있습니다.`, "메모리 방열판 높이, CPU 공랭 쿨러 돌출부, 전원 단자와 고정 방식의 호환성을 확인하세요.");
      }
      return;
    }
    case "case": {
      const boards = spec("지원 메인보드");
      const gpu = spec("제조사 표기 최대 GPU 길이", "국내 ATX 모델 최대 GPU 길이");
      const cooler = spec("최대 CPU 쿨러 높이");
      if (!boards || (!gpu && !cooler)) return;
      const clearances = [gpu && `그래픽카드 ${gpu}`, cooler && `CPU 쿨러 ${cooler}`].filter(Boolean);
      return notes(`${boards} 보드를 장착할 수 있습니다. 제조사 장착 한도는 ${clearances.join(", ")}로 표기돼 조립 전에 부품을 대조할 수 있습니다.`, "전면 라디에이터나 팬을 추가하면 그래픽카드 공간이 줄어들 수 있습니다. 사용하려는 파워 길이와 케이블 굽힘 공간도 확인하세요.");
    }
    default:
      return;
  }
}
