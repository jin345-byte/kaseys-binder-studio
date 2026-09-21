/* Kasey's Binder Studio v2.8.8 — Gardevoir Guided Demonstration */
function initKBSGuidedTour(){
  const demo=document.querySelector('#guidedDemo');
  const bubble=document.querySelector('#guidedDemoCard');
  const launch=document.querySelector('#guidedTourLaunch');
  const nextBtn=document.querySelector('#guidedDemoNext');
  if(!demo||!bubble||!launch||!nextBtn)return;

  const DELAY=4000;
  const G={
    colors:{binder:'#27484a',page:'#eadfe8',sleeve:'#d7a9c5'},
    cards:[
      {slot:0,name:'Gardevoir',set:'Ruby & Sapphire',number:'7'},
      {slot:1,name:'Gardevoir',set:'Secret Wonders',number:'7'},
      {slot:3,name:'Mega Gardevoir ex',set:'Mega Evolution',number:'178'},
      {slot:4,name:'Gardevoir ex',set:'Paldean Fates',number:'233'}
    ],
    art:[
      {slot:2,size:'1x2',name:'Gardevoir vertical artwork',url:'https://cdn.artofpkm.com/3tbwm0cjqepgv2c0bhl9bckl7ehy'},
      {slot:6,size:'3x1',name:'Gardevoir horizontal artwork',url:'https://cdn.artofpkm.com/rme2nni75em3g8f6zu12x5wxblo6'}
    ]
  };

  /* The demo still performs every action. The bubble text tells the user how to do it themselves. */
  const steps=[
    ['#syncMasterLibrary','Build the card library','Click Build Card Library once and let it reach 100% before building a page. You only need to do this again when you want to refresh the catalog.'],
    ['#layout','Choose a page layout','Select the pocket layout that matches your binder page. For a standard 9-pocket page, choose 3×3.'],
    ['#binderColor','Choose the binder color','Use the Binder color control to change the outer binder color. Pick any color that fits the theme you want.'],
    ['#pageColor','Choose the page color','Use the Page color control to change the page material behind the pockets.'],
    ['#sleeveColor','Choose the sleeve color','Use the Sleeves color control to change the surround around each card pocket.'],
    ['#subject','Search for cards','Type a Pokémon, Trainer, or card name in the search box, then press Search.'],
    ['#cards','Choose the exact printing','Browse the matching cards and select the printing you want. Use Set and Artist filters when you need to narrow the list.'],
    ['#grid','Place cards on the page','Select a card, then click an empty pocket to place it. On desktop you can also drag cards directly onto pockets.'],
    ['#libraryArtworkTab','Open the Artwork tab','Click Artwork when you want to add art instead of a card. Matching artwork, direct links, uploads, and the Art Tray all live here.'],
    ['#artUrl','Add artwork by link','Paste a direct HTTPS image link here, choose its insert size, and click Add link. You can use Upload image instead for artwork saved on your device.'],
    ['#arts','Place artwork from the Art Tray','Select the artwork in the Art Tray, then click the pocket where you want it to begin. Multi-pocket artwork fills the required neighboring pockets automatically.'],
    ['#artUrl','Add another artwork insert','Repeat the same process for additional artwork: add the image, choose its size, then select it from the Art Tray.'],
    ['#arts','Fill another area with artwork','Select the next artwork item and place it into the starting pocket for the space you want it to fill.'],
    ['#includeCards','Choose what prints','Turn Cards on when you want the Pokémon or Trainer card images included with your printable inserts.'],
    ['#print','Print the finished page','Click Print inserts when the page is finished. Print at 100% scale so the physical card and insert dimensions stay correct.']
  ];

  let current=0,running=false,highlighted=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function clearHighlight(){highlighted?.classList.remove('guided-demo-target','guided-demo-click-pulse');highlighted=null}
  function getTarget(sel){const el=document.querySelector(sel);return el&&el.offsetParent!==null&&!el.hidden?el:null}
  function pulse(el){if(!el)return;el.classList.remove('guided-demo-click-pulse');void el.offsetWidth;el.classList.add('guided-demo-click-pulse');setTimeout(()=>el.classList.remove('guided-demo-click-pulse'),700)}
  function position(el){
    const pad=10,b=bubble.getBoundingClientRect();
    if(!el){bubble.style.cssText='left:50%;top:50%;transform:translate(-50%,-50%)';return}
    const r=el.getBoundingClientRect();let left=Math.max(pad,Math.min(innerWidth-b.width-pad,r.left));let top=r.bottom+10;
    if(top+b.height>innerHeight-pad)top=Math.max(pad,r.top-b.height-10);
    bubble.style.left=left+'px';bubble.style.top=top+'px';bubble.style.transform='none';
  }
  function showStep(){
    clearHighlight();const [sel,title,text]=steps[current],el=getTarget(sel);
    document.querySelector('#guidedDemoStep').textContent=`STEP ${current+1} OF ${steps.length}`;
    document.querySelector('#guidedDemoTitle').textContent=title;
    document.querySelector('#guidedDemoText').textContent=text;
    nextBtn.disabled=running;nextBtn.textContent=current===steps.length-1?'Finish':'Next';
    if(el){el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});setTimeout(()=>{highlighted=el;el.classList.add('guided-demo-target');position(el);setTimeout(()=>pulse(el),300)},220)}else position(null);
  }

  function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
  function num(v){const m=String(v??'').match(/\d+/);return m?String(Number(m[0])):''}
  async function typeText(el,text,delay=70){
    if(!el)return;el.focus();el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));
    for(const ch of text){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}));await sleep(delay)}
  }
  async function searchGardevoir(){
    document.querySelector('#libraryCardsTab')?.click();await sleep(220);
    await typeText(document.querySelector('#subject'),'Gardevoir',90);
    document.querySelector('#searchBtn')?.click();
    document.querySelectorAll('.autocomplete-panel,.autocomplete-results,.search-suggestions,[data-autocomplete],#autocomplete,#searchSuggestions,.typeahead,.typeahead-menu').forEach(el=>{el.hidden=true;el.style.display='none'});
    for(let i=0;i<32;i++){await sleep(250);if(Array.isArray(cards)&&cards.length>=4)return}
  }
  function exactCards(){
    const source=[...(Array.isArray(masterCards)?masterCards:[]),...(Array.isArray(cards)?cards:[])];
    return G.cards.map(spec=>{
      const n=norm(spec.name),s=norm(spec.set),no=num(spec.number);
      const card=source.find(c=>c&&c.kind==='card'&&(c.imageHigh||c.imageLow||c.image)&&norm(c.name)===n&&norm(c.setName||c.setId||'')===s&&num(c.localId||c.number||'')===no)
        ||source.find(c=>c&&c.kind==='card'&&(c.imageHigh||c.imageLow||c.image)&&norm(c.name)===n&&norm(c.setName||'').includes(s)&&num(c.localId||c.number||'')===no);
      if(!card)throw new Error(`Demo card not found: ${spec.name} — ${spec.set} #${spec.number}`);
      return {spec,card};
    });
  }
  function center(el){const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
  async function moveCard(card,slot){
    const src=[...document.querySelectorAll('#cards [data-id]')].find(x=>x.dataset.id===card.id),dst=document.querySelector(`[data-pocket="${slot}"]`);
    if(!dst){place(slot,card);return}
    const g=document.createElement('div');g.className='live-demo-drag-ghost';g.innerHTML=`<img src="${card.imageHigh||card.imageLow||card.image||''}" alt="">`;document.body.appendChild(g);
    const a=src?center(src):{x:innerWidth*.25,y:innerHeight*.4},b=center(dst);g.style.left=a.x+'px';g.style.top=a.y+'px';await sleep(100);g.classList.add('moving');g.style.left=b.x+'px';g.style.top=b.y+'px';await sleep(1050);g.remove();place(slot,card);await sleep(450);
  }
  async function addDemoArt(spec){
    await typeText(document.querySelector('#artUrl'),spec.url,4);
    const size=document.querySelector('#newArtSize');if(size&&[...size.options].some(o=>o.value===spec.size))size.value=spec.size;
    const before=new Set((state.artworks||[]).map(a=>a.id));document.querySelector('#addUrl')?.click();await sleep(800);
    const art=(state.artworks||[]).find(a=>!before.has(a.id));if(!art)throw new Error(`Could not add ${spec.name}`);
    art.size=spec.size;art.name=spec.name;art.source='Art of Pokémon · supplied demo artwork';save();renderArts();return art;
  }
  async function moveArt(art,spec){
    selected=art;renderSelected();const src=[...document.querySelectorAll('#arts [data-id]')].find(x=>x.dataset.id===art.id),dst=document.querySelector(`[data-pocket="${spec.slot}"]`);
    if(src&&dst){const g=document.createElement('div');g.className='live-demo-drag-ghost artwork';g.style.aspectRatio=spec.size==='3x1'?'3 / 1':'1 / 2';g.style.width=spec.size==='3x1'?'180px':'78px';g.innerHTML=`<img src="${art.image||art.imageHigh||art.imageLow||''}" alt="">`;document.body.appendChild(g);const a=center(src),b=center(dst);g.style.left=a.x+'px';g.style.top=a.y+'px';await sleep(100);g.classList.add('moving');g.style.left=b.x+'px';g.style.top=b.y+'px';await sleep(1050);g.remove()}
    place(spec.slot,art);await sleep(550);
  }
  function setColor(id,value){const el=document.querySelector('#'+id);if(el){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}}

  function reset(){
    clearHighlight();running=false;document.body.classList.remove('live-guided-demo-running');demo.hidden=true;demo.setAttribute('aria-hidden','true');bubble.removeAttribute('style');
    state.subject='';state.layout='3x3';state.pockets=Array(12).fill(null);state.artworks=[];selected=null;cards=[];save();
    const s=document.querySelector('#subject');if(s)s.value='';const l=document.querySelector('#layout');if(l)l.value='3x3';const ic=document.querySelector('#includeCards');if(ic)ic.checked=false;
    document.querySelector('#libraryCardsTab')?.click();
    renderHeader();renderSelected();renderCards();renderArts();renderGrid();window.scrollTo({top:0,behavior:'smooth'});
  }

  async function run(){
    if(running)return;running=true;document.body.classList.add('live-guided-demo-running');
    state.subject='';state.layout='3x3';state.pockets=Array(12).fill(null);state.artworks=[];selected=null;save();renderCards();renderArts();renderSelected();renderGrid();demo.hidden=false;demo.setAttribute('aria-hidden','false');
    try{
      current=0;showStep();await sleep(DELAY);
      current=1;showStep();const l=document.querySelector('#layout');if(l){l.value='3x3';l.dispatchEvent(new Event('change',{bubbles:true}))}await sleep(DELAY);
      current=2;showStep();setColor('binderColor',G.colors.binder);await sleep(DELAY);
      current=3;showStep();setColor('pageColor',G.colors.page);await sleep(DELAY);
      current=4;showStep();setColor('sleeveColor',G.colors.sleeve);await sleep(DELAY);
      current=5;showStep();await searchGardevoir();await sleep(DELAY);
      current=6;showStep();const rows=exactCards();await sleep(DELAY);
      current=7;showStep();for(const {spec,card} of rows)await moveCard(card,spec.slot);await sleep(DELAY);
      current=8;showStep();await sleep(900);document.querySelector('#libraryArtworkTab')?.click();await sleep(DELAY);
      current=9;showStep();const v=await addDemoArt(G.art[0]);await sleep(DELAY);
      current=10;showStep();await moveArt(v,G.art[0]);await sleep(DELAY);
      current=11;showStep();const h=await addDemoArt(G.art[1]);await sleep(DELAY);
      current=12;showStep();await moveArt(h,G.art[1]);await sleep(DELAY);
      current=13;showStep();const ic=document.querySelector('#includeCards');if(ic){ic.checked=true;ic.dispatchEvent(new Event('change',{bubbles:true}))}await sleep(DELAY);
      current=14;showStep();await sleep(DELAY);
      running=false;nextBtn.disabled=false;nextBtn.textContent='Finish';
    }catch(e){console.error('Guided Tour failed',e);running=false;document.body.classList.remove('live-guided-demo-running');showRuntimeError?.(e?.message||String(e));nextBtn.disabled=false;nextBtn.textContent='Finish'}
  }

  launch.addEventListener('click',run);
  nextBtn.addEventListener('click',()=>{if(running)return;if(current>=steps.length-1){reset();return}current++;showStep()});
  addEventListener('resize',()=>{if(!demo.hidden)position(getTarget(steps[current][0]))},{passive:true});
  document.addEventListener('keydown',e=>{if(!demo.hidden&&e.key==='Escape')reset()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initKBSGuidedTour,{once:true});else initKBSGuidedTour();

/* Cloud account bootstrap */
(()=>{
  if(!document.querySelector('link[data-kbs-cloud]')){const l=document.createElement('link');l.rel='stylesheet';l.href='features/cloud-sync.css';l.dataset.kbsCloud='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-kbs-cloud]')){const s=document.createElement('script');s.src='features/cloud-sync.js';s.dataset.kbsCloud='1';document.body.appendChild(s)}
})();
