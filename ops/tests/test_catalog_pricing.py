"""Synthetic offers: expired/cached/conditional benefits must not become facts."""
from copy import deepcopy
from datetime import datetime, timedelta
import unittest

from ops.catalog.pricing import quote

NOW = datetime.fromisoformat('2026-11-20T21:00:00+09:00')


def offer(**changes):
    return {'listing_id': 'synthetic-listing', 'variant_id': 'synthetic-variant', 'seller': 'Synthetic seller',
            'product_price_krw': 100000, 'shipping_krw': 3000, 'currency': 'KRW', 'quantity': 1,
            'source_observed_at': '2026-11-20T20:00:00+09:00', 'verified_at': '2026-11-20T20:01:00+09:00',
            'selected_options_verified': True, 'source_kind': 'direct', 'availability': 'in-stock',
            'evidence_url': 'https://shop.example.invalid/product/1', **changes}


def rule(id='coupon', **changes):
    return {'id': id, 'listing_id': 'synthetic-listing', 'variant_id': 'synthetic-variant', 'seller': 'Synthetic seller',
            'effect': 'coupon', 'kind': 'fixed', 'value': 10000, 'cap': None, 'minimum_krw': 0,
            'minimum_basis': 'original-product', 'discount_basis': 'remaining-product', 'priority': 10,
            'starts_at': '2026-11-20T00:00:00+09:00', 'ends_at': '2026-11-21T00:00:00+09:00',
            'source_observed_at': '2026-11-20T20:00:00+09:00', 'verified_at': '2026-11-20T20:01:00+09:00',
            'terms_verified': True, 'source_kind': 'direct', 'requirements': {}, 'usage_scope': 'order',
            'stackable_with': [], 'rounding': None, 'rounding_stage': None,
            'evidence_url': 'https://shop.example.invalid/event/1', **changes}


def card(**changes):
    return rule('card', effect='instant-card', kind='rate', value=1000, cap=5000, priority=20,
                requirements={'card_issuer': 'Synthetic card'}, rounding='floor-won', rounding_stage='before-cap',
                stackable_with=['coupon'], **changes)


