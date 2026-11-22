import unittest
from copy import deepcopy
from ops.catalog.seorin_offer import parse_offer,money

SOURCE={'url':'https://www.seorinexpress.com/goods/goods_view.php?goodsNo=1000000001','sourceId':'1000000001','listName':'Sample 1TB','observedAt':'2026-11-22T00:00:00Z'}
def fixture(price=200000,fee='2,500원',rules=True):
    inputs={'goodsNo[]':'1000000001','optionFl':'n','goodsCnt[]':'1','goodsDiscountFl':'n','goodsDiscount':'0.00','set_option_price':'0','set_option_text_price':'0','set_add_goods_price':'0','optionPriceSum[]':'0.00','set_goods_price':str(price),'set_total_price':str(price),'deliveryCollectFl':'pre','optionSno[]':'123'}
    params={'setGoodsNo':'1000000001','setOptionFl':'n','setOptionTextFl':'n','setAddGoodsFl':'n','setSalesUnit':'1','setMinOrderCnt':'1','setMaxOrderCnt':'0','setGoodsPrice':str(price)+'.00','setStockFl':'y','setStockCnt':'12'}
    layers='<div id="lyDelivery"><div class="delivery_list"><li>0원 이상 ~ 500,000원 미만 2,500원</li><li>500,000원 이상 0원</li></div></div>' if rules else ''
    return '<html><script>var parameters = {'+','.join("'%s':'%s'"%kv for kv in params.items())+'};</script><form id="frmView"><div class="item_detail_tit"><h3>Sample 1TB</h3></div>'+''.join('<input name="'+k+'" value="'+v+'">' for k,v in inputs.items())+f'<dl class="item_price"><dd><strong>{price:,}원</strong></dd></dl><dl class="item_delivery"><dd><strong>{fee}</strong>{layers}</dd></dl><div class="btn_choice_box"><button class="btn_add_order">바로구매</button></div></form><footer>(주)서린씨앤아이</footer></html>'

class SeorinOfferTests(unittest.TestCase):
    def test_one_unit_shipping_and_no_personal_coupon_are_distinct(self):
        row=parse_offer(fixture(),SOURCE)
        self.assertEqual((row['price'],row['shippingFee'],row['ordinaryDeliveredKRW']),(200000,2500,202500))
        self.assertNotIn('couponPrice',row);self.assertNotIn('cardPrice',row)
        self.assertIn('로그인',row['discountReview']);self.assertEqual(row['checkedAt'],SOURCE['observedAt'])
    def test_free_delivery_is_explicit_and_threshold_must_match(self):
        self.assertEqual(parse_offer(fixture(600000,'0원'),SOURCE)['shippingFee'],0)
        self.assertEqual(parse_offer(fixture(200000,'무료',False),SOURCE)['shippingFee'],0)
        with self.assertRaises(ValueError):parse_offer(fixture(200000,'0원'),SOURCE)
        free=fixture(200000,'무료',False).replace('<input name="deliveryCollectFl" value="pre">','').replace('<script>','<script>var deliveryCollectFl = "pre";')
        self.assertEqual(parse_offer(free,SOURCE)['shippingFee'],0)
        self.assertEqual(parse_offer(free.replace('var deliveryCollectFl = "pre";',''),SOURCE)['state'],'review-required')
    def test_price_or_identity_conflict_is_not_published(self):
        with self.assertRaises(ValueError):parse_offer(fixture().replace('200,000원','199,000원'),SOURCE)
        source=deepcopy(SOURCE);source['sourceId']='1000000002'
        with self.assertRaises(ValueError):parse_offer(fixture(),source)
        with self.assertRaises(ValueError):parse_offer(fixture().replace('<h3>Sample 1TB</h3>','<h3>Sample 2TB</h3>'),SOURCE)
    def test_options_multiple_quantity_and_unknown_discount_require_review(self):
        for before,after in [("'setOptionFl':'n'","'setOptionFl':'y'"),('name="goodsCnt[]" value="1"','name="goodsCnt[]" value="2"'),('name="goodsDiscountFl" value="n"','name="goodsDiscountFl" value="y"')]:
            row=parse_offer(fixture().replace(before,after),SOURCE);self.assertEqual(row['state'],'review-required');self.assertNotIn('price',row)
    def test_sold_out_has_no_new_price_and_sale_reference_is_not_a_coupon(self):
        row=parse_offer(fixture().replace('<button class="btn_add_order">바로구매</button>','<button>일시품절</button>'),SOURCE)
        self.assertEqual(row['state'],'sold-out');self.assertNotIn('price',row)
        row=parse_offer(fixture().replace('200,000원</strong>','200,000원<span>30% 할인</span></strong>'),SOURCE)
        self.assertEqual(row['price'],200000);self.assertNotIn('instantPrice',row)
    def test_invalid_money_is_not_coerced(self):
        for value in ['-1','1e3','free','100원<script>','1.1']:
            with self.assertRaises(ValueError):money(value)

if __name__=='__main__':unittest.main()
