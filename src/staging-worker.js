import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const ART_PROXY_JS = '<script src="/features/art-search-proxy.js"></script>';

function isHtmlRequest(request, response) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function normalizeArtworkTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9♀♂._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function safeImageUrl(value) {
  const url = String(value || '').trim();
  if (!/^https:\/\//i.test(url)) return '';
  try {
    const parsed = new URL(url);
    if (!/(^|\.)safebooru\.org$/i.test(parsed.hostname)) return '';
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(parsed.pathname)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

async function handleArtworkSearch(request) {
  const url = new URL(request.url);
  const tag = normalizeArtworkTag(url.searchParams.get('tag'));
  const page = Math.max(0, Math.min(1000, Number.parseInt(url.searchParams.get('page') || '0', 10) || 0));
  if (!tag || tag.length < 2) {
    return Response.json({ results: [], error: 'Missing artwork tag.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    page: 'dapi',
    s: 'post',
    q: 'index',
    json: '1',
    limit: '60',
    pid: String(page),
    tags: tag
  });

  try {
    const upstream = await fetch(`https://safebooru.org/index.php?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Kaseys-Binder-Studio/2.7 artwork-search'
      },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!upstream.ok) {
      return Response.json({ results: [], error: `Artwork provider returned ${upstream.status}.` }, {
        status: 502,
        headers: { 'cache-control': 'no-store' }
      });
    }

    const payload = await upstream.json();
    const posts = Array.isArray(payload) ? payload : (Array.isArray(payload?.post) ? payload.post : []);
    const seen = new Set();
    const results = [];

    for (const post of posts) {
      const directory = String(post?.directory ?? '').trim();
      const image = String(post?.image ?? '').trim();
      const constructed = directory && image
        ? `https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}`
        : '';
      const thumbnailName = image ? `thumbnail_${image}` : '';
      const constructedThumb = directory && thumbnailName
        ? `https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbnailName)}`
        : '';

      const file = safeImageUrl(post?.file_url || post?.sample_url || constructed);
      if (!file || seen.has(file)) continue;
      seen.add(file);

      const thumb = safeImageUrl(post?.preview_url || post?.sample_url || constructedThumb) || file;
      results.push({
        id: String(post?.id || `${page}-${results.length}`),
        url: file,
        thumb,
        width: Number(post?.width) || 0,
        height: Number(post?.height) || 0,
        tags: String(post?.tags || ''),
        source: 'Safebooru'
      });
    }

    return Response.json({ results, page, tag, upstreamCount: posts.length }, {
      headers: {
        'cache-control': 'public, max-age=120',
        'x-kbs-art-source': 'safebooru-proxy'
      }
    });
  } catch (error) {
    return Response.json({ results: [], error: 'Artwork search is temporarily unavailable.' }, {
      status: 502,
      headers: { 'cache-control': 'no-store' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/art-search') {
      return handleArtworkSearch(request);
    }

    const response = await productionWorker.fetch(request, env, ctx);
    if (!isHtmlRequest(request, response)) return response;

    let html = await response.text();
    if (!html.includes('features/cloud-sync.css')) {
      html = html.replace('</head>', `  ${CLOUD_CSS}\n</head>`);
    }
    if (!html.includes('features/art-search-proxy.js')) {
      html = html.replace(
        '<script src="features/art-search-lab.js"></script>',
        `  ${ART_PROXY_JS}\n<script src="features/art-search-lab.js"></script>`
      );
    }
    if (!html.includes('features/cloud-sync.js')) {
      html = html.replace('</body>', `  ${CLOUD_JS}\n</body>`);
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store');
    headers.set('x-kbs-staging', 'auth-baseline');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
