import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const STAGING_BUILD = '2.8.2-safebooru-cache';

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
