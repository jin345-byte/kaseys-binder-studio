import stagingWorker from './staging-worker.js';

const PREVIEW_BUILD='2.9.7-name-order-resilient-prod-db-live-auth';

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
  const key=normalizedKey(original);
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
  if(stripped&&stripped.toLowerCase()!==original.toLowerCase())return [original,stripped];
  const reversed=reversedTwoPartName(original);
  if(reversed&&normalizedKey(reversed)!==key)return [original,reversed];
  return [original];
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
    const response=request.method==='GET'&&url.pathname==='/api/art-feed-v3'
      ?await characterArtworkFeed(request,env,ctx)
      :await stagingWorker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);
    headers.set('x-kbs-production-preview',PREVIEW_BUILD);
    headers.set('cache-control','no-store');
    headers.delete('content-length');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
