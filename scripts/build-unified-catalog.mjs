import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'public','catalog');
const RESULT=path.join(ROOT,'catalog-build-result.json');
const RAW='https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const POCKET_SERIES='https://api.tcgdex.net/v2/en/series/tcgp';
const POCKET_SET='https://api.tcgdex.net/v2/en/sets/';
const CHUNK_SIZE=4000;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

async function fetchJson(url,{retries=4,delay=450}={}){
  let last;
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Kaseys-Binder-Studio-Catalog-Builder/1.0'}});
      if(r.ok)return await r.json();
      last=new Error(`${r.status} ${r.statusText} for ${url}`);
      if(!(r.status===429||r.status>=500)||i===retries)throw last;
    }catch(e){last=e;if(i===retries)throw e;}
    await sleep(Math.min(delay*Math.pow(2,i),5000));
  }
  throw last||new Error(`Fetch failed: ${url}`);
}

function searchKeys(row){
  const nameLower=norm(row.name),illustratorLower=norm(row.illustrator||row.artist||'');
  const pokedexNumbers=Array.isArray(row.pokedexNumbers)?row.pokedexNumbers.filter(Number.isFinite):[];
  return {...row,nameLower,illustratorLower,namePrefix:nameLower.slice(0,3),pokedexNumbers,pokedexKey:pokedexNumbers.join(','),searchBlob:`${nameLower} ${illustratorLower} ${norm(row.setName||'')} ${norm(row.localId||'')} ${pokedexNumbers.join(' ')}`.trim()};
}

function englishRow(c,set){
  return searchKeys({
    id:`ptcg:${c.id}`,primaryId:c.id,sourceKey:`ptcg:${c.id}`,language:'en',catalog:'english',catalogLabel:'English TCG',source:'pokemon-tcg-raw-github',
    name:c.name||'Unknown card',originalName:c.name||'',localId:String(c.number??''),setId:set.id||c.set?.id||'',rawSetId:set.id||c.set?.id||'',setName:set.name||c.set?.name||set.id||'',series:set.series||c.set?.series||'',releaseDate:set.releaseDate||c.set?.releaseDate||'',
    illustrator:c.artist||'',artist:c.artist||'',rarity:c.rarity||'',supertype:c.supertype||'',subtypes:Array.isArray(c.subtypes)?c.subtypes:[],pokedexNumbers:Array.isArray(c.nationalPokedexNumbers)?c.nationalPokedexNumbers:[],
    imageHigh:c.images?.large||c.images?.small||'',imageLow:c.images?.small||c.images?.large||'',imageFallbacks:[c.images?.large,c.images?.small].filter(Boolean),imageSource:'Pokémon TCG data',kind:'card'
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
    id:`pocket:${c.id}`,primaryId:c.id,tcgdexId:c.id,sourceKey:`pocket:${c.id}`,language:'en',catalog:'pocket',catalogLabel:'TCG Pocket',source:'tcgdex-pocket',
    name:c.name||'Unknown card',originalName:c.name||'',localId:String(c.localId??''),setId:`pocket:${rawSet}`,rawSetId:`pocket:${rawSet}`,setName:`TCG Pocket · ${displaySet}`,series:'Pokémon TCG Pocket',releaseDate:detail?.releaseDate||'',
    illustrator:c.illustrator||'',artist:c.illustrator||'',rarity:c.rarity||'',supertype:c.category||c.type||'',subtypes:[],pokedexNumbers:[],imageHigh:imgs[0]||'',imageLow:imgs[1]||imgs[0]||'',imageFallbacks:imgs,imageSource:'TCGdex Pocket',kind:'card'
  });
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i],i);}});
  await Promise.all(workers);return out;
}

async function buildEnglish(){
  console.log('Fetching English set catalog…');
  const sets=await fetchJson(`${RAW}/sets/en.json`);
  if(!Array.isArray(sets)||sets.length<100)throw new Error(`English set catalog looked incomplete (${sets?.length||0})`);
  let done=0;
  const chunks=await mapLimit(sets,10,async set=>{
    const cards=await fetchJson(`${RAW}/cards/en/${encodeURIComponent(set.id)}.json`);
    done++;if(done%20===0||done===sets.length)console.log(`English sets ${done}/${sets.length}`);
    return Array.isArray(cards)?cards.map(c=>englishRow(c,set)):[];
  });
  return chunks.flat();
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

await fs.mkdir(OUT,{recursive:true});
const [english,pocket]=await Promise.all([buildEnglish(),buildPocket()]);
if(english.length<15000)throw new Error(`English catalog too small: ${english.length}`);
if(pocket.length<500)throw new Error(`Pocket catalog too small: ${pocket.length}`);

const all=[...english,...pocket].sort((a,b)=>a.id.localeCompare(b.id));
const stable=JSON.stringify(all);
const contentHash=crypto.createHash('sha256').update(stable).digest('hex');
const oldManifest=await fs.readFile(path.join(OUT,'manifest.json'),'utf8').then(JSON.parse).catch(()=>null);
if(oldManifest?.contentHash===contentHash){
  await fs.writeFile(RESULT,JSON.stringify({changed:false,version:oldManifest.version,cards:all.length,english:english.length,pocket:pocket.length},null,2));
  console.log(`Catalog unchanged (${all.length.toLocaleString()} cards)`);
  process.exit(0);
}

const version=contentHash.slice(0,12);
const chunkFiles=[];
for(let i=0;i<all.length;i+=CHUNK_SIZE){
  const name=`cards-${String(i/CHUNK_SIZE+1).padStart(3,'0')}.json`;
  const rows=all.slice(i,i+CHUNK_SIZE);
  await fs.writeFile(path.join(OUT,name),JSON.stringify(rows));
  chunkFiles.push({file:name,count:rows.length,sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')});
}
for(const entry of await fs.readdir(OUT)){
  if(/^cards-\d+\.json$/.test(entry)&&!chunkFiles.some(x=>x.file===entry))await fs.rm(path.join(OUT,entry));
}
const sets=new Set(all.map(x=>x.setId).filter(Boolean));
const manifest={schema:1,version,contentHash,generatedAt:new Date().toISOString(),cards:all.length,english:english.length,pocket:pocket.length,sets:sets.size,chunkSize:CHUNK_SIZE,chunks:chunkFiles};
await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(RESULT,JSON.stringify({changed:true,...manifest},null,2));
console.log(`Built ${all.length.toLocaleString()} cards (${english.length.toLocaleString()} English + ${pocket.length.toLocaleString()} Pocket) in ${chunkFiles.length} chunks; version ${version}`);
