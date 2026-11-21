import unittest
from datetime import datetime, timezone
from ops.hotdeals.gap_review import disposition, in_window, review


class GapReviewTests(unittest.TestCase):
    def test_peripheral_desktop_is_not_a_complete_pc(self):
        self.assertEqual(disposition('[오늘의집] EDIFIER QD25 데스크탑 투명 블루투스 스피커')[0],'분류 재검토')
        self.assertEqual(disposition('[G마켓] 9800X3D 완본체 스피커 증정')[0],'상품 후보')

    def test_raffles_never_enter_sale_gap_queue(self):
        self.assertEqual(disposition('[기타] 수랭쿨러 0원 래플!')[0],'일반 판매 제외')

    def test_time_intervals_use_exclusive_end_and_keep_unknowns(self):
        since=datetime(2026,5,21,tzinfo=timezone.utc);until=datetime(2026,11,21,tzinfo=timezone.utc)
        self.assertEqual(in_window({'posted_lower':'2026-05-20T00:00:00+00:00','posted_upper':since.isoformat()},since,until),'기간 밖')
        self.assertEqual(in_window({'posted_lower':'2026-05-21T00:00:00+00:00','posted_upper':'2026-05-22T00:00:00+00:00'},since,until),'기간 내')
        self.assertEqual(in_window({},since,until),'날짜 검토')

    def test_configuration_does_not_match_standalone_cpu(self):
        product={'name':'AMD Ryzen 7 7800X3D','category':'cpu','referenceCode':'BD-TEST'}
        row={'title':'[지마켓] 7800X3D+32GB+1TB 반본체','category':'halfpc','source':'fixture','post_id':'1','post_url':'https://example.invalid/1'}
        result=review(row,[product]);self.assertEqual(result['gap_state'],'분류 미등록');self.assertEqual(result['related_reference_codes'],[])
        self.assertIsNone(result['current_price']);self.assertFalse(result['sku_verified'])

    def test_similar_cpu_is_only_a_related_hint(self):
        row={'title':'[알리] 7800X3D 직구 카드 할인','category':'cpu','source':'fixture','post_id':'2','post_url':'https://example.invalid/2'}
        result=review(row,[{'name':'AMD Ryzen 7 7800X3D 멀티팩','category':'cpu','referenceCode':'BD-TEST'}])
        self.assertEqual(result['gap_state'],'관련 항목 있음·옵션 대조 필요')
        self.assertIn('카드 조건',result['title_discount_hints']);self.assertFalse(result['sku_verified'])

    def test_gmarket_and_auction_remain_separate(self):
        base={'category':'ram','source':'fixture','post_id':'3','post_url':'https://example.invalid/3'}
        self.assertEqual(review({**base,'title':'[옥션] RAM'},[])['market'],'옥션')
        self.assertEqual(review({**base,'title':'[지마켓] RAM'},[])['market'],'G마켓')


if __name__=='__main__':unittest.main()
