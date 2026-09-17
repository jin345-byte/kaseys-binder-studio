import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'public','catalog');
const RESULT=path.join(ROOT,'catalog-build-result.json');
const RAW='https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const SCRYDEX_BASE='https://api.scrydex.com/pokemon/v1/en';
const SCRYDEX_API_KEY=String(process.env.SCRYDEX_API_KEY||'').trim();
const SCRYDEX_TEAM_ID=String(process.env.SCRYDEX_TEAM_ID||'').trim();
const SCRYDEX_ENABLED=Boolean(SCRYDEX_API_KEY&&SCRYDEX_TEAM_ID);
const SCRYDEX_RECENT_DAYS=240;
const POCKET_SERIES='https://api.tcgdex.net/v2/en/series/tcgp';
const POCKET_SET='https://api.tcgdex.net/v2/en/sets/';
const UNION_ARENA_FULL='https://github.com/HanClinto/tcgjson/releases/latest/download/union-arena.full.json.gz';
const CHUNK_SIZE=4000;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

async function fetchJson(url,{retries=4,delay=450,headers={}}={}){
  let last;
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Kaseys-Binder-Studio-Catalog-Builder/1.2',...headers}});
      if(r.ok)return await r.json();
      last=new Error(`${r.status} ${r.statusText} for ${url}`);
      if(!(r.status===429||r.status>=500)||i===retries)throw last;
    }catch(e){last=e;if(i===retries)throw e;}
    await sleep(Math.min(delay*Math.pow(2,i),5000));
  }
  throw last||new Error(`Fetch failed: ${url}`);
}

async function fetchScrydex(url){
  if(!SCRYDEX_ENABLED)throw new Error('Scrydex credentials are not configured');
  return fetchJson(url,{headers:{'X-Api-Key':SCRYDEX_API_KEY,'X-Team-ID':SCRYDEX_TEAM_ID}});
}

async function fetchMaybeGzipJson(url,{retries=4,delay=700}={}){
  let last;
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetch(url,{headers:{Accept:'application/octet-stream,application/gzip,application/json','User-Agent':'Kaseys-Binder-Studio-Catalog-Builder/1.2'}});
      if(!r.ok){
        last=new Error(`${r.status} ${r.statusText} for ${url}`);
        if(!(r.status===429||r.status>=500)||i===retries)throw last;
      }else{
        const bytes=Buffer.from(await r.arrayBuffer());
        const text=bytes[0]===0x1f&&bytes[1]===0x8b?zlib.gunzipSync(bytes).toString('utf8'):bytes.toString('utf8');
        return JSON.parse(text);
      }
    }catch(e){last=e;if(i===retries)throw e;}
    await sleep(Math.min(delay*Math.pow(2,i),6000));
  }
  throw last||new Error(`Fetch failed: ${url}`);
}

function searchKeys(row){
  const nameLower=norm(row.name),illustratorLower=norm(row.illustrator||row.artist||''),seriesLower=norm(row.series||'');
  const pokedexNumbers=Array.isArray(row.pokedexNumbers)?row.pokedexNumbers.filter(Number.isFinite):[];
  const extras=[row.gameLabel,row.catalogLabel,row.series,row.setName,row.localId,row.rarity,row.rarityName,row.supertype,row.color,row.cardType,row.activationEnergy,row.requiredEnergy,row.generatedEnergy,row.battlePoint,row.actionPointCost].map(norm).filter(Boolean);
  return {...row,nameLower,illustratorLower,seriesLower,namePrefix:nameLower.slice(0,3),pokedexNumbers,pokedexKey:pokedexNumbers.join(','),searchBlob:`${nameLower} ${illustratorLower} ${extras.join(' ')} ${pokedexNumbers.join(' ')}`.trim()};
}

function englishRow(c,set){
  return searchKeys({
    id:`ptcg:${c.id}`,primaryId:c.id,sourceKey:`ptcg:${c.id}`,language:'en',game:'pokemon',gameLabel:'Pokémon TCG',catalog:'english',catalogLabel:'Pokémon TCG',source:'pokemon-tcg-raw-github',
    name:c.name||'Unknown card',originalName:c.name||'',localId:String(c.number??''),setId:set.id||c.set?.id||'',rawSetId:set.id||c.set?.id||'',setName:set.name||c.set?.name||set.id||'',series:set.series||c.set?.series||'',releaseDate:set.releaseDate||c.set?.releaseDate||'',
    illustrator:c.artist||'',artist:c.artist||'',rarity:c.rarity||'',supertype:c.supertype||'',subtypes:Array.isArray(c.subtypes)?c.subtypes:[],pokedexNumbers:Array.isArray(c.nationalPokedexNumbers)?c.nationalPokedexNumbers:[],
    imageHigh:c.images?.large||c.images?.small||'',imageLow:c.images?.small||c.images?.large||'',imageFallbacks:[c.images?.large,c.images?.small].filter(Boolean),imageSource:'Pokémon TCG data',kind:'card'
  });
}

