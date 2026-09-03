import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const STAGING_BUILD = '2.8.5-artwork-polish';
const ART_IMAGE_HOSTS = new Set(['cdn.donmai.us','safebooru.org','raw.githubusercontent.com']);

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
  return new Response(response.body, {status: response.status,statusText: response.statusText,headers});
}

async function artworkImage(request) {
  const source = new URL(request.url).searchParams.get('url') || '';
  let target;
  try { target = new URL(source); } catch { return new Response('Invalid image URL', {status:400}); }
  if (target.protocol !== 'https:' || !ART_IMAGE_HOSTS.has(target.hostname.toLowerCase())) {
    return new Response('Image host not allowed', {status:403});
  }
  try {
    const upstream = await fetch(target.href, {
      headers: {
        'accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8',
        'referer': target.hostname.toLowerCase()==='safebooru.org' ? 'https://safebooru.org/' : 'https://safebooru.donmai.us/'
      },
      cf:{cacheEverything:true,cacheTtl:86400}
    });
    if (!upstream.ok) return new Response(`Artwork upstream ${upstream.status}`, {status:502});
    const type = upstream.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return new Response('Artwork upstream was not an image', {status:502});
    const headers = new Headers();
    headers.set('content-type', type);
    headers.set('cache-control','public, max-age=86400, stale-while-revalidate=604800');
    headers.set('access-control-allow-origin','*');
    headers.set('x-content-type-options','nosniff');
    headers.set('x-kbs-art-image','proxy');
    return new Response(upstream.body,{status:200,headers});
  } catch (e) {
    console.error('Artwork image proxy failed', target.href, e);
    return new Response('Artwork image unavailable', {status:502});
  }
}

function artJson(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':status===200?'public, max-age=300':'no-store',
    'access-control-allow-origin':'*',
    'x-content-type-options':'nosniff',
    'x-kbs-art-feed':'proxy',
    ...extra
  }});
}

function normalizeSafebooruPosts(payload){
  const posts=Array.isArray(payload)?payload:(Array.isArray(payload?.post)?payload.post:[]);
  const rows=[],seen=new Set();
  for(const p of posts){
    const directory=String(p?.directory||'').trim();
    const image=String(p?.image||'').trim();
    const built=directory&&image?`https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}`:'';
    const thumbName=image?'thumbnail_'+image:'';
    const builtThumb=directory&&thumbName?`https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbName)}`:'';
    const url=String(p?.file_url||p?.sample_url||built||'').trim();
    const thumb=String(p?.preview_url||p?.sample_url||builtThumb||url||'').trim();
    if(!url.startsWith('https://safebooru.org/')||seen.has(url))continue;
    seen.add(url);
    rows.push({id:String(p?.id||''),url,thumb:thumb.startsWith('https://safebooru.org/')?thumb:url,width:Number(p?.width||0),height:Number(p?.height||0),source:'Safebooru fan art'});
  }
  return rows;
}

async function artworkFeed(request){
  const incoming=new URL(request.url);
  const tag=String(incoming.searchParams.get('tag')||'').trim().toLowerCase();
  const pid=Math.max(0,Number.parseInt(incoming.searchParams.get('pid')||'0',10)||0);
  if(!/^[a-z0-9_.♀♂-]{1,80}$/.test(tag))return artJson({results:[],done:true,error:'Invalid artwork tag'},400);
  const target=new URL('https://safebooru.org/index.php');
  target.searchParams.set('page','dapi');target.searchParams.set('s','post');target.searchParams.set('q','index');target.searchParams.set('json','1');target.searchParams.set('limit','40');target.searchParams.set('pid',String(pid));target.searchParams.set('tags',tag);
  try{
    const upstream=await fetch(target.href,{headers:{'accept':'application/json','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8'},cf:{cacheEverything:true,cacheTtl:300}});
    if(!upstream.ok)return artJson({results:[],done:false,error:`Artwork upstream ${upstream.status}`},200,{'x-kbs-art-upstream-status':String(upstream.status)});
    const rows=normalizeSafebooruPosts(await upstream.json());
    return artJson({results:rows,pid,nextPid:pid+1,done:rows.length===0});
  }catch(e){
    console.warn('Artwork feed upstream unavailable',e?.message||e);
    return artJson({results:[],done:false,error:'Artwork feed temporarily unavailable'},200,{'x-kbs-art-upstream-status':'network'});
  }
}

function emptyCardSearch(upstreamStatus='') {
  const headers = new Headers({
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'x-content-type-options':'nosniff',
    'x-kbs-card-search':'proxy'
  });
  if (upstreamStatus) headers.set('x-kbs-card-upstream-status', String(upstreamStatus));
  return new Response(JSON.stringify({data:[],page:1,pageSize:250,count:0,totalCount:0}),{status:200,headers});
}

async function cardSearch(request) {
  const incoming = new URL(request.url);
  const target = new URL('https://api.pokemontcg.io/v2/cards');
  target.search = incoming.search;
  try {
    const upstream = await fetch(target.href, {
      headers: {
        'accept':'application/json',
        'user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8'
      },
      cf:{cacheEverything:true,cacheTtl:300}
    });
    if (!upstream.ok) {
      try { await upstream.body?.cancel(); } catch {}
      return emptyCardSearch(upstream.status);
    }
    const headers = new Headers();
    headers.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    headers.set('cache-control', 'public, max-age=300');
    headers.set('access-control-allow-origin','*');
    headers.set('x-content-type-options','nosniff');
    headers.set('x-kbs-card-search','proxy');
    return new Response(upstream.body,{status:200,headers});
  } catch (e) {
    console.warn('Card search upstream unavailable; using empty staging fallback', e?.message || e);
    return emptyCardSearch('network');
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/art-image') return artworkImage(request);
    if (request.method === 'GET' && url.pathname === '/api/art-feed') return artworkFeed(request);
    if (request.method === 'GET' && url.pathname === '/api/card-search') return cardSearch(request);

    if (request.method === 'GET' && (
      url.pathname === '/features/art-search-lab.js' ||
      url.pathname === '/features/catalog-lab.js' ||
      url.pathname === '/features/mobile-lab.js' ||
      url.pathname === '/features/staging-fetch-shim.js' ||
      url.pathname === '/features/staging-polish.js' ||
      url.pathname === '/styles/staging-polish.css'
    )) return noStoreResponse(await env.ASSETS.fetch(request));

    const response = await productionWorker.fetch(request, env, ctx);
    if (!isHtmlRequest(request, response)) return response;

    let html = await response.text();
    if (!html.includes('features/cloud-sync.css')) html = html.replace('</head>', `  ${CLOUD_CSS}\n</head>`);
    if (!html.includes('features/cloud-sync.js')) html = html.replace('</body>', `  ${CLOUD_JS}\n</body>`);

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
    headers.set('x-kbs-staging', 'auth-baseline');
    headers.set('x-kbs-staging-build', STAGING_BUILD);
    return new Response(html, {status: response.status,statusText: response.statusText,headers});
  }
};
