(()=>{
  'use strict';
  const OWNER_KEY='kbsCloudOwnerV1';
  const LAST_HASH_KEY='kbsCloudLastHashV2';
  const LAST_SYNC_KEY='kbsCloudLastSyncAtV1';
  const LAST_REVISION_KEY='kbsCloudRevisionV2';
  const SYNC_INTERVAL=15000;
  const els={};
  let config=null,user=null,syncBusy=false,syncTimer=null,listenersBound=false;
  let lastAppliedCloudRevision=Number(localStorage.getItem(LAST_REVISION_KEY)||0);

  class ApiError extends Error{constructor(message,status=0,data={}){super(message);this.name='ApiError';this.status=status;this.data=data}}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const api=async(path,options={})=>{
    const res=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(options.headers||{})},...options});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new ApiError(data.error||`Request failed (${res.status})`,res.status,data);
    return data;
  };
  const waitBinder=async()=>{for(let i=0;i<80;i++){if(typeof binderLayerReady!=='undefined'&&binderLayerReady&&binderDb)return true;await sleep(100)}throw new Error('Binder storage did not become ready.');};

  function mount(){
    const top=document.querySelector('.top-actions');if(!top||document.querySelector('#cloudAccountBtn'))return;
    const wrap=document.createElement('div');wrap.className='cloud-account';
    wrap.innerHTML=`<button class="btn cloud-account-btn" id="cloudAccountBtn" type="button"><span class="cloud-dot"></span><span id="cloudAccountLabel">Guest</span></button>
    <div class="cloud-popover" id="cloudPopover" hidden>
      <div class="cloud-popover-head"><strong>Binder Studio Account</strong><button type="button" id="cloudClose">×</button></div>
      <div id="cloudGuestPanel"><p>Guest mode saves binders only on this device.</p><div id="googleButtonMount" class="google-button-mount"></div><small id="cloudSetupHint"></small></div>
      <div id="cloudUserPanel" hidden>
        <div class="cloud-user"><img id="cloudAvatar" alt=""><div><strong id="cloudName"></strong><small id="cloudEmail"></small></div></div>
        <div class="cloud-sync-state"><span id="cloudSyncState">Cloud sync ready</span><small id="cloudSyncTime"></small></div>
        <button class="btn" id="cloudSyncNow" type="button">Sync now</button><button class="btn ghost" id="cloudLogout" type="button">Sign out</button>
      </div>
    </div>`;
    top.appendChild(wrap);
    ['cloudAccountBtn','cloudAccountLabel','cloudPopover','cloudClose','cloudGuestPanel','cloudUserPanel','googleButtonMount','cloudSetupHint','cloudAvatar','cloudName','cloudEmail','cloudSyncState','cloudSyncTime','cloudSyncNow','cloudLogout'].forEach(id=>els[id]=document.getElementById(id));
    els.cloudAccountBtn.onclick=()=>{els.cloudPopover.hidden=!els.cloudPopover.hidden};
    els.cloudClose.onclick=()=>{els.cloudPopover.hidden=true};
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))els.cloudPopover.hidden=true});
    els.cloudSyncNow.onclick=()=>synchronize({force:true,reason:'manual'}).catch(showSyncError);
    els.cloudLogout.onclick=logout;
  }

  function setState(text,kind=''){if(!els.cloudSyncState)return;els.cloudSyncState.textContent=text;els.cloudSyncState.dataset.kind=kind}
  function setBusy(value,label='Syncing…'){
    syncBusy=Boolean(value);
    if(els.cloudSyncNow){els.cloudSyncNow.disabled=syncBusy;els.cloudSyncNow.setAttribute('aria-busy',syncBusy?'true':'false');els.cloudSyncNow.textContent=syncBusy?label:'Sync now'}
    if(els.cloudLogout)els.cloudLogout.disabled=syncBusy;
  }
  function showSyncError(err){console.error(err);setState(err?.message||'Sync failed','error');if(typeof toast==='function')toast(err?.message||'Cloud sync failed')}
  function renderAuth(){
    if(!els.cloudAccountLabel)return;
    if(user){
      els.cloudAccountLabel.textContent=user.name||user.email||'Account';els.cloudGuestPanel.hidden=true;els.cloudUserPanel.hidden=false;els.cloudName.textContent=user.name||'Google account';els.cloudEmail.textContent=user.email||'';
      if(user.picture){els.cloudAvatar.src=user.picture;els.cloudAvatar.hidden=false}else els.cloudAvatar.hidden=true;
      const t=Number(localStorage.getItem(LAST_SYNC_KEY)||0);els.cloudSyncTime.textContent=t?`Last synced ${new Date(t).toLocaleString()}`:'Not synced yet';
    }else{
      els.cloudAccountLabel.textContent='Guest';els.cloudGuestPanel.hidden=false;els.cloudUserPanel.hidden=true;els.cloudSetupHint.textContent=config?.authReady?'Sign in to sync your binders across devices.':'Google cloud sync needs one-time server setup.';
    }
  }

  async function loadGoogle(){
    if(!config?.authReady||!config.googleClientId||user)return;
    if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Google Sign-In'));document.head.appendChild(s)});
    window.google.accounts.id.initialize({client_id:config.googleClientId,callback:onGoogleCredential,auto_select:false,cancel_on_tap_outside:true});
    els.googleButtonMount.innerHTML='';window.google.accounts.id.renderButton(els.googleButtonMount,{theme:'outline',size:'large',shape:'pill',text:'continue_with',width:260});
  }
  async function onGoogleCredential(response){
    try{
      setState('Signing in…');
      const data=await api('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});
      user=data.user;renderAuth();
      await synchronize({initial:true,force:true,reason:'login'});
      startSyncLoop();
      if(typeof toast==='function')toast(`Signed in as ${user.name||user.email}`);
    }catch(err){showSyncError(err)}
  }

  async function sha256(text){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return[...d].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function bytesToBase64(bytes){let out='';const size=0x8000;for(let i=0;i<bytes.length;i+=size)out+=String.fromCharCode(...bytes.subarray(i,i+size));return btoa(out)}
  function base64ToBytes(value){const bin=atob(value);return Uint8Array.from(bin,c=>c.charCodeAt(0))}
  async function encodeSnapshot(snapshot){const raw=JSON.stringify(snapshot);if('CompressionStream'in window){const cs=new CompressionStream('gzip');const writer=cs.writable.getWriter();writer.write(new TextEncoder().encode(raw));writer.close();const buf=await new Response(cs.readable).arrayBuffer();return{payload:bytesToBase64(new Uint8Array(buf)),encoding:'gzip-base64'}}return{payload:raw,encoding:'json'}}
  async function decodeSnapshot(record){if(!record)return null;if(record.encoding==='gzip-base64'&&'DecompressionStream'in window){const ds=new DecompressionStream('gzip');const writer=ds.writable.getWriter();writer.write(base64ToBytes(record.payload));writer.close();return JSON.parse(await new Response(ds.readable).text())}return JSON.parse(record.payload)}

  function canonicalize(value){
    if(Array.isArray(value))return value.map(canonicalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
    return value;
  }
  function stableSnapshot(snapshot){
    const copy={...snapshot};delete copy.capturedAt;
    copy.binders=[...(copy.binders||[])].sort((a,b)=>String(a.id||'').localeCompare(String(b.id||'')));
    copy.pages=[...(copy.pages||[])].sort((a,b)=>String(a.id||'').localeCompare(String(b.id||'')));
    return canonicalize(copy);
  }
  async function snapshotHash(snapshot){return sha256(JSON.stringify(stableSnapshot(snapshot)))}

  function validateSnapshot(snapshot){
    if(!snapshot||snapshot.format!=='KBS-CLOUD-1')throw new Error('Cloud binder format is not supported.');
    if(!Array.isArray(snapshot.binders)||!Array.isArray(snapshot.pages))throw new Error('Cloud binder snapshot is incomplete.');
    if(snapshot.binders.length>1000||snapshot.pages.length>10000)throw new Error('Cloud binder snapshot is unexpectedly large.');
    const binders=new Set();
    for(const b of snapshot.binders){if(!b||typeof b.id!=='string'||!b.id||binders.has(b.id))throw new Error('Cloud binder snapshot contains invalid binder IDs.');binders.add(b.id)}
    const pages=new Set();
    for(const p of snapshot.pages){if(!p||typeof p.id!=='string'||!p.id||pages.has(p.id)||!binders.has(p.binderId))throw new Error('Cloud binder snapshot contains invalid page data.');pages.add(p.id)}
    return snapshot;
  }

  async function captureSnapshot(){
    await waitBinder();
    if(typeof saveActivePageSnapshot==='function')await saveActivePageSnapshot();
    const binders=typeof dbAll==='function'?await dbAll('binders'):[];
    const pages=typeof dbAll==='function'?await dbAll('pages'):[];
    const maxUpdated=Math.max(0,...binders.map(x=>Number(x.updatedAt||0)),...pages.map(x=>Number(x.updatedAt||0)));
    return validateSnapshot({format:'KBS-CLOUD-1',capturedAt:Date.now(),maxUpdated,activeBinderId,activePageId,binders,pages,editorState:state});
  }

  function snapshotHasMeaningfulWork(snapshot){
    if(!snapshot)return false;
    if((snapshot.binders||[]).length>1||(snapshot.pages||[]).length>1)return true;
    if((snapshot.binders||[]).some(b=>String(b.name||'').trim()&&String(b.name||'').trim()!=='My Binder'))return true;
    for(const p of snapshot.pages||[]){
      const s=p?.state||{};
      if(String(s.subject||'').trim())return true;
      if(Array.isArray(s.artworks)&&s.artworks.length)return true;
      if(Array.isArray(s.pockets)&&s.pockets.some(Boolean))return true;
      if(s.layout&&s.layout!=='3x3')return true;
      if(s.binderColor&&s.binderColor!=='#111827')return true;
      if(s.pageColor&&s.pageColor!=='#080b12')return true;
      if(s.sleeveColor&&s.sleeveColor!=='#334155')return true;
    }
    return false;
  }

  function newer(a,b){return Number(a?.updatedAt||a?.updated_at||0)>=Number(b?.updatedAt||b?.updated_at||0)?a:b}
  function mergeSnapshots(remote,local){
    validateSnapshot(remote);validateSnapshot(local);
    const binders=new Map();
    for(const b of remote.binders)binders.set(b.id,b);
    for(const b of local.binders)binders.set(b.id,binders.has(b.id)?newer(b,binders.get(b.id)):b);
    const pages=new Map();
    for(const p of remote.pages)pages.set(p.id,p);
    for(const p of local.pages)pages.set(p.id,pages.has(p.id)?newer(p,pages.get(p.id)):p);
    for(const p of pages.values())if(!binders.has(p.binderId))pages.delete(p.id);
    const binderRows=[...binders.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    const pageRows=[...pages.values()].sort((a,b)=>String(a.binderId).localeCompare(String(b.binderId))||(a.order||0)-(b.order||0));
    const activeBinder=(local.activeBinderId&&binders.has(local.activeBinderId))?local.activeBinderId:(remote.activeBinderId&&binders.has(remote.activeBinderId)?remote.activeBinderId:binderRows[0]?.id||'');
    const activePage=(local.activePageId&&pages.has(local.activePageId))?local.activePageId:(remote.activePageId&&pages.has(remote.activePageId)?remote.activePageId:pageRows.find(p=>p.binderId===activeBinder)?.id||'');
    const maxUpdated=Math.max(Number(remote.maxUpdated||0),Number(local.maxUpdated||0),...binderRows.map(x=>Number(x.updatedAt||0)),...pageRows.map(x=>Number(x.updatedAt||0)));
    return validateSnapshot({format:'KBS-CLOUD-1',capturedAt:Date.now(),maxUpdated,activeBinderId:activeBinder,activePageId:activePage,binders:binderRows,pages:pageRows,editorState:local.editorState||remote.editorState||null});
  }

  async function applySnapshot(snapshot){
    validateSnapshot(snapshot);await waitBinder();
    binderLoading=true;
    try{
      await new Promise((resolve,reject)=>{
        const tx=binderDb.transaction(['binders','pages'],'readwrite');
        const bs=tx.objectStore('binders'),ps=tx.objectStore('pages');
        bs.clear();ps.clear();
        for(const b of snapshot.binders)bs.put(b);
        for(const p of snapshot.pages)ps.put(p);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not restore cloud binder.'));tx.onabort=()=>reject(tx.error||new Error('Cloud binder restore was cancelled.'));
      });
      activeBinderId=(snapshot.activeBinderId&&snapshot.binders.some(b=>b.id===snapshot.activeBinderId))?snapshot.activeBinderId:(snapshot.binders[0]?.id||'');
      activePageId=(snapshot.activePageId&&snapshot.pages.some(p=>p.id===snapshot.activePageId))?snapshot.activePageId:(snapshot.pages.find(p=>p.binderId===activeBinderId)?.id||'');
      persistActiveIds();
      const page=snapshot.pages.find(p=>p.id===activePageId);
      state=cloneEditorState(page?.state||snapshot.editorState||defaults);
      try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch(e){console.warn('Could not update standalone state after cloud restore',e)}
    }finally{binderLoading=false}
    if(typeof rerenderEditor==='function')rerenderEditor();
    if(typeof renderEditorPageNav==='function')await renderEditorPageNav();
  }

  function recordBaseline(hash,revision){
    localStorage.setItem(LAST_HASH_KEY,hash||'');
    localStorage.setItem(LAST_REVISION_KEY,String(Number(revision||0)));
    localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));
    lastAppliedCloudRevision=Number(revision||0);
    renderAuth();
  }
  async function fetchRemote(){return api('/api/sync')}
  async function fetchRemoteMeta(){return api('/api/sync?meta=1')}

  async function uploadSnapshot(snapshot,{force=false,baseRevision=lastAppliedCloudRevision}={}){
    const hash=await snapshotHash(snapshot);
    if(!force&&hash===localStorage.getItem(LAST_HASH_KEY))return {uploaded:false,hash,revision:lastAppliedCloudRevision};
    setState('Syncing…');
    const encoded=await encodeSnapshot(snapshot);
    const result=await api('/api/sync',{method:'PUT',body:JSON.stringify({...encoded,baseRevision:Number(baseRevision||0)})});
    recordBaseline(hash,result.revision);
    setState('Synced','ok');
    return{uploaded:true,hash,revision:Number(result.revision||0)};
  }

  async function handleInitialSync(){
    await waitBinder();
    const remote=await fetchRemote();
    const owner=localStorage.getItem(OWNER_KEY);
    const local=await captureSnapshot();
    const localHash=await snapshotHash(local);

    if(!remote.snapshot){
      await uploadSnapshot(local,{force:true,baseRevision:0});
      setState(owner&&owner!==user.id?'Guest binder copied to account':'Binder backed up','ok');
    }else{
      const cloud=validateSnapshot(await decodeSnapshot(remote.snapshot));
      const remoteRevision=Number(remote.snapshot.revision||0);
      const remoteHash=await snapshotHash(cloud);
      const sameOwner=owner===user.id;
      const baseline=localStorage.getItem(LAST_HASH_KEY)||'';
      const localChanged=Boolean(baseline&&localHash!==baseline);
      const preserveGuest=!sameOwner&&snapshotHasMeaningfulWork(local);

      if(preserveGuest||localChanged){
        const merged=mergeSnapshots(cloud,local);
        await uploadSnapshot(merged,{force:true,baseRevision:remoteRevision});
        await applySnapshot(merged);
        setState(preserveGuest?'Cloud binder + guest work merged safely':'Changes from this device merged with cloud','ok');
      }else{
        await applySnapshot(cloud);
        recordBaseline(remoteHash,remoteRevision);
        setState('Cloud binder loaded','ok');
      }
    }
    localStorage.setItem(OWNER_KEY,user.id);
  }

  async function syncCycle({force=false}={}){
    const local=await captureSnapshot();
    let localHash=await snapshotHash(local);
    const baseline=localStorage.getItem(LAST_HASH_KEY)||'';
    const localChanged=!baseline||localHash!==baseline;
    const meta=await fetchRemoteMeta();
    const remoteRevision=Number(meta.snapshot?.revision||0);

    if(remoteRevision>lastAppliedCloudRevision){
      const full=await fetchRemote();
      if(!full.snapshot){lastAppliedCloudRevision=0;return uploadSnapshot(local,{force:true,baseRevision:0})}
      const cloud=validateSnapshot(await decodeSnapshot(full.snapshot));
      const cloudHash=await snapshotHash(cloud);
      const actualRevision=Number(full.snapshot.revision||0);
      if(!localChanged){
        await applySnapshot(cloud);recordBaseline(cloudHash,actualRevision);setState('Updated from another device','ok');return;
      }
      const merged=mergeSnapshots(cloud,local);
      await uploadSnapshot(merged,{force:true,baseRevision:actualRevision});
      await applySnapshot(merged);
      setState('Merged changes from another device','ok');return;
    }

    if(localChanged||force)await uploadSnapshot(local,{force,baseRevision:remoteRevision});
    else setState('Cloud sync on','ok');
  }

  async function synchronize(options={}){
    if(!user)return;
    if(syncBusy)return;
    if(!navigator.onLine){if(options.force)throw new Error('You are offline. Binder Studio kept your local data unchanged.');return}
    setBusy(true,options.initial?'Loading…':'Syncing…');
    try{
      if(options.initial)await handleInitialSync();
      else{
        try{await syncCycle(options)}catch(err){
          if(err?.status!==409)throw err;
          // Optimistic write lost a race. Pull the winner, merge, then retry once.
          const latest=await fetchRemote();
          const cloud=validateSnapshot(await decodeSnapshot(latest.snapshot));
          const local=await captureSnapshot();
          const merged=mergeSnapshots(cloud,local);
          await uploadSnapshot(merged,{force:true,baseRevision:Number(latest.snapshot?.revision||0)});
          await applySnapshot(merged);
          setState('Concurrent changes merged safely','ok');
        }
      }
      localStorage.setItem(OWNER_KEY,user.id);
    }finally{setBusy(false)}
  }

  function startSyncLoop(){
    clearInterval(syncTimer);if(!user)return;
    syncTimer=setInterval(()=>synchronize({reason:'timer'}).catch(showSyncError),SYNC_INTERVAL);
    if(!listenersBound){
      listenersBound=true;
      window.addEventListener('online',()=>{if(user)synchronize({reason:'online'}).catch(showSyncError)},{passive:true});
      document.addEventListener('visibilitychange',()=>{if(user&&document.visibilityState==='visible')synchronize({reason:'visible'}).catch(showSyncError)},{passive:true});
    }
  }

  async function clearBinderDb(){if(!binderDb)return;await new Promise((resolve,reject)=>{const tx=binderDb.transaction(['binders','pages'],'readwrite');tx.objectStore('binders').clear();tx.objectStore('pages').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
  async function resetToGuest(){await waitBinder();binderLoading=true;try{await clearBinderDb();localStorage.removeItem('michiStandaloneState');localStorage.removeItem('michiActiveBinderId');localStorage.removeItem('michiActivePageId');localStorage.removeItem(OWNER_KEY);localStorage.removeItem(LAST_HASH_KEY);localStorage.removeItem(LAST_REVISION_KEY);localStorage.removeItem(LAST_SYNC_KEY)}finally{binderLoading=false}location.reload()}

  async function logout(){
    if(syncBusy)return;
    if(!navigator.onLine){showSyncError(new Error('Cannot sign out safely while offline. Your local binder was kept unchanged.'));return}
    setBusy(true,'Saving…');
    try{
      await syncCycle({force:true});
      await api('/api/logout',{method:'POST',body:'{}'});
    }catch(e){
      showSyncError(new Error(`Sign out stopped because your binder could not be backed up: ${e?.message||e}`));
      return;
    }finally{setBusy(false)}
    user=null;clearInterval(syncTimer);await resetToGuest();
  }

  async function init(){
    mount();
    try{
      config=await api('/api/config');
      const me=await api('/api/me');user=me.user||null;renderAuth();
      if(user){await synchronize({initial:true,force:true,reason:'startup'});startSyncLoop()}
      else await loadGoogle();
    }catch(err){console.warn('Cloud account unavailable',err);config=config||{authReady:false};renderAuth();if(user)showSyncError(err)}
  }

  globalThis.KBSCloudSyncDebug={snapshotHash,stableSnapshot,validateSnapshot,mergeSnapshots,snapshotHasMeaningfulWork,getState:()=>({syncBusy,lastAppliedCloudRevision,userId:user?.id||null})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
