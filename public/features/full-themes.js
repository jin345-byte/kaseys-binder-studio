/* Kasey's Binder Studio v3.4.0 theme lab — full theme picker + persistence. */
(function(){
  const STORAGE_KEY='michiStandaloneState';
  const THEMES={
    jolteon:{label:'Voltage Lab',description:'Current high-voltage dark studio',tier:'free',meta:'#111820',palette:['#111827','#080b12','#334155']},
    pokedex:{label:'Pokédex',description:'Red scanner-inspired collector console',tier:'free',meta:'#3a1016',palette:['#a9202c','#16171c','#404955']},
    'game-boy':{label:'Game Boy',description:'Low-color handheld display aesthetic',tier:'free',meta:'#39452a',palette:['#596b43','#26301f','#6d7e52']},
    'neo-genesis':{label:'Neo Genesis',description:'Vintage cosmic holo collector mood',tier:'premium',meta:'#27203b',palette:['#44345f','#15121f','#70678a']},
    'team-rocket':{label:'Team Rocket',description:'Black, steel and crimson display room',tier:'premium',meta:'#111319',palette:['#1c1c22','#08090c','#3d4149']},
    lavender:{label:'Lavender',description:'Soft violet collector lounge',tier:'free',meta:'#272038',palette:['#4c3a68','#181322','#7c6a91']},
    cyberpunk:{label:'Cyberpunk',description:'Neon cyan and magenta grid lab',tier:'premium',meta:'#0d1020',palette:['#15213a','#050713','#173e43']},
    'cozy-sakura':{label:'Cozy Sakura',description:'Warm paper, blush and cherry blossom tones',tier:'premium',meta:'#fff8f5',palette:['#bf7b8b','#f2e5e5','#d39aa8']},
    'dark-academia':{label:'Dark Academia',description:'Leather, walnut and antique paper',tier:'premium',meta:'#241d17',palette:['#4e3829','#17130f','#6b543f']},
    'e-ink':{label:'E-Ink',description:'Quiet grayscale reading-device aesthetic',tier:'free',meta:'#f2f0e9',palette:['#56534c','#d9d6ce','#8b877e']},
    'retro-card-shop':{label:'Retro Card Shop',description:'Warm wood, paper labels and hobby-store nostalgia',tier:'premium',meta:'#f0d6a7',palette:['#7b5138','#d4bb8f','#a77855']}
  };

  function ensureStylesheet(id,href){
    if(document.querySelector('#'+id))return;
    const link=document.createElement('link');
    link.id=id;link.rel='stylesheet';link.href=href;
    document.head.appendChild(link);
  }
  function ensureThemeStyles(){
    ensureStylesheet('kbsThemePickerFitStyle','styles/theme-picker-fit.css?v=3.0.2');
    ensureStylesheet('kbsThemeBrandingStyle','styles/theme-branding.css?v=3.0.4');
    ensureStylesheet('kbsThemeUnifiedFontStyle','styles/theme-font-unified.css?v=3.0.4');
    ensureStylesheet('kbsThemeLayoutLockStyle','styles/theme-layout-lock.css?v=3.0.5');
    ensureStylesheet('kbsThemeAnimatedAccentsStyle','styles/theme-animated-accents.css?v=3.4.0');
  }
  function readStored(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch{return {}}
  }
  function writeStoredTheme(id){
    const current=readStored();
    current.theme=id;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(current));
  }
  function setPaletteSwatches(theme){
    const bar=document.querySelector('#fullThemePalette');if(!bar)return;
    const colors=theme?.palette||[];
    bar.innerHTML=colors.map(c=>`<span style="--theme-swatch:${c}"></span>`).join('');
  }
  function updatePicker(id){
    const select=document.querySelector('#fullThemeSelect');
    if(select&&select.value!==id)select.value=id;
    const theme=THEMES[id];
    const desc=document.querySelector('#fullThemeDescription');if(desc)desc.textContent=theme?.description||'';
    const tier=document.querySelector('#fullThemeTier');if(tier){tier.textContent=theme?.tier==='premium'?'Theme Pack':'Included';tier.hidden=false;}
    setPaletteSwatches(theme);
  }
  function setColorControl(id,value){
    const el=document.querySelector(id);if(el){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
  }
  function applyFullTheme(raw,{persist=true,applyPalette=false}={}){
    const id=THEMES[raw]?raw:'jolteon';
    const theme=THEMES[id];
    try{state.theme=id}catch{}
    document.body.classList.remove('theme-switching');
    void document.body.offsetWidth;
    document.body.dataset.theme=id;
    document.body.classList.add('theme-switching');
    clearTimeout(applyFullTheme._timer);
    applyFullTheme._timer=setTimeout(()=>document.body.classList.remove('theme-switching'),460);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.meta);
    document.documentElement.style.colorScheme=['cozy-sakura','e-ink','retro-card-shop'].includes(id)?'light':'dark';

    if(applyPalette&&theme.palette){
      const [binder,page,sleeve]=theme.palette;
      try{state.binderColor=binder;state.pageColor=page;state.sleeveColor=sleeve}catch{}
      setColorControl('#binderColor',binder);
      setColorControl('#pageColor',page);
      setColorControl('#sleeveColor',sleeve);
      try{renderGrid()}catch{}
    }

    updatePicker(id);
    if(persist){
      try{writeStoredTheme(id)}catch{}
      try{save()}catch{}
    }
    window.dispatchEvent(new CustomEvent('kbs-theme-change',{detail:{theme:id,definition:{...theme}}}));
    return id;
  }

  function installPicker(){
    ensureThemeStyles();
    const appearance=document.querySelector('.appearance-module');
    if(!appearance||document.querySelector('#fullThemeSelect'))return;
    const control=document.createElement('label');
    control.className='full-theme-control';
    control.title='Theme changes colors, materials, textures and accents while keeping the same app layout and control sizing.';
    control.innerHTML=`
      <span class="full-theme-copy">
        <strong>Theme</strong>
        <small id="fullThemeDescription">Complete app + binder style</small>
      </span>
      <select id="fullThemeSelect" aria-label="Full binder theme" title="Choose a full app and binder theme"></select>
      <span class="full-theme-palette" id="fullThemePalette" aria-hidden="true"></span>`;
    appearance.prepend(control);
    const select=control.querySelector('#fullThemeSelect');
    for(const [id,t] of Object.entries(THEMES)){
      const option=document.createElement('option');
      option.value=id;
      option.textContent=t.label;
      option.dataset.tier=t.tier;
      select.appendChild(option);
    }
    select.dataset.fitReady='1';
    select.addEventListener('change',()=>applyFullTheme(select.value,{persist:true,applyPalette:true}));

    const stored=readStored();
    const initial=THEMES[stored.theme]?stored.theme:(THEMES[state?.theme]?state.theme:'jolteon');
    applyFullTheme(initial,{persist:false,applyPalette:false});
  }

  globalThis.applyTheme=applyFullTheme;
  globalThis.KBSFullThemes={
    list:()=>Object.entries(THEMES).map(([id,t])=>({id,...t})),
    apply:(id,options={})=>applyFullTheme(id,options),
    get current(){return document.body.dataset.theme||'jolteon';}
  };

  ensureThemeStyles();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPicker,{once:true});
  else installPicker();
})();
