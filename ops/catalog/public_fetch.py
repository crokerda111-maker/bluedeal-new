"""Small, bounded public manufacturer-list requests; no authentication or bypass."""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlsplit, urlencode
import re

from ops.hotdeals.robots import RobotsPolicy

USER_AGENT = 'BLUEDEAL-Catalog/0.1 (+https://bluedeal.co.kr/about)'


class SourceStopped(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class PublicFetch:
    def __init__(self, origin, *, opener=None, wait=time.sleep, clock=time.monotonic):
        parsed = urlsplit(origin)
        if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
            raise ValueError('INVALID_PUBLIC_ORIGIN')
        self.origin = f'https://{parsed.netloc}'
        self.opener = opener or urllib.request.build_opener(NoRedirect())
        self.wait = wait
        self.clock = clock
        self.last_request = None
        self.policy = None
        self.delay = 3.0

    def robots(self):
        raw, charset = self.get(self.origin + '/robots.txt', is_robots=True)
        self.policy = RobotsPolicy(raw.decode(charset or 'utf-8', errors='replace'), USER_AGENT)
        self.delay = max(self.delay, self.policy.delay)
        return self.policy

    def get(self, url, *, is_robots=False):
        return self._fetch(url, is_robots=is_robots)

    def read_coupon_list(self, goods_no, brand_code):
        """Read the anonymous coupon-list form observed on Seorin product pages.

        This endpoint displays terms. It does not download, issue or apply coupons.
        No other POST destination, account field or action is accepted.
        """
        if self.origin != 'https://www.seorinexpress.com' or not re.fullmatch(r'\d{10}', goods_no) or not re.fullmatch(r'\d{3,6}', brand_code):
            raise ValueError('INVALID_READ_ONLY_COUPON_FORM')
        data = urlencode({'goodsNo': goods_no, 'scmNo': '1', 'brandCd': brand_code}).encode('ascii')
        return self._fetch(self.origin + '/goods/layer_coupon_down.php', form_data=data)

    def _fetch(self, url, *, is_robots=False, form_data=None):
        if is_robots and url != self.origin + '/robots.txt':
            raise SourceStopped('invalid-robots-request')
        for _ in range(4):
            parsed = urlsplit(url)
            if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port or f'https://{parsed.netloc}' != self.origin:
                raise SourceStopped('cross-origin-redirect-stopped')
            if not is_robots and (self.policy is None or not self.policy.allowed(url)):
                raise SourceStopped('robots-denied')
            if self.last_request is not None:
                self.wait(max(0, self.delay - (self.clock() - self.last_request)))
            self.last_request = self.clock()
            headers = {'User-Agent': USER_AGENT, 'Accept': 'text/html,text/plain,application/xml;q=0.9'}
            if form_data is not None:
                headers['X-Requested-With'] = 'XMLHttpRequest'
            request = urllib.request.Request(url, data=form_data, headers=headers)
            try:
                with self.opener.open(request, timeout=25) as response:
                    body = response.read(8_000_001)
                    if len(body) > 8_000_000:
                        raise SourceStopped('response-too-large')
                    supported = ('text/html', 'text/plain', 'application/xhtml+xml', 'application/xml', 'text/xml') + (('application/json',) if form_data is not None else ())
                    if response.headers.get_content_type() not in supported:
                        raise SourceStopped('unsupported-content-type')
                    if len(body) < 20000 and any(marker in body.lower() for marker in (b'/_incapsula_resource', b'cf-chl-', b'checking your browser', b'verify you are human')):
                        raise SourceStopped('access-challenge-stopped')
                    return body, response.headers.get_content_charset()
            except urllib.error.HTTPError as error:
                if error.code in (301, 302, 303, 307, 308):
                    if form_data is not None:
                        raise SourceStopped('read-only-form-redirect-stopped') from None
                    url = urljoin(url, error.headers.get('Location', ''))
                    continue
                if is_robots and error.code == 404:
                    return b'', 'utf-8'
                raise SourceStopped(f'http-{error.code}-stopped') from None
            except (urllib.error.URLError, TimeoutError, OSError):
                raise SourceStopped('network-unavailable') from None
        raise SourceStopped('redirect-limit-stopped')
