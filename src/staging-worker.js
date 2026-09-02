import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const ART_BUILD = '2026-09-02-1057';
const ART_PROXY_JS = `<script src="/features/art-search-proxy.js?v=${ART_BUILD}"></script>`;

function isHtmlRequest(request, response) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function normalizeArtworkTag(value) {
  return String(value || '')
    .trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9♀♂._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function safeProviderImageUrl(value) {
  const raw = String(value || '').trim();
  if (!/^https:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const allowed = /(^|\.)safebooru\.org$/.test(host) || /(^|\.)donmai\.us$/.test(host);
    if (!allowed) return '';
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(parsed.pathname)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function dedupeResults(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (!row?.url || seen.has(row.url)) return false;
    seen.add(row.url);
    return true;
  });
}

async function fetchDanbooru(tag, page) {
  const queries = [tag, `${tag}_(pokemon)`];
  const collected = [];
  for (const q of queries) {
    const params = new URLSearchParams({
      limit: '40',
      page: String(page + 1),
      tags: `${q} rating:g`
    });
    try {
      const r = await fetch(`https://danbooru.donmai.us/posts.json?${params.toString()}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Kaseys-Binder-Studio/2.7 artwork-search' },
        cf: { cacheTtl: 300, cacheEverything: true }
      });
      if (!r.ok) continue;
      const posts = await r.json();
      if (!Array.isArray(posts)) continue;
      for (const post of posts) {
        const file = safeProviderImageUrl(post?.large_file_url || post?.file_url);
        if (!file) continue;
        const thumb = safeProviderImageUrl(post?.preview_file_url) || file;
        collected.push({
          id: `danbooru-${post?.id || collected.length}`,
          url: file,
          thumb,
          width: Number(post?.image_width) || 0,
          height: Number(post?.image_height) || 0,
          tags: String(post?.tag_string || ''),
          source: 'Danbooru'
        });
      }
      if (collected.length >= 24) break;
    } catch {}
  }
  return dedupeResults(collected);
}

async function fetchSafebooru(tag, page) {
  const params = new URLSearchParams({
    page: 'dapi', s: 'post', q: 'index', json: '1',
    limit: '60', pid: String(page), tags: tag
  });
  try {
    const r = await fetch(`https://safebooru.org/index.php?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Kaseys-Binder-Studio/2.7 artwork-search' },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!r.ok) return [];
    const payload = await r.json();
    const posts = Array.isArray(payload) ? payload : (Array.isArray(payload?.post) ? payload.post : []);
    const rows = [];
    for (const post of posts) {
      const directory = String(post?.directory ?? '').trim();
      const image = String(post?.image ?? '').trim();
      const constructed = directory && image ? `https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}` : '';
      const thumbName = image ? `thumbnail_${image}` : '';
      const constructedThumb = directory && thumbName ? `https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbName)}` : '';
      const file = safeProviderImageUrl(post?.file_url || post?.sample_url || constructed);
      if (!file) continue;
      const thumb = safeProviderImageUrl(post?.preview_url || post?.sample_url || constructedThumb) || file;
      rows.push({
        id: `safebooru-${post?.id || rows.length}`,
        url: file,
        thumb,
        width: Number(post?.width) || 0,
        height: Number(post?.height) || 0,
        tags: String(post?.tags || ''),
        source: 'Safebooru'
      });
    }
    return dedupeResults(rows);
  } catch {
    return [];
  }
}

async function handleArtworkSearch(request) {
  const url = new URL(request.url);
  const tag = normalizeArtworkTag(url.searchParams.get('tag'));
  const page = Math.max(0, Math.min(1000, Number.parseInt(url.searchParams.get('page') || '0', 10) || 0));
  if (!tag || tag.length < 2) {
    return Response.json({ results: [], error: 'Missing artwork tag.' }, { status: 400 });
  }

  const [danbooru, safebooru] = await Promise.all([
    fetchDanbooru(tag, page),
    fetchSafebooru(tag, page)
  ]);
  const results = dedupeResults([...danbooru, ...safebooru]).slice(0, 80);

  return Response.json({
    results,
    page,
    tag,
    providers: { danbooru: danbooru.length, safebooru: safebooru.length }
  }, {
    headers: {
      'cache-control': 'no-store',
      'x-kbs-art-source': 'multi-provider-proxy',
      'x-kbs-art-build': ART_BUILD
    }
  });
}

function noStoreResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  headers.set('x-kbs-art-build', ART_BUILD);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/art-search') {
      return handleArtworkSearch(request);
    }

    if (request.method === 'GET' && (
      url.pathname === '/features/art-search-proxy.js' ||
      url.pathname === '/features/art-search-lab.js'
    )) {
      const asset = await env.ASSETS.fetch(request);
      return noStoreResponse(asset);
    }

    const response = await productionWorker.fetch(request, env, ctx);
    if (!isHtmlRequest(request, response)) return response;

    let html = await response.text();
    html = html.replace(
      '<script src="features/art-search-lab.js"></script>',
      `${ART_PROXY_JS}\n<script src="features/art-search-lab.js?v=${ART_BUILD}"></script>`
    );
    if (!html.includes('features/cloud-sync.css')) {
      html = html.replace('</head>', `  ${CLOUD_CSS}\n</head>`);
    }
    if (!html.includes('features/cloud-sync.js')) {
      html = html.replace('</body>', `  ${CLOUD_JS}\n</body>`);
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
    headers.set('x-kbs-staging', 'auth-baseline');
    headers.set('x-kbs-art-build', ART_BUILD);
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
