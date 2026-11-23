import { PC_PARTS } from "./dailyPc";
import { cpuModel, gpuModel } from "./pcModelNames";
import type { CatalogProduct } from "./productCatalog";

const labels: Record<string, keyof typeof PC_PARTS | "os" | "warranty"> = {
  CPU: "cpu", 프로세서: "cpu", "그래픽[VGA]": "gpu", 그래픽카드: "gpu",
  메인보드: "board", 메모리: "ram", "메모리[RAM]": "ram", RAM: "ram",
  SSD: "storage", "NVMe SSD": "storage", 파워: "psu", 케이스: "case",
  쿨러: "cooler", CPU쿨러: "cooler", "프로세서 쿨러": "cooler",
  운영체제: "os", "윈도우[OS]": "os", "조립비+AS": "warranty",
};

const slots = { ...PC_PARTS, os: "운영체제", warranty: "본체 보증" };
const sources = ["확인한 선택", "확인한 기본 선택", "판매처 부품표", "판매처 기본사양"];

export function pcCatalogConfiguration(product: CatalogProduct) {
  const kind = product.category === "halfpc" ? "halfpc" : "fullpc";
  const titleModels: Partial<Record<keyof typeof slots, string | null>> = {
    cpu: cpuModel(product.name), gpu: gpuModel(product.name, kind),
  };
  return Object.entries(slots).map(([key, label]) => {
    for (const source of sources) {
      const options = product.specifications.filter(spec => {
        const [prefix, part] = spec.label.split(" · ");
        return prefix === source && labels[part] === key && !/^(?:추가 확인 필요|미확인|확인 중)$/.test(spec.value);
      });
      if (options.length) return { key, label, values: [...new Set(options.map(option => option.value))], source };
    }
    const model = titleModels[key as keyof typeof slots];
    return { key, label, values: model ? [model] : [], source: model ? "판매 제목에 표기된 등급" : null };
  });
}
