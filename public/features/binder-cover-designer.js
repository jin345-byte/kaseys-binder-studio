/* Kasey's Binder Studio v3.1.0 — visual binder cover designer + shelf. */
(function(){
  const DEFAULT_COVER={
    version:1,
    title:'',
    subtitle:'',
    spineText:'',
    icon:'✦',
    character:'',
    color:'#29354a',
    backgroundUrl:'',
    customImage:''
  };
  const ICONS=['✦','★','♥','⚡','☾','☀','◆','●','♠','♣','♦','K'];
  let installed=false;

  const safeText=v=>String(v??'');
  const coverFor=b=>({...DEFAULT_COVER,...(b?.cover||{}),title:safeText(b?.cover?.title||b?.name||'Binder')});
  const imageFor=c=>safeText(c.customImage||c.backgroundUrl||'').trim();
  function setBg(el,url){
    if(!el)return;
    const clean=safeText(url).trim();
    el.style.backgroundImage=clean?`linear-gradient(180deg,rgba(5,8,12,.08),rgba(5,8,12,.52)),url("${clean.replace(/["\\\n\r]/g,'')}")`:'';
    el.classList.toggle('has-art',Boolean(clean));
  }

  function ensureDesigner(){
    if(document.querySelector('#binderCoverDesigner'))return;
    const modal=document.createElement('div');
    modal.className='binder-cover-designer';
    modal.id='binderCoverDesigner';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="binder-cover-shell panel" role="dialog" aria-modal="true" aria-labelledby="binderCoverDesignerTitle">
      <header class="binder-cover-head"><div><span class="eyebrow">Binder identity</span><h2 id="binderCoverDesignerTitle">Design binder cover</h2></div><button class="modal-close" id="binderCoverClose" type="button" aria-label="Close cover designer">×</button></header>
      <div class="binder-cover-layout">
        <section class="binder-cover-preview-wrap" aria-label="Cover preview"><div class="binder-cover-preview" id="binderCoverPreview"><span class="binder-cover-preview-spine" id="binderCoverPreviewSpine"></span><div class="binder-cover-preview-art"><span class="binder-cover-preview-icon" id="binderCoverPreviewIcon">✦</span><div class="binder-cover-preview-copy"><small id="binderCoverPreviewCharacter"></small><strong id="binderCoverPreviewTitle">Binder</strong><span id="binderCoverPreviewSubtitle"></span></div></div></div><small class="binder-cover-preview-note">This is how the binder appears on your shelf.</small></section>
        <form class="binder-cover-form" id="binderCoverForm">
          <label><span>Title</span><input id="binderCoverTitle" maxlength="64" placeholder="Eeveelution Art Binder"></label>
          <label><span>Subtitle</span><input id="binderCoverSubtitle" maxlength="90" placeholder="Illustration rares + matching artwork"></label>
          <label><span>Spine text</span><input id="binderCoverSpine" maxlength="40" placeholder="EEVEELUTIONS"></label>
          <div class="binder-cover-form-row"><label><span>Icon</span><select id="binderCoverIcon">${ICONS.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label><label><span>Binder color</span><input id="binderCoverColor" type="color" value="#29354a"></label></div>
          <label><span>Pokémon / character</span><input id="binderCoverCharacter" maxlength="60" placeholder="Sylveon, Gojo Satoru, Frieren…"></label>
          <label><span>Background artwork URL</span><input id="binderCoverBackground" type="url" placeholder="https://…"></label>
          <div class="binder-cover-upload-row"><label class="btn ghost binder-cover-upload">Upload custom image<input id="binderCoverUpload" type="file" accept="image/*"></label><button class="btn ghost" id="binderCoverClearImage" type="button">Clear image</button></div>
          <small class="binder-cover-storage-note">Uploads are resized for binder-cover use before saving to help keep cloud sync small.</small>
          <div class="binder-cover-actions"><button class="btn ghost" id="binderCoverCancel" type="button">Cancel</button><button class="btn" id="binderCoverSave" type="submit">Save cover</button></div>
        </form>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeDesigner()});
    modal.querySelector('#binderCoverClose').onclick=closeDesigner;
    modal.querySelector('#binderCoverCancel').onclick=closeDesigner;
    modal.querySelector('#binderCoverClearImage').onclick=()=>{modal.dataset.upload='';modal.querySelector('#binderCoverBackground').value='';refreshPreview()};
    modal.querySelector('#binderCoverUpload').addEventListener('change',onUpload);
    modal.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refreshPreview));
    modal.querySelector('#binderCoverForm').addEventListener('submit',saveDesigner);
  }

  function formCover(){
    const modal=document.querySelector('#binderCoverDesigner');
    return {
      version:1,
      title:modal.querySelector('#binderCoverTitle').value.trim(),
      subtitle:modal.querySelector('#binderCoverSubtitle').value.trim(),
      spineText:modal.querySelector('#binderCoverSpine').value.trim(),
      icon:modal.querySelector('#binderCoverIcon').value||'✦',
      character:modal.querySelector('#binderCoverCharacter').value.trim(),
      color:modal.querySelector('#binderCoverColor').value||'#29354a',
      backgroundUrl:modal.querySelector('#binderCoverBackground').value.trim(),
      customImage:modal.dataset.upload||''
    };
  }

  function refreshPreview(){
    const modal=document.querySelector('#binderCoverDesigner');if(!modal)return;
    const c=formCover(),preview=modal.querySelector('#binderCoverPreview');
    preview.style.setProperty('--cover-color',c.color);
    setBg(modal.querySelector('.binder-cover-preview-art'),imageFor(c));
    modal.querySelector('#binderCoverPreviewIcon').textContent=c.icon;
    modal.querySelector('#binderCoverPreviewTitle').textContent=c.title||'Untitled Binder';
    modal.querySelector('#binderCoverPreviewSubtitle').textContent=c.subtitle||'Your collection';
    modal.querySelector('#binderCoverPreviewCharacter').textContent=c.character;
    modal.querySelector('#binderCoverPreviewSpine').textContent=c.spineText||c.title||'BINDER';
  }

  async function openDesigner(){
    ensureDesigner();
    const b=await dbGet('binders',activeBinderId);if(!b)return toast('Choose a binder first');
    const c=coverFor(b),modal=document.querySelector('#binderCoverDesigner');
    modal.dataset.binderId=b.id;modal.dataset.upload=c.customImage||'';
    modal.querySelector('#binderCoverTitle').value=c.title;
    modal.querySelector('#binderCoverSubtitle').value=c.subtitle;
    modal.querySelector('#binderCoverSpine').value=c.spineText;
    modal.querySelector('#binderCoverIcon').value=ICONS.includes(c.icon)?c.icon:'✦';
    modal.querySelector('#binderCoverCharacter').value=c.character;
    modal.querySelector('#binderCoverColor').value=/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#29354a';
    modal.querySelector('#binderCoverBackground').value=c.backgroundUrl||'';
    refreshPreview();
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    setTimeout(()=>modal.querySelector('#binderCoverTitle')?.focus(),40);
  }
  function closeDesigner(){const m=document.querySelector('#binderCoverDesigner');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}

  async function saveDesigner(e){
    e?.preventDefault();
    const modal=document.querySelector('#binderCoverDesigner'),bid=modal?.dataset.binderId||activeBinderId;
    const b=await dbGet('binders',bid);if(!b)return;
    const c=formCover();
    if(!c.title)c.title=b.name||'Binder';
    b.name=c.title;
    b.cover=c;
    b.updatedAt=Date.now();
    await dbPut('binders',b);
    closeDesigner();
    await renderBinderLibrary();
    try{save()}catch{}
    toast('Binder cover saved');
  }

  function compressImage(file){
    return new Promise((resolve,reject)=>{
      if(!file?.type?.startsWith('image/'))return reject(new Error('Choose an image file'));
      const reader=new FileReader();
      reader.onerror=()=>reject(reader.error||new Error('Could not read image'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('Could not decode image'));
        img.onload=()=>{
          const maxW=900,maxH=1200,scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
          const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
          canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,w,h);
          let data=canvas.toDataURL('image/webp',.78);
          if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',.78);
          if(data.length>650000){
            const scale2=Math.sqrt(600000/data.length)*.94;
            const c2=document.createElement('canvas');c2.width=Math.max(1,Math.round(w*scale2));c2.height=Math.max(1,Math.round(h*scale2));
            c2.getContext('2d',{alpha:false}).drawImage(canvas,0,0,c2.width,c2.height);
            data=c2.toDataURL('image/jpeg',.72);
          }
          if(data.length>750000)return reject(new Error('Image is still too large after optimization'));
          resolve(data);
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function onUpload(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=await compressImage(file);
      const modal=document.querySelector('#binderCoverDesigner');modal.dataset.upload=data;
      modal.querySelector('#binderCoverBackground').value='';
      refreshPreview();toast('Cover image optimized');
    }catch(err){console.error(err);toast(err.message||'Could not use that image')}
    finally{e.target.value=''}
  }

  function ensureToolbarButton(){
    const toolbar=document.querySelector('.binder-toolbar');if(!toolbar||document.querySelector('#designBinderCover'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='btn ghost';btn.id='designBinderCover';btn.textContent='Design cover';
    btn.onclick=()=>openDesigner().catch(console.error);
    const rename=document.querySelector('#renameBinder');toolbar.insertBefore(btn,rename||document.querySelector('#binderStatus'));
  }

  async function enhanceShelf(){
    ensureToolbarButton();ensureDesigner();
    const list=document.querySelector('#binderList');if(!list||!binderDb)return;
    const binders=await dbAll('binders');
    const byId=new Map(binders.map(b=>[b.id,b]));
    for(const chip of list.querySelectorAll('[data-binder]')){
      const b=byId.get(chip.dataset.binder);if(!b)continue;
      const c=coverFor(b),pageText=chip.querySelector('small')?.textContent||'';
      chip.classList.add('binder-cover-card');
      chip.style.setProperty('--cover-color',c.color||'#29354a');
      chip.innerHTML=`<span class="binder-cover-face"><span class="binder-cover-spine">${esc(c.spineText||c.title||b.name||'Binder')}</span><span class="binder-cover-art"><span class="binder-cover-icon">${esc(c.icon||'✦')}</span><span class="binder-cover-copy"><small>${esc(c.character||'')}</small><strong>${esc(c.title||b.name||'Binder')}</strong><em>${esc(c.subtitle||'')}</em></span></span></span><span class="binder-cover-footer"><strong>${esc(c.title||b.name||'Binder')}</strong><small>${esc(pageText)}</small></span>`;
      setBg(chip.querySelector('.binder-cover-art'),imageFor(c));
    }
    list.classList.add('binder-shelf');
  }

  function install(){
    if(installed)return;installed=true;
    ensureDesigner();ensureToolbarButton();
    const core=renderBinderLibrary;
    renderBinderLibrary=async function(){
      const result=await core.apply(this,arguments);
      await enhanceShelf();
      return result;
    };
    if(document.querySelector('#binderModal')?.classList.contains('open'))enhanceShelf().catch(console.error);
    globalThis.KBSBinderCovers={open:openDesigner,refresh:enhanceShelf,coverFor};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
