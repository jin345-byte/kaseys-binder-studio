/* Searchable Set and Artist filters for Binder Studio. Keeps the existing native selects as the source of truth. */
(()=>{
  'use strict';

  const CONFIG=[
    {id:'setFilter',placeholder:'Search sets…',allLabel:'All sets'},
    {id:'artistFilter',placeholder:'Search artists…',allLabel:'All artists'}
  ];

  function injectStyles(){
    if(document.getElementById('kbsSearchableFilterStyle'))return;
    const style=document.createElement('style');
    style.id='kbsSearchableFilterStyle';
    style.textContent=`
      .kbs-searchable-filter{position:relative;display:block;width:100%;min-width:0}
      .kbs-searchable-filter-input{width:100%;box-sizing:border-box;padding-right:34px}
      .kbs-searchable-filter-chevron{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.68;font-size:12px}
      .kbs-searchable-filter-list{position:absolute;z-index:1200;left:0;right:0;top:calc(100% + 6px);max-height:270px;overflow:auto;padding:6px;margin:0;list-style:none;border:1px solid rgba(196,181,253,.34);border-radius:12px;background:rgba(31,24,49,.98);box-shadow:0 18px 42px rgba(16,8,31,.34);backdrop-filter:blur(14px)}
      .kbs-searchable-filter-list[hidden]{display:none!important}
      .kbs-searchable-filter-option{display:block;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
      .kbs-searchable-filter-option:hover,.kbs-searchable-filter-option.is-active{background:rgba(196,181,253,.15)}
      .kbs-searchable-filter-empty{padding:10px;color:rgba(255,255,255,.62);font-size:12px}
      .kbs-searchable-native{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      .set-filter-row .kbs-searchable-filter{flex:1 1 auto;min-width:0}
    `;
    document.head.appendChild(style);
  }

  function sortedOptions(select,allLabel){
    const items=[...select.options].map(o=>({value:o.value,text:o.textContent.trim()}));
    const all=items.find(x=>x.value==='')||{value:'',text:allLabel};
    const rest=items.filter(x=>x.value!=='').sort((a,b)=>a.text.localeCompare(b.text,undefined,{sensitivity:'base',numeric:true}));
    return [all,...rest];
  }

  function enhance({id,placeholder,allLabel}){
    const select=document.getElementById(id);
    if(!select||select.dataset.searchableEnhanced==='1')return;
    select.dataset.searchableEnhanced='1';
    select.classList.add('kbs-searchable-native');

    const wrap=document.createElement('div');
    wrap.className='kbs-searchable-filter';
    const input=document.createElement('input');
    input.type='search';
    input.className='kbs-searchable-filter-input';
    input.placeholder=placeholder;
    input.autocomplete='off';
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-expanded','false');
    input.setAttribute('aria-label',placeholder.replace('…',''));

    const chevron=document.createElement('span');
    chevron.className='kbs-searchable-filter-chevron';
    chevron.textContent='⌄';

    const list=document.createElement('div');
    list.className='kbs-searchable-filter-list';
    list.hidden=true;
    list.setAttribute('role','listbox');

    select.parentNode.insertBefore(wrap,select);
    wrap.append(input,chevron,list,select);

    let active=-1;

    function currentLabel(){
      const option=select.options[select.selectedIndex];
      return select.value ? (option?.textContent.trim()||'') : '';
    }

    function render(query=''){
      const q=String(query).trim().toLocaleLowerCase();
      const options=sortedOptions(select,allLabel);
      const matches=options.filter((x,i)=>i===0||!q||x.text.toLocaleLowerCase().includes(q));
      list.innerHTML='';
      active=-1;
      if(!matches.length){
        const empty=document.createElement('div');
        empty.className='kbs-searchable-filter-empty';
        empty.textContent='No matches';
        list.appendChild(empty);
      }else{
        matches.forEach(item=>{
          const btn=document.createElement('button');
          btn.type='button';
          btn.className='kbs-searchable-filter-option';
          btn.dataset.value=item.value;
          btn.setAttribute('role','option');
          btn.textContent=item.text;
          btn.addEventListener('mousedown',e=>e.preventDefault());
          btn.addEventListener('click',()=>choose(item.value,item.text));
          list.appendChild(btn);
        });
      }
      list.hidden=false;
      input.setAttribute('aria-expanded','true');
    }

    function close(){
      list.hidden=true;
      input.setAttribute('aria-expanded','false');
      active=-1;
    }

    function choose(value,text){
      select.value=value;
      input.value=value ? text : '';
      close();
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }

    function move(delta){
      const buttons=[...list.querySelectorAll('.kbs-searchable-filter-option')];
      if(!buttons.length)return;
      active=Math.max(0,Math.min(buttons.length-1,active+delta));
      buttons.forEach((b,i)=>b.classList.toggle('is-active',i===active));
      buttons[active].scrollIntoView({block:'nearest'});
    }

    input.addEventListener('focus',()=>{input.select();render(input.value)});
    input.addEventListener('input',()=>render(input.value));
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)render(input.value);move(1)}
      else if(e.key==='ArrowUp'){e.preventDefault();if(list.hidden)render(input.value);move(-1)}
      else if(e.key==='Enter'){
        const buttons=[...list.querySelectorAll('.kbs-searchable-filter-option')];
        if(!list.hidden&&buttons.length){e.preventDefault();(buttons[Math.max(0,active)]||buttons[0]).click()}
      }else if(e.key==='Escape'){close();input.value=currentLabel()}
    });
    input.addEventListener('blur',()=>setTimeout(close,100));
    document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close()});

    select.addEventListener('change',()=>{input.value=currentLabel()});

    const observer=new MutationObserver(()=>{
      if(document.activeElement!==input)input.value=currentLabel();
    });
    observer.observe(select,{childList:true,subtree:true,characterData:true});

    input.value=currentLabel();
  }

  function init(){
    injectStyles();
    CONFIG.forEach(enhance);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
