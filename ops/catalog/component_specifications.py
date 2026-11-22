"""Extract labeled compatibility specifications from cached manufacturer product pages."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from bs4.builder import builder_registry

HTML_PARSER = 'lxml' if builder_registry.lookup('lxml') else 'html.parser'


def text(element):
    return element.get_text(' ', strip=True)


def model_key(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


def cells(table):
    for row in table.find_all('tr'):
        yield [text(cell) for cell in row.find_all(['th', 'td'], recursive=False)]


def dimensions(value):
    suffix = re.search(r'\s*\((with fan|without fan|fin area only)\)$', value, re.I)
    qualifier = suffix[1].lower() if suffix else ''
    value = value[:suffix.start()] if suffix else value
    parts = re.split(r'\s*[x×]\s*', value, flags=re.I)
    if len(parts) != 3:
        return None, None, qualifier
    measures = []
    for part in parts:
        number = re.fullmatch(r'(?:(Length|Width|Height|[LWH])\s*)?(\d+(?:\.\d+)?(?:[-–]\d+(?:\.\d+)?)?)\s*mm', part, re.I)
        if number:
            measures.append(((number[1] or '')[:1].upper(), number[2]))
    known = dict(measures)
    if set(known) == {'L', 'W', 'H'}:
        return [known[axis] for axis in 'LWH'], known['H'], qualifier
    if len(measures) == 3 and all(not axis for axis, _ in measures):
        values = [number for _, number in measures]
        return values, values[2], qualifier
    return None, known.get('H'), qualifier


def thermalright(soup, product):
    official_model = model_key(text(soup.h1))
    listed_model = model_key(product['name'])
    if official_model != listed_model and not (product['id'].startswith('distributor-seorin-') and official_model in listed_model):
        return {}, {}
    specs = {}
    facts = {}
    description = soup.select_one('.woocommerce-product-details__short-description')
    if product['subtype'] == 'cpu-air-cooler' and description:
        sockets = set()
        for part in re.split(r'(?i)\b(AMD|Intel)\s*[：:]', text(description))[2::2]:
            sockets.update(re.findall(r'\b(?:AM[2345]\+?|FM[12]\+?|TR4|sTR[5X]4?|sWRX8)(?!\w)', part, re.I))
            sockets.update('LGA' + value.upper() for value in re.findall(r'(?<!\d)(?:LGA\s*)?(11[56][0-9X]|1200|1366|1700|1851|2011|2066)(?!\d)', part, re.I))
        if sockets:
            facts['socket'] = sorted(sockets)
            specs['제조사 표기 지원 소켓'] = ' · '.join(facts['socket'])
    if product['subtype'] in {'ssd-heatsink', 'ram-cooler'}:
        for table in soup.select('.product table'):
            for fields in cells(table):
                if len(fields) == 2 and fields[0].lower() in {'dimension', 'dimensions'}:
                    size, _, _ = dimensions(fields[1])
                    if size:
                        specs['제품 치수'] = ' × '.join(size) + ' mm'
                    break
        if product['subtype'] == 'ssd-heatsink' and (length := re.search(r'\b(2280|22110)\b', text(soup.h1))):
            specs['제조사 모델 표기 장착 규격'] = 'M.2 ' + length[1]
        return specs, facts

    fan_dimensions = []
    for heading in soup.select('.product h3, .product h4'):
        title = text(heading)
        if not re.search(r'(?i)\bSpec', title):
            continue
        table = heading.find_next('table')
        if table is None:
            continue
        fields = [(row[0].strip(':'), row[1]) for row in cells(table) if len(row) == 2]
        measured = [dimensions(value) for name, value in fields if name in {'Dimension', 'Dimensions'}]
        if not re.search(r'(?i)\bfan\b', title):
            for size, height, qualifier in measured:
                installed = qualifier == 'with fan'
                scope = '팬 포함' if installed else '방열판'
                if size:
                    specs.setdefault(scope + ' 치수', ' × '.join(size) + ' mm')
                if height and re.fullmatch(r'\d+(?:\.\d+)?', height):
                    specs.setdefault('공랭 장착 높이' if installed else '방열판 높이',
                                     height + ' mm' + (' · 핀 영역' if qualifier == 'fin area only' else ''))
                    facts.setdefault('height' if installed else 'heatsinkHeight', height)
            pipes = dict(fields).get('Heat pipes', '')
            count = re.search(r'(?:[×x]\s*(\d+)\s*(?:units?|pcs)?\s*$|^(\d+)\s*(?:units?|pcs))', pipes, re.I)
            if count:
                specs['히트파이프 수'] = next(n for n in count.groups() if n) + '개'
        else:
            fan_dimensions.extend(' × '.join(size) + ' mm' for size, _, _ in measured if size)
    if fan_dimensions:
        specs['기본 팬 치수'] = ' · '.join(dict.fromkeys(fan_dimensions))
    return specs, facts


BOARD_FORMS = {
    'atx': 'ATX', 'eatx': 'E-ATX', 'eeatx': 'EE-ATX', 'microatx': 'microATX', 'matx': 'microATX',
    'mitx': 'Mini-ITX', 'miniitx': 'Mini-ITX', 'itx': 'Mini-ITX', 'dtx': 'DTX',
    'minidtx': 'Mini-DTX', 'ssiceb': 'SSI-CEB', 'ssieeb': 'SSI-EEB',
}

FRACTAL_GPU_NOTES = {
    'Core 1000': '저장장치 한 개를 장착하면 350 mm, 두세 개를 장착하면 210 mm까지 가능합니다.',
    'Core 1100': '3.5인치 저장장치를 장착하면 170 mm보다 긴 GPU의 측면 전원 커넥터가 간섭할 수 있습니다.',
    'Define 7': '오픈 레이아웃에서 전면 팬 없이 470 mm, 팬 장착 시 445 mm입니다. 스토리지 레이아웃은 290 mm입니다.',
    'Define 7 Compact': '전면 팬 장착 시 341 mm, 전면 팬을 제거하면 360 mm까지 가능합니다.',
    'Define 7 Mini': '전면 팬이 없으면 331 mm, 전면 팬을 장착하면 306 mm까지 가능합니다.',
    'Define 7 Nano': '기본 전면 팬을 장착한 상태에서 GPU는 최대 306 mm까지 가능합니다.',
    'Define 7 XL': '오픈 레이아웃에서 전면 팬 없이 530 mm, 팬 장착 시 505 mm입니다. 스토리지 레이아웃은 340 mm입니다.',
    'Define One': '전면 팬 사용 시 368 mm, 두께 30 mm 전면 라디에이터 사용 시 338 mm까지 가능합니다.',
    'Define R5': '상단 저장장치 케이지 장착 시 310 mm, 제거 시 440 mm까지 가능합니다.',
    'Epoch': '전면 팬을 장착하면 372 mm, 제조사 표기 전면 라디에이터 구성에서는 345 mm까지 가능합니다.',
    'Epoch XL': '전면 팬을 장착하면 425 mm, 제조사 표기 전면 라디에이터 구성에서는 395 mm까지 가능합니다.',
    'Meshify 2': '오픈 레이아웃에서 전면 팬 없이 470 mm, 팬 장착 시 445 mm입니다. 스토리지 레이아웃은 290 mm입니다.',
    'Meshify 2 Compact': '전면 팬 장착 시 341 mm, 전면 팬을 제거하면 360 mm까지 가능합니다.',
    'Meshify 2 Nano': '전면 팬 없이 331 mm, 전면 팬을 장착하면 306 mm까지 가능합니다.',
    'Meshify 2 XL': '오픈 레이아웃에서 전면 팬 없이 530 mm, 팬 장착 시 505 mm입니다. 스토리지 레이아웃은 340 mm입니다.',
    'Meshify C': '전면 팬을 장착한 상태에서 GPU는 최대 315 mm까지 가능합니다.',
    'Node 304': '제조사 표기 최대 GPU 길이는 저장장치 브래킷 두 개를 제거한 상태에 적용됩니다.',
    'Node 804': '전면 하단에 팬을 설치하면 GPU 길이는 최대 290 mm입니다.',
    'North Momentum Edition': '전면 팬 장착 시 355 mm, 전면 360 mm 라디에이터 사용 시 300 mm까지 가능합니다.',
    'North XL Momentum Edition': '전면 팬 장착 시 413 mm, 전면 420 mm 또는 360 mm 라디에이터 사용 시 380 mm까지 가능합니다.',
    'Pop Mini Silent': '전면 팬을 장착한 상태에서 GPU는 최대 340 mm까지 가능합니다.',
}


def fractal(soup, product):
    if model_key(text(soup.h1)) != model_key(product['name']):
        return {}, {}
    specs = {}
    facts = {}
    for tag in soup.find_all('p'):
        label = text(tag).lower()
        if label not in {'motherboard compatibility', 'gpu max length', 'gpu max width', 'gpu max thickness (mm)',
                         'cpu cooler max height', 'psu max length', 'product dimensions (l × w × h)', 'psu compatibility'}:
            continue
        sibling = tag.find_next_sibling()
        if sibling is None:
            continue
        value = text(sibling)
        if label == 'motherboard compatibility':
            boards = [BOARD_FORMS[model_key(board)] for board in value.split(',') if model_key(board) in BOARD_FORMS]
            if boards:
                facts['boardSupport'] = boards
                specs['지원 메인보드'] = ' · '.join(boards)
        elif label == 'product dimensions (l × w × h)':
            if re.fullmatch(r'[\d.]+\s*[x×]\s*[\d.]+\s*[x×]\s*[\d.]+\s*mm', value):
                specs['외형 치수 (깊이 × 너비 × 높이)'] = value.replace(' x ', ' × ')
        elif label == 'psu compatibility':
            if value in {'ATX', 'SFX', 'SFX-L', 'SFX, SFX-L'}:
                specs['지원 파워 규격'] = value
        else:
            number = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(?:mm)?', value)
            if not number:
                continue
            display = {
                'gpu max length': '제조사 표기 최대 GPU 길이', 'gpu max width': '제조사 표기 최대 GPU 너비',
                'gpu max thickness (mm)': '제조사 표기 최대 GPU 두께', 'cpu cooler max height': '최대 CPU 쿨러 높이',
                'psu max length': '최대 파워 길이',
            }[label]
            specs[display] = number[1] + ' mm'
            if label == 'gpu max length':
                facts['gpuLength'] = number[1]
    return specs, facts


def seasonic_tables(soup):
    section = soup.select_one('#specifications')
    if section is None:
        return {}
    tables = {}
    for tab in section.select('.item[data-id]'):
        watts = re.fullmatch(r'(\d{3,4})\s*W', text(tab))
        if not watts:
            continue
        matches = [pane for pane in section.select('.table[data-id]') if pane['data-id'] == tab['data-id']]
        if len(matches) == 1:
            tables[watts[1]] = matches[0]
    return tables


def seasonic(soup, product):
    original = {entry['label']: entry['value'] for entry in product['specifications']}
    series = original.get('제품군 표기', '')
    watts = original.get('목록 출력 옵션', '').removesuffix('W').strip()
    panel = seasonic_tables(soup).get(watts)
    if model_key(text(soup.h1)) != model_key(series) or panel is None:
        return {}, {}
    table = next((t for t in panel.find_all('table') if t.find('tr') and text(t.find('tr')) == 'Technical Specifications'), None)
    if table is None:
        return {}, {}
    specs = {'정격 출력': watts + 'W'}
    facts = {'wattage': watts}
    for row in cells(table):
        if len(row) < 2:
            continue
        label, value = row[-2:]
        if label == 'Form Factor':
            form = {'ATX/EPS': 'ATX', 'ATX': 'ATX', 'SFX': 'SFX', 'SFX-L': 'SFX-L'}.get(value)
            if form:
                specs['전원 장착 규격'] = form
                facts['formFactor'] = form
        if label == 'Modularity':
            modular = {'Fully Modular': '풀모듈러', 'Semi-Modular': '세미모듈러', 'Fixed Cables': '고정 케이블'}.get(value)
            if modular:
                specs['케이블 방식'] = modular
                facts['modular'] = modular
        if label.replace(' ', '').upper().startswith('80PLUS') and value.upper() in {'BRONZE', 'GOLD', 'PLATINUM', 'SILVER', 'TITANIUM', 'STANDARD'}:
            specs['효율 인증'] = '80 PLUS ' + value
            facts['efficiency'] = value.upper()
        if label == 'Cybenetics Efficiency Level' and value in {'Gold', 'Platinum', 'Titanium', 'Diamond', 'Silver', 'Bronze'}:
            specs['Cybenetics 효율 인증'] = value
        if label == 'Dimensions' and re.fullmatch(r'[\d.]+\s*[x×]\s*[\d.]+\s*[x×]\s*[\d.]+\s*mm', value):
            specs['파워 본체 치수'] = value
        if label == 'Warranty' and (years := re.fullmatch(r'(\d+) years?', value, re.I)):
            specs['제조사 표기 보증 기간'] = years[1] + '년 · 국내 보증 조건은 유통사 확인'
    if version := re.search(r'\bATX (3\.[01])\b', series):
        specs['전원 설계 규격'] = 'ATX ' + version[1]
        facts['atx'] = version[1]
    if 'efficiency' not in facts and 'Cybenetics 효율 인증' in specs:
        facts['efficiency'] = 'Cybenetics ' + specs['Cybenetics 효율 인증']
    power_table = next((t for t in panel.find_all('table') if t.find('tr') and text(t.find('tr')) == 'Power Output'), None)
    if power_table is not None:
        totals = [m[1] for row in cells(power_table) if any('total' in cell.lower() for cell in row)
                  for cell in row if (m := re.fullmatch(r'(\d{3,4})\s*W', cell))]
        if totals and totals != [watts]:
            return {}, {}
    return specs, facts


PARSERS = {'www.thermalright.com': thermalright, 'www.fractal-design.com': fractal, 'seasonic.com': seasonic}


def collect(catalog, cache):
    products = {product['id']: product for product in catalog['products']}
    results = []
    for metadata in sorted(cache.glob('*/*.json')):
        observation = json.loads(metadata.read_text(encoding='utf-8'))
        url = observation['url']
        parser = PARSERS.get(urlsplit(url).hostname)
        if parser is None:
            continue
        markup = metadata.with_suffix('.html').read_text(encoding='utf-8')
        soup = BeautifulSoup(markup, 'html.parser' if parser is thermalright else HTML_PARSER)
        if soup.h1 is None:
            continue
        for product_id in observation['productIds']:
            product = products.get(product_id)
            if product is None or not any(item['url'] == url for item in product['sources']):
                continue
            specifications, facts = parser(soup, product)
            existing = {spec['label'] for spec in product['specifications']}
            known = {fact['key'] for fact in product.get('facts', [])}
            specifications = {label: value for label, value in specifications.items() if label not in existing}
            facts = {key: value for key, value in facts.items() if key not in known}
            if specifications or facts:
                row = {'ids': [product_id], 'url': url, 'observedAt': observation['observedAt'],
                       'specifications': specifications, 'facts': facts}
                if parser is fractal and 'gpuLength' in facts:
                    note = FRACTAL_GPU_NOTES.get(product['name'])
                    if note:
                        row['notes'] = [note]
                    if product['name'] == 'Era 2':
                        row['notes'] = ['메인보드 위치에 따라 허용 쿨러 높이는 50~70 mm입니다. GPU 두께와 쿨러 높이는 함께 대조하세요.']
                results.append(row)
    return sorted(results, key=lambda row: row['ids'][0])


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('catalog', type=Path)
    cli.add_argument('cache', type=Path)
    cli.add_argument('output', type=Path)
    args = cli.parse_args()
    rows = collect(json.loads(args.catalog.read_text(encoding='utf-8')), args.cache)
    body = ',\n'.join('    ' + json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in rows)
    args.output.write_text('{\n  "models": [\n' + body + '\n  ]\n}\n', encoding='utf-8')
    print(json.dumps({'enriched': len(rows)}))


if __name__ == '__main__':
    main()
