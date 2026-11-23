from datetime import datetime, timezone, timedelta
import unittest

from ops.maintenance.review_inbox import feed_rows, fresh_alerts, price_review


class ReviewInboxTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 23, 14, 30, tzinfo=timezone.utc)
        self.offer = {
            'id': 'test-pc', 'productId': 'fixture-pc', 'category': 'fullpc', 'name': 'Fixture PC',
            'option': '32 GB', 'seller': 'test seller', 'source': 'test store',
            'checkedAt': (self.now - timedelta(hours=2)).isoformat(), 'price': 2_000_000,
            'shipping': 0, 'availability': 'in-stock',
        }

    def test_unchanged_releases_and_option_changes_do_not_generate_price_alerts(self):
        state = {}
        self.assertEqual(price_review([self.offer], state, self.now), [])
        self.assertEqual(price_review([self.offer], state, self.now), [])
        changed = {**self.offer, 'price': 1_800_000, 'checkedAt': self.now.isoformat()}
        events = price_review([changed], state, self.now)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['priority'], 'breaking')
        self.assertEqual(price_review([changed], state, self.now), events)
        other_option = {**changed, 'option': '64 GB', 'price': 1_500_000, 'checkedAt': (self.now + timedelta(minutes=1)).isoformat()}
        self.assertEqual(price_review([other_option], state, self.now + timedelta(minutes=1)), events)

    def test_quotes_are_scoped_and_same_event_is_only_dispatched_once(self):
        xml = b'''<rss><channel><item><title>NVIDIA board reinstates Jensen Huang as CEO</title>
        <link>https://nvidianews.nvidia.com/news/test?utm=foo</link><pubDate>Mon, 23 Nov 2026 14:00:00 GMT</pubDate>
        <description>This article body must stay outside the review queue.</description></item></channel></rss>'''
        rows = feed_rows(xml, 'NVIDIA', {'nvidianews.nvidia.com'}, self.now)
        self.assertEqual(rows[0]['url'], 'https://nvidianews.nvidia.com/news/test')
        self.assertNotIn('description', rows[0])
        self.assertEqual(feed_rows(xml, 'Other', {'example.com'}, self.now), [])
        same = {**rows[0], 'id': 'different-url', 'title': 'Jensen Huang returns as CEO of Nvidia'}
        inbox = {'news': rows + [same], 'price_changes': []}
        pending = fresh_alerts(inbox, {}, self.now)
        self.assertEqual(len(pending), 1)
        self.assertEqual(fresh_alerts(inbox, {'attempted': {pending[0]['alert_id']: self.now.isoformat()}}, self.now), [])
        with self.assertRaises(ValueError):
            feed_rows(b'<!DOCTYPE rss><rss/>', 'NVIDIA', set(), self.now)
