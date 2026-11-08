// Network reads for Go Make Money, kept apart from go-make-money.mjs, which
// starts the judge process. One rule for every bundled script: a file that
// talks to the network never starts processes, and the reverse.
//
// fetchPublicPage reads one public page with no cookies or sign-in and returns
// its HTML; the caller turns it into text.
export async function fetchPublicPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (go-make-money; public page read)', accept: 'text/html' },
  });
  return { ok: response.ok, status: response.status, finalUrl: response.url, html: await response.text() };
}