class PricingTests(unittest.TestCase):
    def calculate(self, rules=(), item=None, context=None, now=NOW):
        return quote(offer() if item is None else item, list(rules), now=now, context=context)

    def test_verified_ordinary_delivered_price_keeps_actual_observation_time(self):
        result = self.calculate()
        self.assertEqual(result['ordinary_delivered_krw'], 103000)
        self.assertEqual(result['scenario_payment_krw'], 103000)
        self.assertEqual(result['price_observed_at'], '2026-11-20T20:00:00+09:00')
        self.assertFalse(result['checkout_confirmed'])

    def test_coupon_then_card_cap_and_shipping(self):
        rules = [rule(stackable_with=['card']), card()]
        original = deepcopy(rules)
        result = self.calculate(rules, context={'card_issuer': 'Synthetic card'})
        self.assertEqual(result['scenario_payment_krw'], 88000)
        self.assertEqual([r['discount_krw'] for r in result['applied']], [10000, 5000])
        self.assertTrue(result['personal_conditions_required'])
        self.assertEqual(rules, original)

    def test_ended_november_19_event_is_excluded_on_november_20(self):
        result = self.calculate([rule(starts_at='2026-11-01T00:00:00+09:00', ends_at='2026-11-20T00:00:00+09:00')])
        self.assertEqual(result['scenario_payment_krw'], 103000)
        self.assertEqual(result['excluded'][0]['reason'], 'outside-validity-window')

    def test_start_inclusive_end_exclusive_in_different_timezones(self):
        event = rule(starts_at='2026-11-20T12:00:00+00:00', ends_at='2026-11-20T13:00:00+00:00')
        self.assertEqual(len(self.calculate([event])['applied']), 1)
        self.assertEqual(len(self.calculate([event], now=NOW + timedelta(hours=1))['applied']), 0)

    def test_future_event_is_not_active(self):
        self.assertEqual(self.calculate([rule(starts_at='2026-11-20T22:00:00+09:00')])['scenario_payment_krw'], 103000)

    def test_unknown_or_different_card_does_not_become_unconditional_price(self):
        for context in ({}, {'card_issuer': 'Different card'}):
            result = self.calculate([card()], context=context)
            self.assertEqual(result['scenario_payment_krw'], 103000)
            self.assertFalse(result['applied'])

    def test_mutual_stacking_confirmation_is_required(self):
        for coupon in (rule(), rule(stackable_with=['different-card'])):
            result = self.calculate([coupon, card()], context={'card_issuer': 'Synthetic card'})
            self.assertEqual(result['scenario_payment_krw'], 93000)
            self.assertEqual(result['excluded'][0]['reason'], 'stacking-not-confirmed')

    def test_scope_must_match_listing_variant_and_seller(self):
        for key in ('listing_id', 'variant_id', 'seller'):
            self.assertFalse(self.calculate([rule(**{key: 'different'})])['applied'])

    def test_verified_recent_read_does_not_refresh_stale_source_observation(self):
        stale = offer(source_observed_at='2026-11-18T20:00:00+09:00')
        result = self.calculate(item=stale)
        self.assertEqual(result['reason'], 'stale-source-observation')
        self.assertIsNone(result['scenario_payment_krw'])

    def test_cached_unknown_soldout_shipping_or_option_unverified_offers_are_blocked(self):
        for changes in ({'source_kind': 'cached'}, {'availability': 'unknown'}, {'availability': 'sold-out'},
                        {'shipping_krw': None}, {'selected_options_verified': False}, {'verified_at': None},
                        {'quantity': 2}, {'currency': 'USD'}):
            result = self.calculate(item=offer(**changes))
            self.assertEqual(result['state'], 'blocked')
            self.assertIsNone(result['ordinary_delivered_krw'])

    def test_unknown_terms_cached_or_stale_benefits_are_excluded(self):
        for changes in ({'terms_verified': False}, {'verified_at': None}, {'source_kind': 'cached'},
                        {'source_observed_at': '2026-11-18T20:00:00+09:00'}):
            self.assertFalse(self.calculate([rule(**changes)])['applied'])

    def test_future_observation_or_verification_before_observation_is_blocked(self):
        for changes in ({'source_observed_at': '2026-11-20T22:00:00+09:00'},
                        {'verified_at': '2026-11-20T19:00:00+09:00'}):
            self.assertEqual(self.calculate(item=offer(**changes))['state'], 'blocked')

    def test_rate_rounding_must_be_explicit(self):
        for changes in ({'rounding': None}, {'rounding_stage': None}):
            rules = [rule('discount', kind='rate', value=1000, rounding='floor-won', rounding_stage='before-cap')]
            rules[0].update(changes)
            self.assertEqual(self.calculate(rules)['excluded'][0]['reason'], 'rounding-not-confirmed')

    def test_integer_rounding_and_original_vs_remaining_discount_basis(self):
        coupon = rule(stackable_with=['percentage'])
        rate = rule('percentage', priority=11, kind='rate', value=1234, rounding='floor-ten-won', rounding_stage='before-cap', stackable_with=['coupon'])
        result = self.calculate([coupon, rate])
        self.assertEqual(result['applied'][1]['discount_krw'], 11100)
        rate['discount_basis'] = 'original-product'
        self.assertEqual(self.calculate([coupon, rate])['applied'][1]['discount_krw'], 12340)

    def test_minimum_spend_is_checked_after_coupon_when_declared(self):
        coupon = rule(stackable_with=['card']); promotion = card(minimum_basis='remaining-product', minimum_krw=95000)
        result = self.calculate([coupon, promotion], context={'card_issuer': 'Synthetic card'})
        self.assertEqual(result['scenario_payment_krw'], 93000)
        self.assertEqual(result['excluded'][0]['reason'], 'minimum-spend-not-met')

    def test_monthly_allowance_requires_known_remaining_uses_and_amount(self):
        promotion = rule(usage_scope='month')
        for context in ({}, {'usage': {'coupon': {'remaining_uses': 0, 'remaining_allowance': 5000}}}):
            self.assertFalse(self.calculate([promotion], context=context)['applied'])
        result = self.calculate([promotion], context={'usage': {'coupon': {'remaining_uses': 1, 'remaining_allowance': 2500}}})
        self.assertEqual(result['scenario_payment_krw'], 100500)
        self.assertTrue(result['personal_conditions_required'])

    def test_statement_cashback_and_points_do_not_reduce_checkout_amount(self):
        ids = ['coupon', 'statement', 'cashback', 'points']
        rules = [rule(id, effect=id if id != 'coupon' else 'coupon', value=1000,
                      priority=index * 10, stackable_with=[other for other in ids if other != id])
                 for index, id in enumerate(ids)]
        result = self.calculate(rules)
        self.assertEqual(result['scenario_payment_krw'], 102000)
        self.assertEqual([r['estimated_krw'] for r in result['post_payment_benefits']], [1000, 1000])
        self.assertEqual(result['points_benefits'][0]['estimated_points'], 1000)

    def test_unknown_condition_or_duplicate_rule_or_priority_is_rejected(self):
        for rules in ([rule(requirements={'unknown_condition': True})], [rule(), rule()], [rule(), rule('other')]):
            with self.assertRaises(ValueError): self.calculate(rules)

    def test_unsupported_order_is_rejected_instead_of_reordered_automatically(self):
        with self.assertRaises(ValueError):
            self.calculate([card(), rule(priority=30)])

    def test_invalid_money_rates_and_naive_times_do_not_get_coerced(self):
        for changes in ({'product_price_krw': True}, {'product_price_krw': '100000'},
                        {'shipping_krw': -1}, {'source_observed_at': '2026-11-20T20:00:00'}):
            with self.assertRaises(ValueError): self.calculate(item=offer(**changes))
        with self.assertRaises(ValueError): self.calculate([rule(kind='rate', value=10001)])

    def test_shipping_does_not_satisfy_a_product_only_minimum(self):
        result = self.calculate([rule(minimum_krw=102000)])
        self.assertEqual(result['scenario_payment_krw'], 103000)


if __name__ == '__main__': unittest.main()
