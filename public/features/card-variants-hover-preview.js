/* Matching Card Variants v2 — enlarged hover preview.
   Read-only companion to the isolated card browser; never touches search, scroll,
   selection, placement, or drag state. */
(()=>{
  'use strict';

  if(globalThis.KBSCardVariantsHoverPreview?.installed)return;

  const pane=document.querySelector('.variant-pane');
  const preview=document.getElementById('hoverCardPreview');
  if(!pane||!preview)return;

  const style=document.createElement('style');
  style.id='kbsCardVariantsHoverPreviewStyle';
  style.textContent=`
    #hoverCardPreview.kbs-variant-hover-open{position:fixed!important;z-index:2147483645!important;display:grid!important;grid-template-rows:auto auto!important;width:min(320px,32vw)!important;max-width:320px!important;pointer-events:none!important;padding:8px!important;border-radius:16px!important;background:color-mix(in srgb,var(--surface) 94%,transparent)!important;border:1px solid color-mix(in srgb,var(--accent) 38%,var(--line))!important;box-shadow:0 22px 60px rgba(0,0,0,.46)!important;backdrop-filter:blur(16px)!important}
    #hoverCardPreview.kbs-variant-hover-open img{display:block!important;width:100%!important;height:auto!important;max-height:70vh!important;object-fit:contain!important;border-radius:11px!important;background:#0001!important}
    #hoverCardPreview .kbs-variant-hover-meta{display:grid!important;gap:2px!important;padding:8px 4px 2px!important;min-width:0!important}
    #hoverCardPreview .kbs-variant-hover-meta strong{font-size:13px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #hoverCardPreview .kbs-variant-hover-meta small{color:var(--muted)!important;font-size:10px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    @media(max-width:900px){#hoverCardPreview{display:none!important}}
  `;
  document.head.appendChild(style);

  let activeId='';
  let showTimer=0;
  let lastX=0,lastY=0;

  const stableId=card=>String(card?.id||card?.sourceKey||`${card?.setId||''}:${card?.localId||''}:${card?.name||''}`);
  const cardById=id=>{
    const current=typeof cards!=='undefined'&&Array.isArray(cards)?cards:[];
    const master=typeof masterCards!=='undefined'&&Array.isArray(masterCards)?masterCards:[];
    return current.find(card=>stableId(card)===String(id))||master.find(card=>stableId(card)===String(id))||null;
  };
  const imageFor=card=>card?.imageHigh||card?.images?.large||card?.imageLarge||card?.image||card?.imageLow||card?.images?.small||card?.imageSmall||card?.imageFallbacks?.[0]||'';

  function hide(){
    clearTimeout(showTimer);showTimer=0;activeId='';
    preview.hidden=true;
    preview.classList.remove('kbs-variant-hover-open');
    preview.replaceChildren();
  }

  function position(x,y){
    if(preview.hidden)return;
    const gap=18;
    const rect=preview.getBoundingClientRect();
    const vw=document.documentElement.clientWidth;
    const vh=document.documentElement.clientHeight;
    let left=x+gap,top=y-Math.min(90,rect.height*.22);
    if(left+rect.width+12>vw)left=x-rect.width-gap;
    left=Math.max(12,Math.min(left,vw-rect.width-12));
    top=Math.max(12,Math.min(top,vh-rect.height-12));
    preview.style.left=`${left}px`;
    preview.style.top=`${top}px`;
  }

  function show(id,x,y){
    const card=cardById(id);if(!card)return hide();
    const src=imageFor(card);if(!src)return hide();
    activeId=id;
    const img=document.createElement('img');
    img.src=src;img.alt=card.name||'Card preview';img.draggable=false;
    img.onerror=()=>hide();
    const meta=document.createElement('div');meta.className='kbs-variant-hover-meta';
    const name=document.createElement('strong');name.textContent=card.name||'Card';
    const detail=document.createElement('small');
    detail.textContent=[card.setName||card.setId||'',card.localId?`#${card.localId}`:''].filter(Boolean).join(' · ');
    meta.append(name,detail);preview.replaceChildren(img,meta);
    preview.hidden=false;preview.classList.add('kbs-variant-hover-open');
    requestAnimationFrame(()=>position(x,y));
  }

  function schedule(id,x,y){
    clearTimeout(showTimer);lastX=x;lastY=y;
    if(id===activeId&&!preview.hidden){position(x,y);return;}
    showTimer=setTimeout(()=>show(id,lastX,lastY),180);
  }

  pane.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const card=event.target.closest?.('.kbs-variant-card');
    if(!card||!pane.contains(card)||event.target.closest('.kbs-variant-info'))return;
    schedule(card.dataset.id,event.clientX,event.clientY);
  });
  pane.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    lastX=event.clientX;lastY=event.clientY;
    const card=event.target.closest?.('.kbs-variant-card');
    if(!card){hide();return;}
    if(card.dataset.id===activeId&&!preview.hidden)position(event.clientX,event.clientY);
  });
  pane.addEventListener('pointerout',event=>{
    const card=event.target.closest?.('.kbs-variant-card');
    if(!card)return;
    if(card.contains(event.relatedTarget))return;
    hide();
  });

  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('.kbs-variant-card'))hide();
  },true);
  document.addEventListener('scroll',hide,true);
  window.addEventListener('blur',hide);

  globalThis.KBSCardVariantsHoverPreview={installed:true,version:'1.1.0',hide};
})();
