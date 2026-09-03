/* Kasey's Binder Studio v2.8.7 — User-action Guided Tour */
function initKBSGuidedTour(){
  const demo=document.querySelector('#guidedDemo');
  const bubble=document.querySelector('#guidedDemoCard');
  const launch=document.querySelector('#guidedTourLaunch');
  const nextBtn=document.querySelector('#guidedDemoNext');
  if(!demo||!bubble||!launch||!nextBtn)return;

  const steps=[
    ['#syncMasterLibrary','Build the card library','Press Build Card Library once. Wait until the progress reaches 100%. English TCG and TCG Pocket cards will then be available in the same search.'],
    ['#subject','Search for a card or Pokémon','Type a Pokémon, Trainer, or card name here. You can use the Set and Artist filters to narrow the results.'],
    ['#cards','Choose a card','Click or tap a card result to select it. On desktop you can also hover a card to see a larger preview.'],
    ['#grid','Place the selected card','Click or tap an empty binder pocket to place the selected card. You can continue selecting cards and filling the page.'],
    ['#libraryArtworkTab','Open the Artwork tab','Click Artwork when you want art instead of a card. The Artwork tab contains matching artwork, direct-link artwork, and uploads.'],
    ['#autoArtworkSection','Choose matching artwork','Search a Pokémon, then browse the matching artwork here. Use More to continue loading additional results. Click Add to Art Tray on the artwork you want.'],
    ['#artUrl','Add your own artwork','Paste a direct HTTPS image address here, or use Upload image. Supported artwork links are routed through Binder Studio when needed so they can display reliably.'],
    ['#arts','Select artwork from the Art Tray','Click or tap an item in the Art Tray, then place it into an empty binder pocket just like a card.'],
    ['#grid','Position and resize artwork','Drag placed artwork to reposition it. On desktop, hover over the placed artwork and use the mouse wheel to resize the image inside its pockets.'],
    ['#layout','Choose the binder layout','Pick the pocket layout that matches the binder page you are designing: 2×2, 3×3, or 4×3.'],
    ['#binderColor','Customize the binder','Use Binder, Page, and Sleeve colors to match the look of your physical binder or the theme of the page.'],
    ['#openBinders','Save and manage binder pages','Open My Binders to create binders, add pages, duplicate pages, reorder them, or return to a saved page later.'],
    ['#editorPageNav','Move between binder pages','Use the page numbers and arrows to switch pages. The active page is highlighted so you always know which page you are editing.'],
    ['#print','Print your finished work','Use Print inserts when the page is ready. Print at 100% scale so the output keeps the intended physical dimensions.']
  ];

  let current=0,highlighted=null;
  function clearHighlight(){highlighted?.classList.remove('guided-demo-target','guided-demo-click-pulse');highlighted=null}
  function getTarget(sel){const el=document.querySelector(sel);return el&&el.offsetParent!==null&&!el.hidden?el:null}
  function pulse(el){if(!el)return;el.classList.remove('guided-demo-click-pulse');void el.offsetWidth;el.classList.add('guided-demo-click-pulse');setTimeout(()=>el.classList.remove('guided-demo-click-pulse'),700)}
  function position(el){
    const pad=10,b=bubble.getBoundingClientRect();
    if(!el){bubble.style.cssText='left:50%;top:50%;transform:translate(-50%,-50%)';return}
    const r=el.getBoundingClientRect();
    let left=Math.max(pad,Math.min(innerWidth-b.width-pad,r.left));
    let top=r.bottom+10;
    if(top+b.height>innerHeight-pad)top=Math.max(pad,r.top-b.height-10);
    bubble.style.left=left+'px';bubble.style.top=top+'px';bubble.style.transform='none';
  }
  function showStep(){
    clearHighlight();
    const [sel,title,text]=steps[current],el=getTarget(sel);
    document.querySelector('#guidedDemoStep').textContent=`STEP ${current+1} OF ${steps.length}`;
    document.querySelector('#guidedDemoTitle').textContent=title;
    document.querySelector('#guidedDemoText').textContent=text;
    nextBtn.textContent=current===steps.length-1?'Finish':'Next';
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
      setTimeout(()=>{highlighted=el;el.classList.add('guided-demo-target');position(el);setTimeout(()=>pulse(el),180)},220);
    }else position(null);
  }
  function openTour(){
    current=0;
    document.body.classList.add('live-guided-demo-running');
    demo.hidden=false;demo.setAttribute('aria-hidden','false');
    showStep();
  }
  function closeTour(){
    clearHighlight();
    document.body.classList.remove('live-guided-demo-running');
    demo.hidden=true;demo.setAttribute('aria-hidden','true');
    bubble.removeAttribute('style');
  }
  launch.addEventListener('click',openTour);
  nextBtn.addEventListener('click',()=>{if(current>=steps.length-1){closeTour();return}current++;showStep()});
  addEventListener('resize',()=>{if(!demo.hidden)position(getTarget(steps[current][0]))},{passive:true});
  document.addEventListener('keydown',e=>{if(!demo.hidden&&e.key==='Escape')closeTour()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initKBSGuidedTour,{once:true});else initKBSGuidedTour();

/* Cloud account bootstrap */
(()=>{
  if(!document.querySelector('link[data-kbs-cloud]')){const l=document.createElement('link');l.rel='stylesheet';l.href='features/cloud-sync.css';l.dataset.kbsCloud='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-kbs-cloud]')){const s=document.createElement('script');s.src='features/cloud-sync.js';s.dataset.kbsCloud='1';document.body.appendChild(s)}
})();
