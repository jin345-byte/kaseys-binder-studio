import productionWorker from './worker.js';

const STAGING_BUILD='2.9.0-phase123';
const ART_IMAGE_HOSTS=new Set(['cdn.donmai.us','safebooru.org','raw.githubusercontent.com','cdn.artofpkm.com']);

function noStoreResponse(response){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-kbs-staging-build',STAGING_BUILD);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function stagingHtml(response){
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-kbs-staging','phase123');
  headers.set('x-kbs-staging-build',STAGING_BUILD);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

function artworkRequestHeaders(hostname){
  const host=String(hostname||'').toLowerCase();
  const headers={'accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.9'};
  if(host==='safebooru.org')headers.referer='https://safebooru.org/';
  else if(host==='cdn.donmai.us')headers.referer='https://safebooru.donmai.us/';
  return headers;
}
function allowedArtworkUrl(raw){
  let u;try{u=new URL(raw)}catch{return null}
  if(u.protocol!=='https:'||!ART_IMAGE_HOSTS.has(u.hostname.toLowerCase()))return null;
  return u;
}
async function fetchAllowedArtwork(start){
  let target=start;
  for(let redirects=0;redirects<=3;redirects++){
    const upstream=await fetch(target.href,{headers:artworkRequestHeaders(target.hostname),redirect:'manual',cf:{cacheEverything:true,cacheTtl:target.hostname==='cdn.artofpkm.com'?3600:86400}});
    if(upstream.status>=300&&upstream.status<400){
      const location=upstream.headers.get('location');
      try{await upstream.body?.cancel()}catch{}
      if(!location)throw new Error('Artwork redirect had no destination');
      const next=allowedArtworkUrl(new URL(location,target).href);
      if(!next)throw new Error('Artwork redirect left the approved host list');
      target=next;continue;
    }
    return{upstream,target};
  }
  throw new Error('Too many artwork redirects');
}
async function artworkImage(request){
  const source=new URL(request.url).searchParams.get('url')||'';
  const target=allowedArtworkUrl(source);
  if(!target)return new Response('Image host not allowed',{status:403});
  try{
    const {upstream,target:finalTarget}=await fetchAllowedArtwork(target);
    if(!upstream.ok)return new Response(`Artwork upstream ${upstream.status}`,{status:502});
    const type=upstream.headers.get('content-type')||'';
    if(!type.toLowerCase().startsWith('image/'))return new Response('Artwork upstream was not an image',{status:502});
    const host=finalTarget.hostname.toLowerCase();
    const headers=new Headers({'content-type':type,'cache-control':host==='cdn.artofpkm.com'?'public, max-age=3600, stale-while-revalidate=86400':'public, max-age=86400, stale-while-revalidate=604800','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-art-image':'proxy','x-kbs-art-source':host});
    const length=upstream.headers.get('content-length');if(length)headers.set('x-kbs-art-upstream-length',length);
    return new Response(upstream.body,{status:200,headers});
  }catch(e){console.error('Artwork image proxy failed',target.href,e);return new Response('Artwork image unavailable',{status:502})}
}

function artJson(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=300':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-art-feed':'proxy',...extra}})}
function normalizeSafebooruPosts(payload){
  const posts=Array.isArray(payload)?payload:(Array.isArray(payload?.post)?payload.post:[]),rows=[],seen=new Set();
  for(const p of posts){
    const directory=String(p?.directory||'').trim(),image=String(p?.image||'').trim();
    const built=directory&&image?`https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}`:'';
    const thumbName=image?'thumbnail_'+image:'',builtThumb=directory&&thumbName?`https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbName)}`:'';
    const url=String(p?.file_url||p?.sample_url||built||'').trim(),thumb=String(p?.preview_url||p?.sample_url||builtThumb||url||'').trim();
    if(!url.startsWith('https://safebooru.org/')||seen.has(url))continue;
    seen.add(url);rows.push({id:String(p?.id||''),url,thumb:thumb.startsWith('https://safebooru.org/')?thumb:url,width:Number(p?.width||0),height:Number(p?.height||0),source:'Safebooru fan art'});
  }
  return rows;
}
async function artworkFeed(request){
  const incoming=new URL(request.url),tag=String(incoming.searchParams.get('tag')||'').trim().toLowerCase(),pid=Math.max(0,Number.parseInt(incoming.searchParams.get('pid')||'0',10)||0);
  if(!/^[a-z0-9_.♀♂-]{1,80}$/.test(tag))return artJson({results:[],done:true,error:'Invalid artwork tag'},400);
  const target=new URL('https://safebooru.org/index.php');for(const [k,v] of [['page','dapi'],['s','post'],['q','index'],['json','1'],['limit','40'],['pid',String(pid)],['tags',tag]])target.searchParams.set(k,v);
  try{const upstream=await fetch(target.href,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.9'},cf:{cacheEverything:true,cacheTtl:300}});if(!upstream.ok)return artJson({results:[],done:false,error:`Artwork upstream ${upstream.status}`},200,{'x-kbs-art-upstream-status':String(upstream.status)});const rows=normalizeSafebooruPosts(await upstream.json());return artJson({results:rows,pid,nextPid:pid+1,done:rows.length===0})}catch(e){console.warn('Artwork feed upstream unavailable',e?.message||e);return artJson({results:[],done:false,error:'Artwork feed temporarily unavailable'},200,{'x-kbs-art-upstream-status':'network'})}
}
function emptyCardSearch(upstreamStatus=''){const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-card-search':'proxy'});if(upstreamStatus)headers.set('x-kbs-card-upstream-status',String(upstreamStatus));return new Response(JSON.stringify({data:[],page:1,pageSize:250,count:0,totalCount:0}),{status:200,headers})}
async function cardSearch(request){
  const incoming=new URL(request.url),target=new URL('https://api.pokemontcg.io/v2/cards');target.search=incoming.search;
  try{const upstream=await fetch(target.href,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 Kaseys-Binder-Studio/2.9'},cf:{cacheEverything:true,cacheTtl:300}});if(!upstream.ok){try{await upstream.body?.cancel()}catch{}return emptyCardSearch(upstream.status)}const headers=new Headers({'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'public, max-age=300','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-kbs-card-search':'proxy'});return new Response(upstream.body,{status:200,headers})}catch(e){console.warn('Card search upstream unavailable; using empty staging fallback',e?.message||e);return emptyCardSearch('network')}
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/api/art-image')return artworkImage(request);
    if(request.method==='GET'&&url.pathname==='/api/art-feed')return artworkFeed(request);
    if(request.method==='GET'&&url.pathname==='/api/card-search')return cardSearch(request);

    const noStorePaths=new Set(['/art-search-lab.css','/style.css','/features/art-search-lab.js','/features/catalog-lab.js','/features/mobile-lab.js','/features/staging-fetch-shim.js','/features/staging-polish.js','/features/help-lab.js','/features/staging-v287.js','/features/artwork-height-sync.js','/features/prebuilt-catalog-bootstrap.js','/features/data-safety.js','/features/cloud-sync.js','/features/cloud-sync.css','/features/guided-tour-auto-library.js','/features/guided-tour-finish.js','/features/guided-tour-step16-fix.js','/features/guided-finish.css','/styles/staging-polish.css','/styles/staging-v287.css','/styles/staging-v288-fix.css','/styles/appearance-cleanup.css','/styles/mobile-lab.css','/styles/v2-visual.css']);
    if(request.method==='GET'&&noStorePaths.has(url.pathname))return noStoreResponse(await env.ASSETS.fetch(request));

    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return stagingHtml(await env.ASSETS.fetch(request));

    const response=await productionWorker.fetch(request,env,ctx);
    if(request.method==='GET'&&(response.headers.get('content-type')||'').includes('text/html'))return stagingHtml(response);
    return response;
  }
};
