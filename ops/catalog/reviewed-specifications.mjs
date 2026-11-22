const sourceFor = (label, url, checkedOn) => ({
  label, url, observedAt: `${checkedOn}T00:00:00+09:00`, kind: 'manufacturer-specifications',
});
const specs = (entries) => entries.map(([label, value]) => ({ label, value }));

export function reviewCpuSpecifications({ checkedOn, models }) {
  return models.map(model => {
    const { id, url, socket, memory, graphics, cores, threads, boost, basePower, turboPower } = model;
    const source = sourceFor('CPU 제조사 공식 사양', url, checkedOn);
    const memoryTypes = memory.map(item => item.split('-')[0]);
    const server = id === 'reviewed-amd-epyc-4585px-multipack';
    const dualMemory = memoryTypes.length > 1;
    const externalGraphics = graphics === '외장 그래픽카드 필요';
    const conditions = server
      ? '서버용 CPU입니다. 메인보드 제조사의 CPU 지원표에서 EPYC 4585PX와 필요한 BIOS 버전을 확인하세요.'
      : '메인보드 제조사의 CPU 지원표에서 정확한 모델과 필요한 BIOS 버전을 확인하세요.';
    return {
      id,
      sources: [source],
      specifications: specs([
        ['지원 메모리', memoryTypes.join(' · ')],
        ['제조사 표기 기본 메모리 속도 상한', memory.map(item => `${item} MT/s`).join(' · ')],
        ['CPU 소켓', socket],
        ['내장그래픽', graphics ?? '제조사 사양표에서 확인되지 않음'],
        ['코어 수', `${cores}코어`],
        ['스레드 수', `${threads}스레드`],
        ['최대 부스트 클럭', `${boost} GHz`],
        [turboPower ? '프로세서 기본 전력' : '기본 TDP', `${basePower}W`],
        ...(turboPower ? [['최대 터보 전력', `${turboPower}W`]] : []),
      ]),
      facts: [
        { key: 'socket', value: socket, source },
        ...memoryTypes.map(value => ({ key: 'memory', value, source })),
        ...(graphics ? [{ key: 'graphics', value: externalGraphics ? 'absent' : 'present', source }] : []),
      ],
      strengths: [{
        title: server ? 'EPYC 서버 플랫폼 호환 요건' : dualMemory ? 'DDR4 또는 DDR5 구성 선택' : `${memoryTypes[0]} 메모리 지원`,
        detail: dualMemory
          ? '이 CPU는 DDR4와 DDR5를 모두 지원합니다. 구입할 메인보드가 지원하는 한 가지 규격에 맞춰 메모리를 선택하세요.'
          : `${socket} 소켓에서 ${memoryTypes[0]} 메모리를 지원합니다.`,
        conditions,
        sources: [source],
      }],
      notes: [
        '메모리의 실제 동작 속도는 메인보드, 장착 개수와 메모리 구성에 따라 달라집니다.',
        ...(externalGraphics ? ['화면을 출력하려면 외장 그래픽카드가 필요합니다.'] : []),
      ],
    };
  });
}

export function reviewBoardSpecifications({ checkedOn, models }, products) {
  const byId = new Map(products.map(product => [product.id, product]));
  return models.flatMap(({ ids, url, socket, chipset, memory, slots, size, wifi, manual }) => ids.map(id => {
    const source = sourceFor(manual ? '해당 메인보드 제조사 매뉴얼' : '메인보드 제조사 공식 사양', url, checkedOn);
    const existingLabels = new Set(byId.get(id)?.specifications.map(spec => spec.label));
    const values = [
      ['CPU 소켓', socket],
      ['칩셋', chipset],
      ['메모리 규격', memory],
      ['메모리 슬롯', `${slots}개`],
      ...(size ? [['규격', size]] : []),
      ...(wifi ? [['무선랜', wifi]] : []),
    ].filter(([label]) => !existingLabels.has(label) && !(label === '메모리 규격' && existingLabels.has('메모리')));
    return {
      id,
      sources: [source],
      specifications: specs(values),
      facts: wifi ? [{ key: 'wireless', value: wifi === '없음' ? 'absent' : 'present', source }] : [],
      notes: [`메모리는 ${memory}를 선택하고, CPU는 제조사의 정확한 모델별 지원표와 필요한 BIOS 버전을 확인하세요.`],
    };
  }));
}

export function reviewModelSpecifications({ checkedOn, models }) {
  return models.flatMap(({ ids, url, label, sourceKind, observedAt, specifications, facts, notes }) => {
    const source = sourceFor(label ?? '해당 모델 제조사 공식 사양', url, checkedOn);
    if (observedAt) source.observedAt = observedAt;
    if (sourceKind === 'retailer-listing') source.kind = sourceKind;
    return ids.map(id => ({
      id,
      sources: [source],
      specifications: specs(Object.entries(specifications)),
      facts: Object.entries(facts ?? {}).flatMap(([key, values]) => [values].flat().map(value => ({ key, value: String(value), source }))),
      notes: notes ?? [],
    }));
  });
}
