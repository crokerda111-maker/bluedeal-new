const LINK_RE = /(https?:\/\/[^\s<>"']+|\/go\/[A-Za-z0-9_-]{2,64}(?![A-Za-z0-9_-]))/gi;

export function textLinkParts(text: string): Array<{ text: string; href?: string }> {
  return text.split(LINK_RE).flatMap((part, index) => {
    if (index % 2 === 0 || (!part.startsWith('/go/') && !/^https?:\/\//i.test(part))) return [{ text: part }];
    let href = part;
    let trailing = '';
    while (href.length && /[.,;:!?]$/.test(href)) {
      trailing = href.slice(-1) + trailing;
      href = href.slice(0, -1);
    }
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      let balance = 0;
      for (const char of href) balance += char === open ? 1 : char === close ? -1 : 0;
      while (href.endsWith(close) && balance < 0) {
        trailing = close + trailing;
        href = href.slice(0, -1);
        balance += 1;
      }
    }
    return [{ text: href, href }, ...(trailing ? [{ text: trailing }] : [])];
  });
}
