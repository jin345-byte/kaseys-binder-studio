/* Kasey's Binder Studio v2.6.0 — Focused Guided Tour */
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
  const steps=[
    ['#syncMasterLibrary','Card libraries','This tour uses four exact English Gardevoir printings. Build the English library first if it is not ready.'],
    ['#catalogFilter','Use English TCG','The Gardevoir showcase uses the English TCG catalog.'],
    ['#layout','3×3 layout','The showcase uses one complete 9-pocket page.'],
    ['#binderColor','Binder color','A deep muted teal complements Gardevoir’s green details.'],
    ['#pageColor','Page color','A pale lavender-rose page ties into Gardevoir’s white and pink palette.'],
    ['#sleeveColor','Sleeve color','Dusty pink sleeves frame the Psychic-type cards.'],
    ['#subject','Search Gardevoir','Binder Studio searches Gardevoir to locate the four exact printings.'],
    ['#cards','Find exact cards','The tour matches card name, set name, and collector number.'],
    ['#grid','Place cards','Slots 1, 2, 4, and 5 receive the four requested Gardevoir cards.'],
    ['#artUrl','Vertical artwork','The supplied Art of Pokémon image is added as a 1×2 vertical insert.'],
    ['#arts','Slots 3 + 6','The vertical artwork spans slots 3 and 6.'],
    ['#artUrl','Horizontal artwork','The second supplied image is added as a 3×1 horizontal insert.'],
    ['#arts','Slots 7 + 8 + 9','The horizontal artwork fills the bottom row.'],
    ['#includeCards','Include cards','The Cards option includes the card images when printing.'],
    ['#print','Print Inserts','Final step: this points to Print Inserts without opening it automatically.']
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
    const cat=document.querySelector('#catalogFilter');
    if(cat&&cat.value!=='en'){cat.value='en';cat.dispatchEvent(new Event('change',{bubbles:true}));await sleep(700)}
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
  async function addArt(spec){
    await typeText(document.querySelector('#artUrl'),spec.url,4);
    const size=document.querySelector('#newArtSize');if(size&&[...size.options].some(o=>o.value===spec.size))size.value=spec.size;
    const before=new Set((state.artworks||[]).map(a=>a.id));document.querySelector('#addUrl')?.click();await sleep(700);
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
    renderHeader();renderSelected();renderCards();renderArts();renderGrid();window.scrollTo({top:0,behavior:'smooth'});
  }

  async function run(){
    if(running)return;running=true;document.body.classList.add('live-guided-demo-running');
    state.subject='';state.layout='3x3';state.pockets=Array(12).fill(null);state.artworks=[];selected=null;save();renderCards();renderArts();renderSelected();renderGrid();demo.hidden=false;demo.setAttribute('aria-hidden','false');
    try{
      current=0;showStep();await sleep(DELAY);
      current=1;showStep();await sleep(DELAY);
      current=2;showStep();const l=document.querySelector('#layout');if(l){l.value='3x3';l.dispatchEvent(new Event('change',{bubbles:true}))}await sleep(DELAY);
      current=3;showStep();setColor('binderColor',G.colors.binder);await sleep(DELAY);
      current=4;showStep();setColor('pageColor',G.colors.page);await sleep(DELAY);
      current=5;showStep();setColor('sleeveColor',G.colors.sleeve);await sleep(DELAY);
      current=6;showStep();await searchGardevoir();await sleep(DELAY);
      current=7;showStep();const rows=exactCards();await sleep(DELAY);
      current=8;showStep();for(const {spec,card} of rows)await moveCard(card,spec.slot);await sleep(DELAY);
      current=9;showStep();const v=await addArt(G.art[0]);await sleep(DELAY);
      current=10;showStep();await moveArt(v,G.art[0]);await sleep(DELAY);
      current=11;showStep();const h=await addArt(G.art[1]);await sleep(DELAY);
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
