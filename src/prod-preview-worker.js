import stagingWorker from './staging-worker.js';

const PREVIEW_BUILD='2.9.9-canonical-character-art-read-only';
const PREVIEW_ENVIRONMENT='prod-db-compat-preview';
const SAFE_STAGING_GET_APIS=new Set(['/api/art-image','/api/art-feed','/api/art-feed-v2','/api/card-search']);

const POKEMON_CHARACTER_ALIASES={
  'ash':'satoshi_(pokemon)','ash ketchum':'satoshi_(pokemon)',
  'misty':'kasumi_(pokemon)','brock':'takeshi_(pokemon)',
  'may':'haruka_(pokemon)','dawn':'hikari_(pokemon)',
  'cynthia':'shirona_(pokemon)','leon':'dande_(pokemon)',
  'marnie':'mary_(pokemon)','nessa':'rurina_(pokemon)',
  'bea':'saitou_(pokemon)','raihan':'kibana_(pokemon)',
  'iono':'nanjamo_(pokemon)','nemona':'nemo_(pokemon)',
  'penny':'botan_(pokemon)','jessie':'musashi_(pokemon)',
  'james':'kojirou_(pokemon)','giovanni':'sakaki_(pokemon)',
  'sabrina':'natsume_(pokemon)','skyla':'fuuro_(pokemon)',
  'elesa':'kamitsure_(pokemon)','roxie':'homika_(pokemon)',
  'steven stone':'daigo_(pokemon)','lance':'wataru_(pokemon)',
  'professor oak':'ookido_yukinari'
};
const CHARACTER_CANONICAL_ALIASES={
  'satoru gojo':['gojou_satoru'],
  'gojo satoru':['gojou_satoru']
};

