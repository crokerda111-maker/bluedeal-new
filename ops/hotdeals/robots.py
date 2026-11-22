"""Robots path rules with wildcard, end-anchor and longest-rule precedence."""
from __future__ import annotations

import re
from urllib.parse import quote, urlsplit

UNRESERVED = frozenset('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~')


def normalized(value: str) -> str:
    value = quote(value, safe="/%?=&;:@!$'()*+,-._~")
    def replace(match):
        char = chr(int(match.group(1), 16))
        return char if char in UNRESERVED else '%' + match.group(1).upper()
    return re.sub(r'%([a-fA-F0-9]{2})', replace, value)


class RobotsPolicy:
    def __init__(self, text: str, user_agent: str):
        groups = []
        agents, rules, delays = [], [], []
        directives = False
        for line in text.lstrip('\ufeff').splitlines():
            line = line.split('#', 1)[0].strip()
            if ':' not in line:
                continue
            key, value = (part.strip() for part in line.split(':', 1))
            key = key.lower()
            if key == 'user-agent':
                if directives:
                    groups.append((agents, rules, delays))
                    agents, rules, delays, directives = [], [], [], False
                agents.append(value.lower())
            elif agents and key in ('allow', 'disallow', 'crawl-delay', 'request-rate'):
                directives = True
                if key in ('allow', 'disallow') and value:
                    rules.append((key == 'allow', normalized(value)))
                elif key == 'crawl-delay':
                    try:
                        delays.append(max(0, float(value)))
                    except ValueError:
                        pass
                elif key == 'request-rate' and re.fullmatch(r'\d+\s*/\s*\d+', value):
                    count, seconds = map(int, value.split('/'))
                    if count:
                        delays.append(seconds / count)
        if agents:
            groups.append((agents, rules, delays))
        scored = []
        for agents, rules, delays in groups:
            scores = [len(agent) for agent in agents if agent != '*' and agent in user_agent.lower()]
            score = max(scores, default=0 if '*' in agents else -1)
            scored.append((score, rules, delays))
        best = max((group[0] for group in scored), default=-1)
        self.rules = [rule for score, rules, _ in scored if score == best and score >= 0 for rule in rules]
        self.delay = max((delay for score, _, delays in scored if score == best and score >= 0 for delay in delays), default=0)

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        path = normalized((parts.path or '/') + ('?' + parts.query if parts.query else ''))
        matches = []
        for allow, pattern in self.rules:
            anchored = pattern.endswith('$')
            body = pattern[:-1] if anchored else pattern
            expression = '^' + '.*'.join(re.escape(part) for part in body.split('*')) + ('$' if anchored else '')
            if re.search(expression, path):
                specificity = len(body.replace('*', '').encode('utf-8'))
                matches.append((specificity, allow))
        return max(matches, default=(0, True))[1]
