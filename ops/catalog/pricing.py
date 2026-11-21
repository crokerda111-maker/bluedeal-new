"""Conservative single-item benefit calculation, never a checkout confirmation.

Adapters must supply verified rules; this module does not scrape, infer terms,
optimize baskets or reuse a daily/monthly allowance across separate quotes.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

CONDITIONS = frozenset({'card_issuer', 'card_type', 'wallet', 'membership', 'app',
                        'coupon_owned', 'first_purchase', 'performance_met', 'installment'})
EFFECTS = {'coupon': 0, 'instant-card': 1, 'statement': 2, 'cashback': 2, 'points': 3}
DIRECT_SOURCES = {'direct', 'official-api'}


def _integer(value, name, minimum=0, maximum=10**12):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError('INVALID_' + name)
    return value


def _time(value):
    try:
        result = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError('INVALID_TIMESTAMP') from None
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError('TIMESTAMP_REQUIRES_TIMEZONE')
    return result.astimezone(timezone.utc)


def _url(value):
    try:
        parsed = urlsplit(value)
        valid = parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password and not parsed.port
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise ValueError('INVALID_PUBLIC_EVIDENCE_URL')


def _freshness(record, now, max_age):
    if record.get('source_kind') not in DIRECT_SOURCES:
        return 'source-not-direct'
    if record.get('verified_at') is None or record.get('source_observed_at') is None:
        return 'observation-not-verified'
    observed = _time(record['source_observed_at']); verified = _time(record['verified_at'])
    if observed > now or verified > now or verified < observed:
        return 'invalid-observation-order'
    if now - observed > max_age:
        return 'stale-source-observation'
    return None


def _validate_rule(rule):
    for field in ('id', 'listing_id', 'variant_id', 'seller'):
        if not isinstance(rule.get(field), str) or not rule[field].strip():
            raise ValueError('MISSING_RULE_SCOPE')
    if rule.get('effect') not in EFFECTS or rule.get('kind') not in {'fixed', 'rate'}:
        raise ValueError('UNSUPPORTED_BENEFIT_TYPE')
    _integer(rule.get('priority'), 'PRIORITY')
    _integer(rule.get('value'), 'BENEFIT_VALUE', maximum=10000 if rule['kind'] == 'rate' else 10**12)
    _integer(rule.get('minimum_krw'), 'MINIMUM_SPEND')
    if rule.get('cap') is not None:
        _integer(rule['cap'], 'CAP')
    if rule.get('minimum_basis') not in {'original-product', 'remaining-product'}:
        raise ValueError('UNSUPPORTED_MINIMUM_BASIS')
    if rule.get('discount_basis') not in {'original-product', 'remaining-product'}:
        raise ValueError('UNSUPPORTED_DISCOUNT_BASIS')
    if rule.get('usage_scope') not in {'order', 'day', 'month'}:
        raise ValueError('UNSUPPORTED_USAGE_SCOPE')
    if rule.get('rounding') not in {None, 'floor-won', 'floor-ten-won'}:
        raise ValueError('UNSUPPORTED_ROUNDING')
    if rule.get('rounding_stage') not in {None, 'before-cap'}:
        raise ValueError('UNSUPPORTED_ROUNDING_STAGE')
    requirements = rule.get('requirements')
    if not isinstance(requirements, dict) or set(requirements) - CONDITIONS:
        raise ValueError('UNSUPPORTED_ELIGIBILITY_CONDITION')
    if any(type(value) not in (str, bool) for value in requirements.values()):
        raise ValueError('INVALID_ELIGIBILITY_VALUE')
    stackable = rule.get('stackable_with')
    if not isinstance(stackable, list) or any(not isinstance(item, str) for item in stackable):
        raise ValueError('INVALID_STACKING_TERMS')
    _url(rule.get('evidence_url'))
    if _time(rule.get('starts_at')) >= _time(rule.get('ends_at')):
        raise ValueError('INVALID_BENEFIT_WINDOW')


def quote(offer, rules, *, now, context=None, max_age=timedelta(hours=24)):
    """Evaluate one explicit rule chain for one unit; no global cheapest claim.

    Rate values use integer basis points (1000 = 10%). End instants are exclusive.
    Unknown eligibility, stacking, usage balance or rounding excludes that rule.
    Shipping must be known for the selected destination. Post-payment benefits
    and points remain separate and never reduce the quoted payment amount.
    """
    if now.tzinfo is None or now.utcoffset() is None or max_age <= timedelta(0):
        raise ValueError('INVALID_QUOTE_CLOCK')
    now = now.astimezone(timezone.utc)
    context = context or {}
    if not isinstance(context, dict) or set(context) - (CONDITIONS | {'usage'}):
        raise ValueError('UNSUPPORTED_CONTEXT')
    for key, value in context.items():
        if key != 'usage' and type(value) not in (str, bool):
            raise ValueError('INVALID_CONTEXT_VALUE')
    if not isinstance(context.get('usage', {}), dict):
        raise ValueError('INVALID_USAGE_CONTEXT')
    if len(rules) > 20:
        raise ValueError('TOO_MANY_RULES')
    for rule in rules:
        _validate_rule(rule)
    if len({r['id'] for r in rules}) != len(rules) or len({r['priority'] for r in rules}) != len(rules):
        raise ValueError('AMBIGUOUS_RULE_CHAIN')
    ordered = sorted(rules, key=lambda r: r['priority'])
    if [EFFECTS[r['effect']] for r in ordered] != sorted(EFFECTS[r['effect']] for r in ordered):
        raise ValueError('UNSUPPORTED_RULE_ORDER')
    product = _integer(offer.get('product_price_krw'), 'PRODUCT_PRICE', minimum=1)
    for field in ('listing_id', 'variant_id', 'seller'):
        if not isinstance(offer.get(field), str) or not offer[field].strip():
            raise ValueError('MISSING_OFFER_SCOPE')
    _url(offer.get('evidence_url'))
    reason = _freshness(offer, now, max_age)
    if not reason and (offer.get('currency') != 'KRW' or type(offer.get('quantity')) is not int or offer['quantity'] != 1):
        reason = 'only-single-unit-krw-supported'
    if not reason and offer.get('selected_options_verified') is not True:
        reason = 'selected-options-not-verified'
    if not reason and offer.get('availability') != 'in-stock':
        reason = 'stock-not-confirmed'
    if not reason and offer.get('shipping_krw') is None:
        reason = 'shipping-not-confirmed-for-destination'
    result = {'state': 'blocked' if reason else 'verified-observation', 'reason': reason,
              'price_observed_at': offer.get('source_observed_at'), 'quoted_at': now.isoformat(),
              'ordinary_delivered_krw': None, 'scenario_payment_krw': None,
              'personal_conditions_required': False, 'applied': [], 'excluded': [],
              'post_payment_benefits': [], 'points_benefits': [], 'checkout_confirmed': False,
              'scope': 'single-item-single-scenario-not-basket-optimum'}
    if reason:
        return result
    shipping = _integer(offer['shipping_krw'], 'SHIPPING')
    result['ordinary_delivered_krw'] = product + shipping
    remaining = product
    applied_rules = []
    for rule in ordered:
        rejection = None
        if any(rule[key] != offer.get(key) for key in ('listing_id', 'variant_id', 'seller')):
            rejection = 'listing-variant-or-seller-mismatch'
        elif rule.get('terms_verified') is not True:
            rejection = 'terms-not-verified'
        elif not _time(rule['starts_at']) <= now < _time(rule['ends_at']):
            rejection = 'outside-validity-window'
        else:
            rejection = _freshness(rule, now, max_age)
        if not rejection:
            for condition, required in rule['requirements'].items():
                if condition not in context:
                    rejection = 'personal-condition-unknown'; break
                if type(context[condition]) is not type(required) or context[condition] != required:
                    rejection = 'personal-condition-not-met'; break
        if not rejection and any(old['id'] not in rule['stackable_with'] or rule['id'] not in old['stackable_with'] for old in applied_rules):
            rejection = 'stacking-not-confirmed'
        minimum_base = product if rule['minimum_basis'] == 'original-product' else remaining
        if not rejection and minimum_base < rule['minimum_krw']:
            rejection = 'minimum-spend-not-met'
        if not rejection and rule['kind'] == 'rate' and (rule['rounding'] is None or rule['rounding_stage'] is None):
            rejection = 'rounding-not-confirmed'
        usage_budget = None
        if not rejection and rule['usage_scope'] != 'order':
            usage = context.get('usage', {}).get(rule['id'])
            if not isinstance(usage, dict) or 'remaining_uses' not in usage or 'remaining_allowance' not in usage:
                rejection = 'personal-usage-balance-unknown'
            else:
                uses = _integer(usage['remaining_uses'], 'REMAINING_USES')
                usage_budget = _integer(usage['remaining_allowance'], 'REMAINING_ALLOWANCE')
                if uses == 0 or usage_budget == 0:
                    rejection = 'personal-usage-exhausted'
        if rejection:
            result['excluded'].append({'id': rule['id'], 'reason': rejection})
            continue
        discount_base = product if rule['discount_basis'] == 'original-product' else remaining
        amount = rule['value'] if rule['kind'] == 'fixed' else discount_base * rule['value'] // 10000
        if rule['kind'] == 'rate' and rule['rounding'] == 'floor-ten-won':
            amount = amount // 10 * 10
        if rule.get('cap') is not None:
            amount = min(amount, rule['cap'])
        if usage_budget is not None:
            amount = min(amount, usage_budget)
        if rule['effect'] != 'points':
            amount = min(amount, remaining)
        entry = {'id': rule['id'], 'effect': rule['effect'], 'evidence_url': rule['evidence_url']}
        if rule['effect'] == 'points':
            result['points_benefits'].append({**entry, 'estimated_points': amount})
        elif rule['effect'] in {'statement', 'cashback'}:
            result['post_payment_benefits'].append({**entry, 'estimated_krw': amount})
        else:
            remaining -= amount
            result['applied'].append({**entry, 'discount_krw': amount})
        result['personal_conditions_required'] |= bool(rule['requirements']) or rule['usage_scope'] != 'order'
        applied_rules.append(rule)
    result['scenario_payment_krw'] = remaining + shipping
    return result
