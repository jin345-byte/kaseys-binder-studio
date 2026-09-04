/* Binder Studio v2.9.1 — compact external artwork source shortcuts. */
(function(){
  'use strict';
  const section=document.querySelector('#autoArtworkSection');
  if(!section||document.querySelector('#artSourceLinks'))return;

  function clean(raw){return String(raw||'').trim().replace(/\s+(ex|gx|vmax|vstar|v-union|v|break|lv\.?\s*x|star)$/i,'').trim()}
  function query(){return clean(document.querySelector('#artSearchQuery')?.value||document.querySelector('#subject')?.value||'')}
  function booruTag(raw){return clean(raw).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9♀♂._-]+/g,'_').replace(/^_+|_+$/g,'')}

  const row=document.createElement('div');
  row.className='art-source-links';
  row.id='artSourceLinks';
  row.innerHTML=`<span>More art:</span>
    <button type="button" class="art-source-chip art-source-primary" id="artSourcePkm">Art of Pokémon ↗</button>
    <a class="art-source-chip" id="artSourceDeviant" href="https://www.deviantart.com/" target="_blank" rel="noopener noreferrer">DeviantArt ↗</a>
    <a class="art-source-chip" id="artSourceSafe" href="https://safebooru.org/" target="_blank" rel="noopener noreferrer">Safebooru ↗</a>`;

  const searchTools=section.querySelector('.art-search-tools');
  if(searchTools)searchTools.insertAdjacentElement('afterend',row);
  else section.insertBefore(row,section.firstChild);

  const pkm=row.querySelector('#artSourcePkm');
  const dev=row.querySelector('#artSourceDeviant');
  const safe=row.querySelector('#artSourceSafe');

  function refresh(){
    const raw=query();
    const encoded=encodeURIComponent(raw?`${raw} pokemon`:'pokemon');
    dev.href=`https://www.deviantart.com/search?q=${encoded}`;
    const tag=booruTag(raw)||'pokemon';
    safe.href=`https://safebooru.org/index.php?page=post&s=list&tags=${encodeURIComponent(tag)}`;
    pkm.title=raw?`Open ${raw} on Art of Pokémon`:'Open Art of Pokémon';
  }

  pkm.addEventListener('click',()=>{
    if(typeof openPokemonArtwork==='function')openPokemonArtwork();
    else window.open('https://www.artofpkm.com/pokemon','_blank','noopener');
  });
  document.querySelector('#artSearchQuery')?.addEventListener('input',refresh,{passive:true});
  document.querySelector('#subject')?.addEventListener('input',refresh,{passive:true});
  refresh();

  const style=document.createElement('style');
  style.id='artSourceLinksStyle';
  style.textContent=`
    .art-source-links{display:flex;align-items:center;gap:5px;min-width:0;margin:-1px 0 5px;padding:0 2px;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
    .art-source-links::-webkit-scrollbar{display:none}
    .art-source-links>span{flex:0 0 auto;color:var(--muted);font-size:7px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
    .art-source-chip{flex:0 0 auto;min-height:23px!important;height:23px;padding:2px 7px;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--surface2) 84%,transparent);color:var(--muted);font:800 8px/1 Rajdhani,system-ui,sans-serif;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
    .art-source-chip:hover,.art-source-chip:focus-visible{border-color:color-mix(in srgb,var(--accent) 52%,var(--line));color:var(--text);outline:none}
    .art-source-primary{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 32%,var(--line));background:color-mix(in srgb,var(--accent) 8%,var(--surface2))}
    body.mobile-lab-enabled .art-source-links{padding-bottom:1px;margin-bottom:4px}
    body.mobile-lab-enabled .art-source-chip{min-height:25px!important;height:25px;font-size:8px}
  `;
  document.head.appendChild(style);
  globalThis.KBSArtSourceLinks={refresh,query};
})();
