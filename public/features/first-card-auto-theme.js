/* Binder Studio first-card automatic page palette.
   When a truly blank active page receives its first card, derive a tasteful
   binder/page/sleeve palette from that card. Existing pages are never rethemed
   just because they are opened. */
(()=>{
  'use strict';

  const TYPE_COLORS={
    grass:'#5f9f52',fire:'#c95b46',water:'#4f83b8',lightning:'#d2ac39',electric:'#d2ac39',
    psychic:'#9a6da7',fighting:'#a36b4f',darkness:'#4c4c63',dark:'#4c4c63',metal:'#77838d',
    steel:'#77838d',dragon:'#8870a5',fairy:'#c879a7',colorless:'#8d8a86',normal:'#8d8a86'
  };

  let lastPageKey='';
  let lastCount=0;
  let busy=false;
  let initialized=false;

  const clamp=(n,min=0,max=255)=>Math.max(min,Math.min(max,n));
  const hex=n=>clamp(Math.round(n)).toString(16).padStart(2,'0');
  const rgbHex=({r,g,b})=>`#${hex(r)}${hex(g)}${hex(b)}`;
  function hexRgb(value){
    const m=String(value||'').trim().match(/^#?([0-9a-f]{6})$/i);
    if(!m)return null;
    const n=parseInt(m[1],16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }
  function mix(a,b,t){return{r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t}}
  function luminance(c){return(.2126*c.r+.7152*c.g+.0722*c.b)/255}
  function saturation(c){const max=Math.max(c.r,c.g,c.b),min=Math.min(c.r,c.g,c.b);return max===0?0:(max-min)/max}

  function currentPageKey(){
    try{
      if(typeof activePageId!=='undefined'&&activePageId)return String(activePageId);
      return String(localStorage.getItem('michiActivePageId')||'standalone');
    }catch{return 'standalone'}
  }
  function pocketItems(){
    try{return typeof state!=='undefined'&&Array.isArray(state?.pockets)?state.pockets.filter(Boolean):[]}
    catch{return[]}
  }
  function cardItems(){return pocketItems().filter(x=>x?.kind!=='art')}

  function itemImage(item){
    const direct=item?.imageHigh||item?.imageLow||item?.image||item?.images?.large||item?.images?.small||'';
    if(direct)return String(direct);
    try{
      const node=[...document.querySelectorAll('#grid .pocket img')].find(img=>{
        const alt=String(img.alt||'').toLowerCase(),name=String(item?.name||'').toLowerCase();
        return name&&alt.includes(name);
      });
      return node?.currentSrc||node?.src||'';
    }catch{return''}
  }

  async function sampleImage(url){
    if(!url)return null;
    let bitmap=null;
    try{
      const r=await fetch(url,{mode:'cors',cache:'force-cache'});
      if(!r.ok)throw new Error('image fetch failed');
      bitmap=await createImageBitmap(await r.blob());
      const size=48,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(bitmap,0,0,size,size);
      const data=ctx.getImageData(0,0,size,size).data;
      let sr=0,sg=0,sb=0,weight=0;
      for(let i=0;i<data.length;i+=16){
        if(data[i+3]<180)continue;
        const c={r:data[i],g:data[i+1],b:data[i+2]},lum=luminance(c),sat=saturation(c);
        if(lum<.08||lum>.94||sat<.10)continue;
        const w=.35+sat*1.8+(1-Math.abs(lum-.52))*0.55;
        sr+=c.r*w;sg+=c.g*w;sb+=c.b*w;weight+=w;
      }
      if(weight<1)return null;
      return{r:sr/weight,g:sg/weight,b:sb/weight};
    }catch{return null}
    finally{try{bitmap?.close?.()}catch{}}
  }

  function fallbackColor(item){
    const types=[...(item?.types||[]),item?.type,item?.energyType].filter(Boolean).map(x=>String(x).toLowerCase());
    for(const t of types){if(TYPE_COLORS[t])return hexRgb(TYPE_COLORS[t])}
    const key=String(item?.name||item?.id||'binder').toLowerCase();
    let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;
    const hue=h%360,s=.46,l=.48;
    const a=s*Math.min(l,1-l),f=n=>{const k=(n+hue/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};
    return{r:f(0)*255,g:f(8)*255,b:f(4)*255};
  }

  function paletteFrom(primary){
    const black={r:8,g:9,b:14},charcoal={r:20,g:21,b:29},white={r:238,g:235,b:244};
    let p=primary||{r:104,g:82,b:144};
    if(luminance(p)<.18)p=mix(p,white,.24);
    if(luminance(p)>.82)p=mix(p,charcoal,.28);
    return{
      binder:rgbHex(mix(p,black,.48)),
      page:rgbHex(mix(p,black,.72)),
      sleeve:rgbHex(mix(p,white,.18))
    };
  }

  function applyPalette(palette,item){
    try{
      if(typeof state==='undefined')return;
      state.binderColor=palette.binder;
      state.pageColor=palette.page;
      state.sleeveColor=palette.sleeve;
      [['binderColor',palette.binder],['pageColor',palette.page],['sleeveColor',palette.sleeve]].forEach(([id,value])=>{
        const input=document.getElementById(id);if(input)input.value=value;
      });
      if(typeof save==='function')save();
      if(typeof renderGrid==='function')renderGrid();
      if(typeof toast==='function')toast(`Page colors matched to ${item?.name||'your first card'}`);
    }catch(e){console.warn('First-card palette could not be applied',e)}
  }

  async function themeFromCard(item,pageKey){
    if(busy)return;busy=true;
    try{
      const sampled=await sampleImage(itemImage(item));
      if(currentPageKey()!==pageKey)return;
      const items=cardItems();
      if(items.length!==1||items[0]!==item)return;
      applyPalette(paletteFrom(sampled||fallbackColor(item)),item);
    }finally{busy=false}
  }

  function check(){
    const pageKey=currentPageKey(),items=pocketItems(),itemCount=items.length;
    if(!initialized){initialized=true;lastPageKey=pageKey;lastCount=itemCount;return}
    if(pageKey!==lastPageKey){lastPageKey=pageKey;lastCount=itemCount;return}
    if(lastCount===0&&itemCount===1){
      const first=items[0];
      if(first?.kind!=='art')themeFromCard(first,pageKey);
    }
    lastCount=itemCount;
  }

  function start(){
    check();
    const grid=document.getElementById('grid');
    if(grid)new MutationObserver(()=>queueMicrotask(check)).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class','src']});
    document.addEventListener('pointerup',()=>setTimeout(check,0),true);
    document.addEventListener('drop',()=>setTimeout(check,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