const previewJson=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0','x-kbs-preview-read-only':'1',...extra}});
function cookies(request){const out={};for(const part of(request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>-1)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
async function sha(value){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return[...digest].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function readOnlySessionUser(request,env){
  if(!env.DB)return null;
  const token=cookies(request).kbs_session;if(!token)return null;
  const tokenHash=await sha(token);
  const row=await env.DB.prepare('SELECT u.id,u.email,u.display_name,u.picture_url,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1').bind(tokenHash).first();
  if(!row||Number(row.expires_at)<=Date.now())return null;
  return{id:row.id,email:row.email,name:row.display_name,picture:row.picture_url};
}
async function readOnlyPreviewApi(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/config')return previewJson({googleClientId:'',databaseReady:Boolean(env.DB),authReady:false,productionAuthConfigured:Boolean(env.DB&&env.GOOGLE_CLIENT_ID),syncVersion:2,previewReadOnly:true,previewEnvironment:PREVIEW_ENVIRONMENT});
  if(path==='/api/me')return previewJson({authenticated:false,user:null,previewReadOnly:true,previewEnvironment:PREVIEW_ENVIRONMENT});
  if(path==='/api/sync'){
    if(!env.DB)return previewJson({error:'Cloud database is not connected.',previewReadOnly:true},503);
    const user=await readOnlySessionUser(request,env);if(!user)return previewJson({error:'Sign in required.',previewReadOnly:true},401);
    if(url.searchParams.get('meta')==='1'){
      const row=await env.DB.prepare('SELECT updated_at,revision FROM binder_snapshots WHERE user_id=?1').bind(user.id).first();
      return previewJson({snapshot:row?{updatedAt:row.updated_at,revision:row.revision}:null,previewReadOnly:true});
    }
    const row=await env.DB.prepare('SELECT payload,encoding,updated_at,revision FROM binder_snapshots WHERE user_id=?1').bind(user.id).first();
    return previewJson({snapshot:row?{payload:row.payload,encoding:row.encoding,updatedAt:row.updated_at,revision:row.revision}:null,previewReadOnly:true});
  }
  return previewJson({error:'Preview API endpoint not available.',previewReadOnly:true},404);
}
function blockedPreviewMutation(request){
  const url=new URL(request.url);
  return url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method.toUpperCase());
}

function tidyQuery(raw){return String(raw||'').trim().replace(/\s+/g,' ').slice(0,120)}
function normalizedKey(raw){return tidyQuery(raw).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'')}
function reversedTwoPartName(raw){
  const clean=tidyQuery(raw);
  const parts=clean.split(' ').filter(Boolean);
  if(parts.length!==2)return '';
  if(!parts.every(part=>/^[\p{L}\p{N}.'’\-]+$/u.test(part)))return '';
  if(parts.some(part=>['from','the','and','of','pokemon','pokémon','anime','manga','trainer','champion'].includes(normalizedKey(part))))return '';
  return `${parts[1]} ${parts[0]}`;
}
function characterQueryPlan(raw){
  const original=tidyQuery(raw);if(!original)return [];
  const key=normalizedKey(original),canonical=CHARACTER_CANONICAL_ALIASES[key]||[];
  const fromMatch=original.match(/^(.+?)\s+from\s+(.+)$/i);
  if(fromMatch){
    const character=tidyQuery(fromMatch[1]),series=tidyQuery(fromMatch[2]);
    if(character&&series){
      const reversed=reversedTwoPartName(character);
      return [...new Set([original,`${character} (${series})`,reversed?`${reversed} (${series})`:''].filter(Boolean))].slice(0,2);
    }
  }
  const pokemonHint=/\b(?:pokemon|pokémon|gym\s*leader|trainer|champion|elite\s*four|professor)\b/i.test(original);
  const stripped=tidyQuery(original.replace(/\b(?:pokemon|pokémon|gym\s*leader|trainer|champion|elite\s*four|anime|cartoon|animated|character)\b/gi,' '));
  const alias=POKEMON_CHARACTER_ALIASES[key]||POKEMON_CHARACTER_ALIASES[normalizedKey(stripped)];
  if(pokemonHint&&stripped){
    const qualified=`${stripped} (pokemon)`;
    return [...new Set(alias?[alias,qualified]:[original,qualified])].slice(0,2);
  }
  if(alias)return [...new Set([original,alias])].slice(0,2);
  if(stripped&&stripped.toLowerCase()!==original.toLowerCase())return [...new Set([original,stripped,...canonical])];
  const reversed=reversedTwoPartName(original);
  if(reversed&&normalizedKey(reversed)!==key)return [...new Set([original,reversed,...canonical])];
  return [...new Set([original,...canonical])];
}

async function callArtV2(request,env,ctx,query,pid){
  const u=new URL(request.url);u.pathname='/api/art-feed-v2';u.search='';u.searchParams.set('tag',query);u.searchParams.set('pid',String(pid));
  const inner=new Request(u.href,{method:'GET',headers:{accept:'application/json'}});
  const response=await stagingWorker.fetch(inner,env,ctx);
  let payload={};try{payload=await response.json()}catch{}
  return {query,response,payload};
}
function hasArtResults(item){return Array.isArray(item?.payload?.results)&&item.payload.results.length>0}
async function fetchVariantResilient(request,env,ctx,query,pid){
  let item=await callArtV2(request,env,ctx,query,pid);
  if(hasArtResults(item))return item;
  /* Character sources can intermittently return an empty page while another
     spelling/order works. Retry once so reversed Japanese/Western name order
     does not turn a transient upstream miss into an empty Binder Studio result. */
  item=await callArtV2(request,env,ctx,query,pid);
  return item;
}

async function characterArtworkFeed(request,env,ctx){
  const u=new URL(request.url),raw=tidyQuery(u.searchParams.get('tag')||''),pid=Math.max(0,Number.parseInt(u.searchParams.get('pid')||'0',10)||0);
  const plan=characterQueryPlan(raw);
  if(!plan.length)return new Response(JSON.stringify({results:[],done:true,error:'Invalid artwork query'}),{status:400,headers:{'content-type':'application/json'}});

  /* Fetch variants sequentially. This avoids hammering the same upstream art
     source with two simultaneous name-order queries and makes alias/reversal
     fallback materially more reliable. */
  const fetched=[];
  for(const query of plan)fetched.push(await fetchVariantResilient(request,env,ctx,query,pid));
  const merged=[],seen=new Set(),sources={safebooru:0,zerochan:0};
  let zerochanConfigured=false,hadError=false;
  for(const {query,response,payload} of fetched){
    if(!response.ok)hadError=true;
    zerochanConfigured=zerochanConfigured||payload?.zerochanConfigured===true;
    for(const row of Array.isArray(payload?.results)?payload.results:[]){
      const key=String(row?.url||'');if(!key||seen.has(key))continue;
      seen.add(key);merged.push({...row,searchVariant:query});
      const source=String(row?.source||'').toLowerCase();
      if(source.includes('zerochan'))sources.zerochan++;else sources.safebooru++;
      if(merged.length>=120)break;
    }
    if(merged.length>=120)break;
  }

  return new Response(JSON.stringify({results:merged,pid,nextPid:pid+1,done:merged.length===0&&!hadError,broad:true,characterSearch:true,queryPlan:plan,zerochanConfigured,sourceCounts:sources,error:merged.length?'':(hadError?'One or more artwork sources are temporarily unavailable':'')}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-kbs-art-broad':'1','x-kbs-character-search':'1','x-kbs-zerochan-configured':zerochanConfigured?'1':'0'}});
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    let response;

    if(url.pathname.startsWith('/api/')){
      if(request.method==='OPTIONS')response=new Response(null,{status:204,headers:{allow:'GET, HEAD, OPTIONS'}});
      else if(blockedPreviewMutation(request))response=previewJson({error:'This staging preview is read-only. Production data was not changed.',previewReadOnly:true,previewEnvironment:PREVIEW_ENVIRONMENT},403);
      else if(request.method!=='GET')response=previewJson({error:'Preview API method not available.',previewReadOnly:true},405);
      else if(url.pathname==='/api/art-feed-v3')response=await characterArtworkFeed(request,env,ctx);
      else if(SAFE_STAGING_GET_APIS.has(url.pathname))response=await stagingWorker.fetch(request,env,ctx);
      else response=await readOnlyPreviewApi(request,env);
    }else response=await stagingWorker.fetch(request,env,ctx);

    const headers=new Headers(response.headers);
    headers.set('x-kbs-production-preview',PREVIEW_BUILD);
    headers.set('x-kbs-preview-read-only','1');
    headers.set('x-robots-tag','noindex, nofollow, noarchive');
    headers.set('x-content-type-options','nosniff');
    headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    headers.delete('content-length');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
