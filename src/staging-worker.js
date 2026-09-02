import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const STAGING_BUILD = '2.8.1-art-image-proxy';
const ART_IMAGE_HOSTS = new Set(['cdn.donmai.us','raw.githubusercontent.com']);

function isHtmlRequest(request, response) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function noStoreResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  headers.set('x-kbs-staging-build', STAGING_BUILD);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function validArtworkSource(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'https:' || !ART_IMAGE_HOSTS.has(u.hostname.toLowerCase())) return null;
    if (u.hostname.toLowerCase() === 'raw.githubusercontent.com' && !u.pathname.startsWith('/PokeAPI/sprites/')) return null;
    if (!/\.(?:png|jpe?g|webp|gif)$/i.test(u.pathname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function handleArtworkImage(request) {
  const reqUrl = new URL(request.url);
  const target = validArtworkSource(reqUrl.searchParams.get('src'));
  if (!target) return new Response('Invalid artwork source', { status: 400 });

  try {
    const upstream = await fetch(target.href, {
      headers: {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Kaseys-Binder-Studio/2.8 artwork-image-proxy'
      },
      cf: { cacheEverything: true, cacheTtl: 86400 }
    });
    if (!upstream.ok) return new Response(`Artwork upstream HTTP ${upstream.status}`, { status: 502 });
    const type = upstream.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('image/')) return new Response('Artwork upstream was not an image', { status: 502 });

    const headers = new Headers();
    headers.set('content-type', type);
    headers.set('cache-control', 'public, max-age=86400, immutable');
    headers.set('access-control-allow-origin', '*');
    headers.set('cross-origin-resource-policy', 'same-origin');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('x-kbs-art-image', 'proxied');
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return new Response(`Artwork image fetch failed: ${error?.message || 'network error'}`, { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/art-image') {
      return handleArtworkImage(request);
    }

    if (request.method === 'GET' && (
      url.pathname === '/features/art-search-lab.js' ||
      url.pathname === '/features/catalog-lab.js' ||
      url.pathname === '/features/mobile-lab.js'
    )) {
      return noStoreResponse(await env.ASSETS.fetch(request));
    }

    const response = await productionWorker.fetch(request, env, ctx);
    if (!isHtmlRequest(request, response)) return response;

    let html = await response.text();
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
    headers.set('x-kbs-staging-build', STAGING_BUILD);
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