function scrydexImageSet(images){
  const list=Array.isArray(images)?images:[];
  const front=list.find(x=>String(x?.type||'').toLowerCase()==='front')||list[0]||{};
  const fallbacks=[front.large,front.medium,front.small].filter(Boolean);
  return {high:front.large||front.medium||front.small||'',low:front.small||front.medium||front.large||'',fallbacks};
}
function scrydexRow(c){
  const set=c?.expansion||{};
  const imgs=scrydexImageSet(c?.images);
  const dex=Array.isArray(c?.national_pokedex_numbers)?c.national_pokedex_numbers:Array.isArray(c?.nationalPokedexNumbers)?c.nationalPokedexNumbers:[];
  const localId=c?.number??c?.local_id??c?.localId??c?.expansion_sort_order??'';
  return searchKeys({
    id:`ptcg:${c.id}`,primaryId:c.id,sourceKey:`ptcg:${c.id}`,language:'en',game:'pokemon',gameLabel:'Pokémon TCG',catalog:'english',catalogLabel:'Pokémon TCG',source:'scrydex-pokemon',
    name:c.name||'Unknown card',originalName:c.name||'',localId:String(localId),setId:set.id||'',rawSetId:set.id||'',setName:set.name||set.id||'',series:set.series||'',releaseDate:String(set.release_date||set.releaseDate||'').replaceAll('/','-'),
    illustrator:c.illustrator||c.artist||'',artist:c.illustrator||c.artist||'',rarity:c.rarity||'',supertype:c.supertype||'',subtypes:Array.isArray(c.subtypes)?c.subtypes:[],pokedexNumbers:dex,
    imageHigh:imgs.high,imageLow:imgs.low,imageFallbacks:imgs.fallbacks,imageSource:'Scrydex',kind:'card'
  });
}

function pocketImages(base){
  const b=String(base||'').replace(/\/(high|low)\.(?:webp|png|jpe?g)$/i,'');
  if(!b)return [];
  return [`${b}/high.webp`,`${b}/low.webp`,`${b}/high.png`,`${b}/low.png`,`${b}/high.jpg`,`${b}/low.jpg`];
}
function pocketRow(c,setBrief,detail){
  const imgs=pocketImages(c.image),rawSet=String(setBrief.id||'unknown'),displaySet=setBrief.name||detail?.name||rawSet;
  return searchKeys({
    id:`pocket:${c.id}`,primaryId:c.id,tcgdexId:c.id,sourceKey:`pocket:${c.id}`,language:'en',game:'pokemon-pocket',gameLabel:'Pokémon TCG Pocket',catalog:'pocket',catalogLabel:'TCG Pocket',source:'tcgdex-pocket',
    name:c.name||'Unknown card',originalName:c.name||'',localId:String(c.localId??''),setId:`pocket:${rawSet}`,rawSetId:`pocket:${rawSet}`,setName:`TCG Pocket · ${displaySet}`,series:'Pokémon TCG Pocket',releaseDate:detail?.releaseDate||'',
    illustrator:c.illustrator||'',artist:c.illustrator||'',rarity:c.rarity||'',supertype:c.category||c.type||'',subtypes:[],pokedexNumbers:[],imageHigh:imgs[0]||'',imageLow:imgs[1]||imgs[0]||'',imageFallbacks:imgs,imageSource:'TCGdex Pocket',kind:'card'
  });
}

