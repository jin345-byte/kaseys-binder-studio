/* Kasey's Binder Studio v4.0.4 — typography picker. */
(function(){
  'use strict';
  const KEY='kbsFontChoice';
  const FONTS={system:{label:'System Sans',hint:'Cleanest default'},verdana:{label:'Verdana',hint:'Wide and highly readable'},trebuchet:{label:'Trebuchet',hint:'Friendly sans serif'},georgia:{label:'Georgia',hint:'Classic serif'}};
  function saved(){const v=localStorage.getItem(KEY);return FONTS[v]?v:'system'}
  function apply(id,{persist=true}={}){const next=FONTS[id]?id:'system';document.body.dataset.kbsFont=next;if(persist)localStorage.setItem(KEY,next);const select=document.querySelector('#kbsFontSelect');if(select&&select.value!==next)select.value=next;const hint=document.querySelector('#kbsFontHint');if(hint)hint.textContent=FONTS[next].hint;return next}
  function install(){const appearance=document.querySelector('.appearance-module');if(!appearance||document.querySelector('#kbsFontSelect'))return;const label=document.createElement('label');label.className='font-choice-control';label.innerHTML='<span class="font-choice-copy"><strong>Font</strong><small id="kbsFontHint">Choose the easiest typeface to read</small></span><select id="kbsFontSelect" aria-label="Application font"></select>';const select=label.querySelector('select');Object.entries(FONTS).forEach(([id,font])=>{const option=document.createElement('option');option.value=id;option.textContent=font.label;select.appendChild(option)});select.addEventListener('change',()=>apply(select.value,{persist:true}));const themeControl=appearance.querySelector('.full-theme-control');if(themeControl)themeControl.insertAdjacentElement('afterend',label);else appearance.prepend(label);apply(saved(),{persist:false})}
  globalThis.KBSTypography={list:()=>Object.entries(FONTS).map(([id,x])=>({id,...x})),apply,current:()=>document.body.dataset.kbsFont||saved()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
