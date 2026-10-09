export function canonicalSourceUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Public HTTP source URL required.');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|igshid|si)$/i.test(key)) url.searchParams.delete(key);
  if (/^(www\.)?threads\.(net|com)$/.test(url.hostname)) {
    url.hostname = 'www.threads.com'; url.protocol = 'https:'; url.search = '';
    url.pathname = url.pathname.replace(/\/$/, '');
  }
  if (['youtu.be', 'www.youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    const id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1)
      : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube.com/watch?v=${id}`;
  }
  url.searchParams.sort();
  return url.href;
}

export function importSourceType(url) {
  const canonical = canonicalSourceUrl(url);
  if (/^https:\/\/www\.threads\.com\/@[^/]+\/post\/[^/?]+$/.test(canonical)) return 'threads';
  if (/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(canonical)) return 'youtube';
  throw new Error('Setup supports selected Threads posts and YouTube videos only.');
}
