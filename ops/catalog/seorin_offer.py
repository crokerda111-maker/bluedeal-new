"""Read one explicit Seorin SKU. No JS evaluation, login or cart requests."""
from __future__ import annotations
from decimal import Decimal, InvalidOperation
import re
from urllib.parse import urlsplit,parse_qs
from bs4 import BeautifulSoup

def money(value):
    if not isinstance(value,str) or not re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?(?:원)?',value.strip()):
        raise ValueError('INVALID_MONEY')
    try: amount=Decimal(value.strip().replace(',','').removesuffix('원'))
    except InvalidOperation:raise ValueError('INVALID_MONEY') from None
    if amount!=int(amount) or not 0<=amount<=1_000_000_000:raise ValueError('INVALID_MONEY')
    return int(amount)

def normalized(value):return re.sub(r'\s+',' ',value).strip().casefold()

def parse_offer(html, source):
    parsed=urlsplit(source['url']);query=parse_qs(parsed.query)
    if parsed.scheme!='https' or parsed.hostname!='www.seorinexpress.com' or parsed.path!='/goods/goods_view.php' or set(query)!={'goodsNo'} or query['goodsNo']!=[source['sourceId']]:raise ValueError('INVALID_SOURCE_IDENTITY')
    soup=BeautifulSoup(html,'html.parser');form=soup.select_one('form#frmView')
    if not form:raise ValueError('MISSING_PRODUCT_FORM')
    fields={}
    for field in form.select('input[name]'):fields.setdefault(field['name'],[]).append(field.get('value',''))
    def single(key):
        values=fields.get(key,[])
        if len(values)!=1:raise ValueError('AMBIGUOUS_FIELD:'+key)
        return values[0]
    scripts='\n'.join(script.get_text() for script in soup.select('script'))
    # These are literal configuration values printed by the merchant, never executable code.
    block=re.search(r'var parameters\s*=\s*\{(.*?)\};',scripts,re.S)
    if not block:raise ValueError('MISSING_PUBLIC_CONFIGURATION')
    params=dict(re.findall(r"'(set\w+)'\s*:\s*'([^']*)'",block[1]))
    if params.get('setGoodsNo')!=source['sourceId'] or single('goodsNo[]')!=source['sourceId']:raise ValueError('DETAIL_IDENTITY_MISMATCH')
    title=form.select_one('.item_detail_tit h3')
    if not title:raise ValueError('MISSING_SELECTED_NAME')
    name=title.get_text(' ',strip=True)
    if normalized(name)!=normalized(source['listName']):raise ValueError('LIST_DETAIL_NAME_CHANGED')
    result=dict(sourceId=source['sourceId'],name=name,url=source['url'],checkedAt=source['observedAt'],
                discountReview='공개 일반 판매가 기준. 쿠폰 목록은 로그인 필요로 개인별 쿠폰·회원·카드 조건을 확인하지 못했으며 적용하지 않았습니다.',state='review-required')
    button=form.select_one('.btn_choice_box .btn_add_order')
    choice=form.select_one('.btn_choice_box')
    stock=params.get('setStockCnt','')
    if not button and choice and re.search(r'품절|판매종료|판매중지',choice.get_text(' ',strip=True)):
        return {**result,'state':'sold-out','availability':'out-of-stock','reason':'판매 상세에 구매 불가·품절 표기'}
    if not button or button.has_attr('disabled'):return {**result,'reason':'구매 버튼 상태 추가 확인 필요'}
    if params.get('setOptionFl')!='n' or single('optionFl')!='n' or params.get('setOptionTextFl')!='n':return {**result,'reason':'필수 선택 옵션 추가 확인 필요'}
    if params.get('setAddGoodsFl')!='n':return {**result,'reason':'추가상품 선택 상태 추가 확인 필요'}
    if single('goodsCnt[]')!='1' or params.get('setSalesUnit')!='1' or params.get('setMinOrderCnt')!='1':return {**result,'reason':'수량1 조건 추가 확인 필요'}
    if params.get('setMaxOrderCnt') not in ('0','1') and not (params.get('setMaxOrderCnt','').isdigit() and int(params['setMaxOrderCnt'])>=1):return {**result,'reason':'최대 구매 수량 조건 추가 확인 필요'}
    if single('goodsDiscountFl')!='n' or money(single('goodsDiscount'))!=0:return {**result,'reason':'상품 할인 적용 범위·표시가 추가 확인 필요'}
    if any(money(single(key))!=0 for key in ['set_option_price','set_option_text_price','set_add_goods_price','optionPriceSum[]']):return {**result,'reason':'추가 옵션 금액 존재'}
    price=money(single('set_goods_price'))
    price_node=form.select_one('.item_price dd strong')
    price_text=next(price_node.stripped_strings,'') if price_node else ''
    if not price_node or price<=0 or money(price_text)!=price or money(params.get('setGoodsPrice',''))!=price or money(single('set_total_price'))!=price:raise ValueError('PRICE_DISPLAY_MISMATCH')
    delivery=form.select_one('.item_delivery dd > strong')
    if not delivery:return {**result,'reason':'기본 배송비 확인 필요'}
    delivery_text=delivery.get_text('',strip=True)
    fee=0 if delivery_text=='무료' else money(delivery_text)
    rules=[re.sub(r'\s+',' ',li.get_text(' ',strip=True)) for li in form.select('#lyDelivery .delivery_list li')]
    amount_rules=['0원 이상 ~ 500,000원 미만 2,500원','500,000원 이상 0원']
    quantity_rules=['0 개 이상 ~ 2 개 미만 2,500원','2 개 이상 1 개 마다 추가 2,500원']
    if rules:
        # This explicitly supported rule uses the selected one-unit merchandise amount.
        if rules not in (amount_rules,quantity_rules):return {**result,'reason':'배송비 구간 별도 검증 필요','deliveryRules':rules}
        if fee!=(0 if rules==amount_rules and price>=500000 else 2500):raise ValueError('DELIVERY_DISPLAY_MISMATCH')
    delivery_modes=fields.get('deliveryCollectFl',[])
    # Free-delivery templates insert this literal default into the form at page load.
    script_prepaid=not delivery_modes and fee==0 and re.search(r'var deliveryCollectFl\s*=\s*["\']pre["\']',scripts)
    if delivery_modes!=['pre'] and not script_prepaid:return {**result,'reason':'선불·착불 조건 별도 확인 필요'}
    if params.get('setStockFl')=='y' and (not stock.isdigit() or int(stock)<1):return {**result,'reason':'재고와 구매 버튼 표기 대조 필요'}
    if '서린씨앤아이' not in soup.get_text(' ',strip=True):raise ValueError('SELLER_IDENTITY_MISSING')
    note='수량1·추가 선택 없음 기준의 공개 판매가. 쿠폰·회원·카드 할인과 적립은 미적용. 쿠폰 세부 조건은 로그인 후 판매처 확인 필요.'
    shipping='기본 배송비 '+str(fee)+'원. '
    shipping+='할인·쿠폰 적용 후 상품금액 50만원 이상 무료배송, 미만 2500원. ' if rules==amount_rules else '수량별 배송비 적용: 수량1 기준 2500원, 여러 개 주문 시 판매처 재계산. ' if rules==quantity_rules else ''
    shipping+='추가 주문·쿠폰 적용 시 배송비 재계산. 제주·도서산간 추가비 별도 확인.'
    return {**result,'state':'confirmed','price':price,'shippingFee':fee,'priceNote':note,'shippingNote':shipping,
            'availability':'in-stock' if params.get('setStockFl')=='y' else 'unknown','quantityOneVerified':True,
            'quantityOneTotal':price,'quantityVerifiedAt':source['observedAt'],'selectedOptionNo':single('optionSno[]'),
            'seller':'서린씨앤아이','source':'서린 공식몰','deliveryRules':rules,'ordinaryDeliveredKRW':price+fee}
