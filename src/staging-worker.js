import productionWorker from './worker.js';

const CLOUD_CSS = '<link rel="stylesheet" href="/features/cloud-sync.css">';
const CLOUD_JS = '<script src="/features/cloud-sync.js"></script>';
const STAGING_287_CSS = '<link rel="stylesheet" href="/styles/staging-v287.css">';
const STAGING_287_JS = '<script src="/features/staging-v287.js"></script>';
const STAGING_BUILD = '2.8.7-tour-layout-polish';
const ART_IMAGE_HOSTS = new Set(['cdn.donmai.us','safebooru.org','raw.githubusercontent.com','cdn.artofpkm.com']);

function noStoreResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  headers.set('x-kbs-staging-build', STAGING_BUILD);
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}

async function decorateHtml(response){
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  if(!html.includes('features/cloud-sync.css'))html=html.replace('</head>',`  ${CLOUD_CSS}\n</head>`);
  if(!html.includes('styles/staging-v287.css'))html=html.replace('</head>',`  ${STAGING_287_CSS}\n</head>`);
  if(!html.includes('features/cloud-sync.js'))html=html.replace('</body>',`  ${CLOUD_JS}\n</body>`);
  if(!html.includes('features/staging-v287.js'))html=html.replace('</body>',`  ${STAGING_287_JS}\n</body>`);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-kbs-staging','auth-baseline');
  headers.set('x-kbs-staging-build',STAGING_BUILD);
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

function artworkRequestHeaders(hostname){
  const host=String(hostname||'').toLowerCase();
  const headers={'accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8'};
  if(host==='safebooru.org')headers.referer='https://safebooru.org/';
  else if(host==='cdn.donmai.us')headers.referer='https://safebooru.donmai.us/';
  return headers;
}

async function artworkImage(request){
  const source=new URL(request.url).searchParams.get('url')||'';
  let target;try{target=new URL(source)}catch{return new Response('Invalid image URL',{status:400})}
  const host=target.hostname.toLowerCase();
  if(target.protocol!=='https:'||!ART_IMAGE_HOSTS.has(host))return new Response('Image host not allowed',{status:403});
  try{
    const upstream=await fetch(target.href,{headers:artworkRequestHeaders(host),redirect:'follow',cf:{cacheEverything:true,cacheTtl:host==='cdn.artofpkm.com'?3600:86400}});
    if(!upstream.ok)return new Response(`Artwork upstream ${upstream.status}`,{status:502});
    const type=upstream.headers.get('content-type')||'';
    if(!type.toLowerCase().startsWith('image/'))return new Response('Artwork upstream was not an image',{status:502});
    const headers=new Headers({'content-type':type,'cache-control':host==='cdn.artofpkm.com'?'public, max-age=3600, stale-while-revalidate=86400':'public, max-age=86400, stale-while-revalidate=604800','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-art-image':'proxy','x-kbs-art-source':host});
    const length=upstream.headers.get('content-length');if(length)headers.set('x-kbs-art-upstream-length',length);
    return new Response(upstream.body,{status:200,headers});
  }catch(e){console.error('Artwork image proxy failed',target.href,e);return new Response('Artwork image unavailable',{status:502})}
}

function artJson(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=300':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-art-feed':'proxy',...extra}})}
function normalizeSafebooruPosts(payload){
  const posts=Array.isArray(payload)?payload:(Array.isArray(payload?.post)?payload.post:[]),rows=[],seen=new Set();
  for(const p of posts){const directory=String(p?.directory||'').trim(),image=String(p?.image||'').trim(),built=directory&&image?`https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}`:'',thumbName=image?'thumbnail_'+image:'',builtThumb=directory&&thumbName?`https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbName)}`:'',url=String(p?.file_url||p?.sample_url||built||'').trim(),thumb=String(p?.preview_url||p?.sample_url||builtThumb||url||'').trim();if(!url.startsWith('https://safebooru.org/')||seen.has(url))continue;seen.add(url);rows.push({id:String(p?.id||''),url,thumb:thumb.startsWith('https://safebooru.org/')?thumb:url,width:Number(p?.width||0),height:Number(p?.height||0),source:'Safebooru fan art'})}
  return rows;
}
async function artworkFeed(request){
  const incoming=new URL(request.url),tag=String(incoming.searchParams.get('tag')||'').trim().toLowerCase(),pid=Math.max(0,Number.parseInt(incoming.searchParams.get('pid')||'0',10)||0);
  if(!/^[a-z0-9_.♀♂-]{1,80}$/.test(tag))return artJson({results:[],done:true,error:'Invalid artwork tag'},400);
  const target=new URL('https://safebooru.org/index.php');for(const [k,v] of [['page','dapi'],['s','post'],['q','index'],['json','1'],['limit','40'],['pid',String(pid)],['tags',tag]])target.searchParams.set(k,v);
  try{const upstream=await fetch(target.href,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8'},cf:{cacheEverything:true,cacheTtl:300}});if(!upstream.ok)return artJson({results:[],done:false,error:`Artwork upstream ${upstream.status}`},200,{'x-kbs-art-upstream-status':String(upstream.status)});const rows=normalizeSafebooruPosts(await upstream.json());return artJson({results:rows,pid,nextPid:pid+1,done:rows.length===0})}catch(e){console.warn('Artwork feed upstream unavailable',e?.message||e);return artJson({results:[],done:false,error:'Artwork feed temporarily unavailable'},200,{'x-kbs-art-upstream-status':'network'})}
}
function emptyCardSearch(upstreamStatus=''){const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-card-search':'proxy'});if(upstreamStatus)headers.set('x-kbs-card-upstream-status',String(upstreamStatus));return new Response(JSON.stringify({data:[],page:1,pageSize:250,count:0,totalCount:0}),{status:200,headers})}
async function cardSearch(request){
  const incoming=new URL(request.url),target=new URL('https://api.pokemontcg.io/v2/cards');target.search=incoming.search;
  try{const upstream=await fetch(target.href,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.8'},cf:{cacheEverything:true,cacheTtl:300}});if(!upstream.ok){try{await upstream.body?.cancel()}catch{}return emptyCardSearch(upstream.status)}const headers=new Headers({'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'public, max-age=300','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-card-search':'proxy'});return new Response(upstream.body,{status:200,headers})}catch(e){console.warn('Card search upstream unavailable; using empty staging fallback',e?.message||e);return emptyCardSearch('network')}
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/api/art-image')return artworkImage(request);
    if(request.method==='GET'&&url.pathname==='/api/art-feed')return artworkFeed(request);
    if(request.method==='GET'&&url.pathname==='/api/card-search')return cardSearch(request);

    const noStorePaths=new Set(['/features/art-search-lab.js','/features/catalog-lab.js','/features/mobile-lab.js','/features/staging-fetch-shim.js','/features/staging-polish.js','/features/help-lab.js','/features/staging-v287.js','/styles/staging-polish.css','/styles/staging-v287.css']);
    if(request.method==='GET'&&noStorePaths.has(url.pathname))return noStoreResponse(await env.ASSETS.fetch(request));

    // Staging root is served directly from the asset binding so staging-only CSS/JS
    // cannot be bypassed by production routing/caching behavior.
    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return decorateHtml(await env.ASSETS.fetch(request));

    const response=await productionWorker.fetch(request,env,ctx);
    if(request.method==='GET'&&(response.headers.get('content-type')||'').includes('text/html'))return decorateHtml(response);
    return response;
  }
};