function unionArenaRow(p,set){
  const meta=p?.metadata||{},a=meta.customAttributes||{};
  const imageUrls=Array.isArray(p?.imageUrls)?p.imageUrls.filter(Boolean):[];
  const cardTypes=Array.isArray(meta.cardTypes)?meta.cardTypes:(Array.isArray(a.cardType)?a.cardType:[a.cardType].filter(Boolean));
  const rawSetId=String(p?.setId??set?.setId??'unknown');
  const productId=String(p?.productId??'');
  const rarity=String(p?.rarity??'');
  return searchKeys({
    id:`union-arena:${productId}`,primaryId:productId,sourceKey:`union-arena:${productId}`,language:'en',game:'union-arena',gameLabel:'Union Arena',catalog:'union-arena',catalogLabel:'Union Arena',source:'tcgjson-union-arena',
    name:p?.name||'Unknown card',originalName:p?.name||'',localId:String(p?.collectorNumber||a.number||''),setId:`union-arena:${rawSetId}`,rawSetId,tcgplayerSetId:Number(p?.setId||set?.setId||0)||null,setName:set?.name||`Union Arena set ${rawSetId}`,series:a.seriesName||set?.name||'Union Arena',releaseDate:a.releaseDate||set?.releaseDate||'',
    illustrator:'',artist:'',rarity,rarityName:a.rarityDbName||rarity,supertype:cardTypes[0]||'',cardType:cardTypes[0]||'',subtypes:cardTypes.slice(1),pokedexNumbers:[],
    color:a.activationEnergy||'',activationEnergy:a.activationEnergy||'',requiredEnergy:String(a.requiredEnergy??''),generatedEnergy:String(a.generatedEnergy??''),actionPointCost:String(a.actionPointCost??''),battlePoint:String(a.battlePointBp??''),trigger:a.trigger||meta.trigger||'',rulesText:meta.rulesText||a.description||'',foilings:Array.isArray(p?.foilings)?p.foilings:[],
    tcgplayerProductId:Number(p?.productId||0)||null,imageHigh:imageUrls[0]||'',imageLow:imageUrls[0]||'',imageFallbacks:imageUrls,imageSource:'TCGplayer CDN via tcgjson',kind:'card'
  });
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i],i);}});
  await Promise.all(workers);return out;
}

async function fetchScrydexPages(baseUrl){
  const out=[];let page=1,total=Infinity;
  while(out.length<total){
    const join=baseUrl.includes('?')?'&':'?';
    const body=await fetchScrydex(`${baseUrl}${join}page=${page}&page_size=100`);
    const rows=Array.isArray(body?.data)?body.data:[];
    out.push(...rows);
    total=Number(body?.totalCount??body?.total_count??out.length);
    if(!rows.length||rows.length<100)break;
    page++;
    if(page>500)throw new Error('Scrydex pagination safety limit reached');
  }
  return out;
}

async function buildEnglishLegacy(){
  console.log('Fetching Pokémon English legacy catalog…');
  const sets=await fetchJson(`${RAW}/sets/en.json`);
  if(!Array.isArray(sets)||sets.length<100)throw new Error(`English set catalog looked incomplete (${sets?.length||0})`);
  let done=0;
  const chunks=await mapLimit(sets,10,async set=>{
    const cards=await fetchJson(`${RAW}/cards/en/${encodeURIComponent(set.id)}.json`);
    done++;if(done%20===0||done===sets.length)console.log(`Pokémon English legacy sets ${done}/${sets.length}`);
    return Array.isArray(cards)?cards.map(c=>englishRow(c,set)):[];
  });
  return chunks.flat();
}

async function enrichRecentEnglishFromScrydex(legacy){
  if(!SCRYDEX_ENABLED){
    console.log('Scrydex credentials not configured; using legacy Pokémon source only.');
    return {rows:legacy,source:'PokemonTCG/pokemon-tcg-data'};
  }
  console.log('Checking Scrydex for newly released English Pokémon sets…');
  const expansions=await fetchScrydexPages(`${SCRYDEX_BASE}/expansions`);
  const cutoff=Date.now()-SCRYDEX_RECENT_DAYS*86400000;
  const futureLimit=Date.now()+7*86400000;
  const recent=expansions.filter(set=>{
    if(set?.is_online_only||set?.isOnlineOnly)return false;
    const raw=String(set?.release_date||set?.releaseDate||'').replaceAll('/','-');
    const t=Date.parse(raw);
    return Number.isFinite(t)&&t>=cutoff&&t<=futureLimit;
  }).sort((a,b)=>String(a.release_date||a.releaseDate||'').localeCompare(String(b.release_date||b.releaseDate||'')));
  if(!recent.length){console.log('Scrydex returned no recent English expansions; retaining legacy catalog.');return {rows:legacy,source:'PokemonTCG/pokemon-tcg-data + Scrydex recent-set check'};}
  console.log(`Scrydex recent-set window: ${recent.length} expansions over ${SCRYDEX_RECENT_DAYS} days`);
  const freshChunks=await mapLimit(recent,3,async(set,i)=>{
    const cards=await fetchScrydexPages(`${SCRYDEX_BASE}/expansions/${encodeURIComponent(set.id)}/cards`);
    console.log(`Scrydex ${i+1}/${recent.length}: ${set.name||set.id} · ${cards.length} cards`);
    return cards.map(scrydexRow);
  });
  const merged=new Map(legacy.map(row=>[row.id,row]));
  for(const row of freshChunks.flat())merged.set(row.id,row);
  return {rows:[...merged.values()],source:'PokemonTCG/pokemon-tcg-data + Scrydex recent releases'};
}

async function buildEnglish(){
  const legacy=await buildEnglishLegacy();
  return enrichRecentEnglishFromScrydex(legacy);
}

