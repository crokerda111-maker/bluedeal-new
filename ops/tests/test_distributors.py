import unittest
from ops.catalog.distributors import parse_seorin,list_url,ORIGIN

class DistributorListTests(unittest.TestCase):
    def html(self, link='../goods/goods_view.php?goodsNo=123'):
        return f'''<div class="recommend"><div class="item_cont"><a href="{link}"><strong class="item_name">추천 제외</strong></a></div></div>
        <div class="goods_list_item"><div class="goods_list_cont"><div class="item_cont"><a href="{link}"><strong class="item_name">명시한 모델 32GB(16Gx2)</strong></a><strong class="item_price">123원</strong></div></div></div>
        <div class="pagination"><a href="?page=1&cateCd=056001">1</a><a href="?page=2&cateCd=056001">2</a><a href="https://other.invalid/?page=3&cateCd=056001">3</a></div>'''
    def test_only_actual_list_and_no_price_from_list(self):
        rows,pages=parse_seorin(self.html(),ORIGIN+'/goods/goods_list.php?cateCd=056001','ram')
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['sourceId'],'123');self.assertNotIn('price',rows[0]);self.assertEqual(len(pages),2)
    def test_cross_origin_product_link_is_rejected(self):
        with self.assertRaises(ValueError):parse_seorin(self.html('https://other.invalid/goods/goods_view.php?goodsNo=123'),ORIGIN+'/goods/goods_list.php?cateCd=056001','ram')
    def test_page_one_canonicalization_avoids_duplicate_inventory(self):
        self.assertEqual(list_url(ORIGIN+'/goods/goods_list.php?page=1&cateCd=056001'),ORIGIN+'/goods/goods_list.php?cateCd=056001')
        with self.assertRaises(ValueError):list_url(ORIGIN+'/goods/goods_list.php?page=-1&cateCd=056001')

if __name__=='__main__':unittest.main()
