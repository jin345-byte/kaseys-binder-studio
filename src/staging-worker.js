import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';

function isHtmlRequest(request, response) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

export default {
  async fetch(request, env, ctx) {
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
    headers.set('cache-control', 'no-store');
    headers.set('x-kbs-staging', 'auth-baseline');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