async function buildPocket(){
  console.log('Fetching TCG Pocket catalog…');
  const series=await fetchJson(POCKET_SERIES);
  const sets=Array.isArray(series?.sets)?series.sets:[];
  if(sets.length<5)throw new Error(`Pocket set catalog looked incomplete (${sets.length})`);
  let done=0;
  const chunks=await mapLimit(sets,5,async set=>{
    const detail=await fetchJson(POCKET_SET+encodeURIComponent(set.id));
    done++;console.log(`Pocket sets ${done}/${sets.length}`);
    return (Array.isArray(detail?.cards)?detail.cards:[]).map(c=>pocketRow(c,set,detail));
  });
  return chunks.flat();
}

async function buildUnionArena(){
  console.log('Fetching tcgjson Union Arena full catalog…');
  const catalog=await fetchMaybeGzipJson(UNION_ARENA_FULL);
  const products=Array.isArray(catalog?.products)?catalog.products:[];
  const sets=Array.isArray(catalog?.sets)?catalog.sets:[];
  if(products.length<6000)throw new Error(`Union Arena catalog looked incomplete (${products.length})`);
  if(sets.length<70)throw new Error(`Union Arena set catalog looked incomplete (${sets.length})`);
  const setMap=new Map(sets.map(s=>[String(s.setId),s]));
  const rows=products.filter(p=>p?.productId).map(p=>unionArenaRow(p,setMap.get(String(p.setId))||null));
  const withImages=rows.filter(x=>x.imageHigh).length;
  if(withImages<Math.floor(rows.length*.9))throw new Error(`Union Arena image coverage too low (${withImages}/${rows.length})`);
  console.log(`Union Arena ${rows.length.toLocaleString()} cards · ${sets.length} sets · ${withImages.toLocaleString()} images`);
  return rows;
}

await fs.mkdir(OUT,{recursive:true});
const [englishBuild,pocket,unionArena]=await Promise.all([buildEnglish(),buildPocket(),buildUnionArena()]);
const english=englishBuild.rows;
if(english.length<15000)throw new Error(`English catalog too small: ${english.length}`);
if(pocket.length<500)throw new Error(`Pocket catalog too small: ${pocket.length}`);
if(unionArena.length<6000)throw new Error(`Union Arena catalog too small: ${unionArena.length}`);

const all=[...english,...pocket,...unionArena].sort((a,b)=>a.id.localeCompare(b.id));
const stable=JSON.stringify(all);
const contentHash=crypto.createHash('sha256').update(stable).digest('hex');
const oldManifest=await fs.readFile(path.join(OUT,'manifest.json'),'utf8').then(JSON.parse).catch(()=>null);
const counts={pokemon:english.length,pocket:pocket.length,unionArena:unionArena.length};
if(oldManifest?.contentHash===contentHash){
  await fs.writeFile(RESULT,JSON.stringify({changed:false,version:oldManifest.version,cards:all.length,english:english.length,pocket:pocket.length,unionArena:unionArena.length,counts,pokemonSource:englishBuild.source},null,2));
  console.log(`Catalog unchanged (${all.length.toLocaleString()} cards)`);
  process.exit(0);
}

const version=contentHash.slice(0,12);
const chunkFiles=[];
for(let i=0;i<all.length;i+=CHUNK_SIZE){
  const name=`cards-${String(i/CHUNK_SIZE+1).padStart(3,'0')}.json`;
  const rows=all.slice(i,i+CHUNK_SIZE);
  const encoded=JSON.stringify(rows);
  await fs.writeFile(path.join(OUT,name),encoded);
  chunkFiles.push({file:name,count:rows.length,sha256:crypto.createHash('sha256').update(encoded).digest('hex')});
}
for(const entry of await fs.readdir(OUT)){
  if(/^cards-\d+\.json$/.test(entry)&&!chunkFiles.some(x=>x.file===entry))await fs.rm(path.join(OUT,entry));
}
const sets=new Set(all.map(x=>x.setId).filter(Boolean));
const manifest={schema:2,version,contentHash,generatedAt:new Date().toISOString(),cards:all.length,english:english.length,pocket:pocket.length,unionArena:unionArena.length,counts,sets:sets.size,chunkSize:CHUNK_SIZE,chunks:chunkFiles,sources:{pokemon:englishBuild.source,pocket:'TCGdex',unionArena:'HanClinto/tcgjson + TCGplayer CDN'}};
await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(RESULT,JSON.stringify({changed:true,...manifest,pokemonSource:englishBuild.source},null,2));
console.log(`Built ${all.length.toLocaleString()} cards (${english.length.toLocaleString()} Pokémon + ${pocket.length.toLocaleString()} Pocket + ${unionArena.length.toLocaleString()} Union Arena) in ${chunkFiles.length} chunks; version ${version}`);
