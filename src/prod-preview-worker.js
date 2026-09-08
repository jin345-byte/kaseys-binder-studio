import stagingWorker from './staging-worker.js';

const PREVIEW_BUILD='2.9.4-character-search-prod-db-live-auth';

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
function characterQueryPlan(raw){
  const original=tidyQuery(raw);if(!original)return [];
  const key=normalizedKey(original);
  const out=[original];

  const fromMatch=original.match(/^(.+?)\s+from\s+(.+)$/i);
  if(fromMatch){
    const character=tidyQuery(fromMatch[1]),series=tidyQuery(fromMatch[2]);
    if(character&&series)out.push(`${character} (${series})`);
  }

  const pokemonHint=/\b(?:pokemon|pokémon|gym\s*leader|trainer|champion|elite\s*four|professor)\b/i.test(original);
  const stripped=tidyQuery(original.replace(/\b(?:pokemon|pokémon|gym\s*leader|trainer|champion|elite\s*four|anime|cartoon|animated|character)\b/gi,' '));
  const alias=POKEMON_CHARACTER_ALIASES[key]||POKEMON_CHARACTER_ALIASES[normalizedKey(stripped)];
  if(alias)out.push(alias);
  if(pokemonHint&&stripped)out.push(`${stripped} (pokemon)`);
  if(stripped&&stripped.toLowerCase()!==original.toLowerCase())out.push(stripped);

  return [...new Set(out.filter(Boolean))].slice(0,3);
}

async function callArtV2(request,env,ctx,query,pid){
  const u=new URL(request.url);u.pathname='/api/art-feed-v2';u.search='';u.searchParams.set('tag',query);u.searchParams.set('pid',String(pid));
  const inner=new Request(u.href,{method:'GET',headers:{accept:'application/json'}});
  const response=await stagingWorker.fetch(inner,env,ctx);
  let payload={};try{payload=await response.json()}catch{}
  return {response,payload};
}

async function characterArtworkFeed(request,env,ctx){
  const u=new URL(request.url),raw=tidyQuery(u.searchParams.get('tag')||''),pid=Math.max(0,Number.parseInt(u.searchParams.get('pid')||'0',10)||0);
  const plan=characterQueryPlan(raw);
  if(!plan.length)return new Response(JSON.stringify({results:[],done:true,error:'Invalid artwork query'}),{status:400,headers:{'content-type':'application/json'}});

  const merged=[],seen=new Set(),sources={safebooru:0,zerochan:0};
  let zerochanConfigured=false,hadError=false;
  for(const query of plan){
    const {response,payload}=await callArtV2(request,env,ctx,query,pid);
    if(!response.ok)hadError=true;
    zerochanConfigured=zerochanConfigured||payload?.zerochanConfigured===true;
    for(const row of Array.isArray(payload?.results)?payload.results:[]){
      const key=String(row?.url||'');if(!key||seen.has(key))continue;
      seen.add(key);merged.push({...row,searchVariant:query});
      const source=String(row?.source||'').toLowerCase();
      if(source.includes('zerochan'))sources.zerochan++;else sources.safebooru++;
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
