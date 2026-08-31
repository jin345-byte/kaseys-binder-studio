(()=>{
  'use strict';
  const OWNER_KEY='kbsCloudOwnerV1';
  const LAST_HASH_KEY='kbsCloudLastHashV1';
  const LAST_SYNC_KEY='kbsCloudLastSyncAtV1';
  const SYNC_INTERVAL=15000;
  const els={};
  let config=null,user=null,syncBusy=false,syncTimer=null,lastAppliedCloudRevision=0;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const api=async(path,options={})=>{
    const res=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(options.headers||{})},...options});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
    return data;
  };
  const waitBinder=async()=>{for(let i=0;i<80;i++){if(typeof binderLayerReady!=='undefined'&&binderLayerReady&&binderDb)return true;await sleep(100)}return false};

  function mount(){
    const top=document.querySelector('.top-actions');if(!top)return;
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
    els.cloudAccountBtn.onclick=()=>{els.cloudPopover.hidden=!els.cloudPopover.hidden};els.cloudClose.onclick=()=>{els.cloudPopover.hidden=true};document.addEventListener('click',e=>{if(!wrap.contains(e.target))els.cloudPopover.hidden=true});els.cloudSyncNow.onclick=()=>syncNow(true).catch(showSyncError);els.cloudLogout.onclick=logout;
  }
  function setState(text,kind=''){if(!els.cloudSyncState)return;els.cloudSyncState.textContent=text;els.cloudSyncState.dataset.kind=kind}
  function showSyncError(err){console.error(err);setState(err?.message||'Sync failed','error');if(typeof toast==='function')toast(err?.message||'Cloud sync failed')}
  function renderAuth(){
    if(!els.cloudAccountLabel)return;
    if(user){els.cloudAccountLabel.textContent=user.name||user.email||'Account';els.cloudGuestPanel.hidden=true;els.cloudUserPanel.hidden=false;els.cloudName.textContent=user.name||'Google account';els.cloudEmail.textContent=user.email||'';if(user.picture){els.cloudAvatar.src=user.picture;els.cloudAvatar.hidden=false}else els.cloudAvatar.hidden=true;const t=Number(localStorage.getItem(LAST_SYNC_KEY)||0);els.cloudSyncTime.textContent=t?`Last synced ${new Date(t).toLocaleString()}`:'Not synced yet';}
    else{els.cloudAccountLabel.textContent='Guest';els.cloudGuestPanel.hidden=false;els.cloudUserPanel.hidden=true;els.cloudSetupHint.textContent=config?.authReady?'Sign in to sync your binders across devices.':'Google cloud sync needs one-time server setup.';}
  }
  async function loadGoogle(){
    if(!config?.authReady||!config.googleClientId||user)return;
    if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Google Sign-In'));document.head.appendChild(s)});
    window.google.accounts.id.initialize({client_id:config.googleClientId,callback:onGoogleCredential,auto_select:false,cancel_on_tap_outside:true});els.googleButtonMount.innerHTML='';window.google.accounts.id.renderButton(els.googleButtonMount,{theme:'outline',size:'large',shape:'pill',text:'continue_with',width:260});
  }
  async function onGoogleCredential(response){try{setState('Signing in…');const data=await api('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});user=data.user;renderAuth();await firstAccountSync();startSyncLoop();if(typeof toast==='function')toast(`Signed in as ${user.name||user.email}`)}catch(err){showSyncError(err)}}
  async function sha256(text){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return[...d].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function bytesToBase64(bytes){let out='';const size=0x8000;for(let i=0;i<bytes.length;i+=size)out+=String.fromCharCode(...bytes.subarray(i,i+size));return btoa(out)}
  function base64ToBytes(value){const bin=atob(value);return Uint8Array.from(bin,c=>c.charCodeAt(0))}
  async function encodeSnapshot(snapshot){const raw=JSON.stringify(snapshot);if('CompressionStream'in window){const cs=new CompressionStream('gzip');const writer=cs.writable.getWriter();writer.write(new TextEncoder().encode(raw));writer.close();const buf=await new Response(cs.readable).arrayBuffer();return{payload:bytesToBase64(new Uint8Array(buf)),encoding:'gzip-base64'}}return{payload:raw,encoding:'json'}}
  async function decodeSnapshot(record){if(!record)return null;if(record.encoding==='gzip-base64'&&'DecompressionStream'in window){const ds=new DecompressionStream('gzip');const writer=ds.writable.getWriter();writer.write(base64ToBytes(record.payload));writer.close();return JSON.parse(await new Response(ds.readable).text())}return JSON.parse(record.payload)}
  async function captureSnapshot(){await waitBinder();if(typeof saveActivePageSnapshot==='function')await saveActivePageSnapshot().catch(()=>{});const binders=typeof dbAll==='function'?await dbAll('binders'):[];const pages=typeof dbAll==='function'?await dbAll('pages'):[];const maxUpdated=Math.max(0,...binders.map(x=>Number(x.updatedAt||0)),...pages.map(x=>Number(x.updatedAt||0)));return{format:'KBS-CLOUD-1',capturedAt:Date.now(),maxUpdated,activeBinderId,activePageId,binders,pages,editorState:state}}
  async function clearBinderDb(){if(!binderDb)return;await new Promise((resolve,reject)=>{const tx=binderDb.transaction(['binders','pages'],'readwrite');tx.objectStore('binders').clear();tx.objectStore('pages').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
  async function applySnapshot(snapshot){if(!snapshot||snapshot.format!=='KBS-CLOUD-1')throw new Error('Cloud binder format is not supported');await waitBinder();binderLoading=true;try{await clearBinderDb();for(const b of snapshot.binders||[])await dbPut('binders',b);for(const p of snapshot.pages||[])await dbPut('pages',p);activeBinderId=snapshot.activeBinderId||snapshot.binders?.[0]?.id||'';const pages=await pagesForBinder(activeBinderId);activePageId=(snapshot.activePageId&&pages.some(p=>p.id===snapshot.activePageId))?snapshot.activePageId:(pages[0]?.id||'');persistActiveIds();const page=activePageId?await dbGet('pages',activePageId):null;state=cloneEditorState(page?.state||snapshot.editorState||defaults);localStorage.setItem('michiStandaloneState',JSON.stringify(state))}finally{binderLoading=false}if(typeof rerenderEditor==='function')rerenderEditor();if(typeof renderEditorPageNav==='function')await renderEditorPageNav()}
  async function uploadSnapshot(snapshot,force=false){const encoded=await encodeSnapshot(snapshot);const hash=await sha256(encoded.encoding+':'+encoded.payload);if(!force&&hash===localStorage.getItem(LAST_HASH_KEY))return false;setState('Syncing…');const result=await api('/api/sync',{method:'PUT',body:JSON.stringify(encoded)});localStorage.setItem(LAST_HASH_KEY,hash);localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));lastAppliedCloudRevision=Number(result.revision||0);renderAuth();setState('Synced','ok');return true}
  async function firstAccountSync(){await waitBinder();const remote=await api('/api/sync');const owner=localStorage.getItem(OWNER_KEY);if(remote.snapshot){const cloud=await decodeSnapshot(remote.snapshot);await applySnapshot(cloud);lastAppliedCloudRevision=Number(remote.snapshot.revision||0);const local=await captureSnapshot();const encoded=await encodeSnapshot(local);localStorage.setItem(LAST_HASH_KEY,await sha256(encoded.encoding+':'+encoded.payload));setState('Cloud binder loaded','ok')}else{const local=await captureSnapshot();await uploadSnapshot(local,true);setState(owner&&owner!==user.id?'Guest binder copied to account':'Binder backed up','ok')}localStorage.setItem(OWNER_KEY,user.id);localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));renderAuth()}
  async function syncNow(force=false){if(!user||syncBusy||!navigator.onLine)return;syncBusy=true;try{const owner=localStorage.getItem(OWNER_KEY);if(owner&&owner!==user.id){await firstAccountSync();return}const local=await captureSnapshot();await uploadSnapshot(local,force);if(!force)setState('Cloud sync on','ok')}finally{syncBusy=false}}
  function startSyncLoop(){clearInterval(syncTimer);if(!user)return;syncTimer=setInterval(()=>syncNow(false).catch(showSyncError),SYNC_INTERVAL);window.addEventListener('online',()=>syncNow(false).catch(showSyncError),{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')syncNow(false).catch(()=>{})},{passive:true})}
  async function resetToGuest(){await waitBinder();binderLoading=true;try{await clearBinderDb();localStorage.removeItem('michiStandaloneState');localStorage.removeItem('michiActiveBinderId');localStorage.removeItem('michiActivePageId');localStorage.removeItem(OWNER_KEY);localStorage.removeItem(LAST_HASH_KEY);localStorage.removeItem(LAST_SYNC_KEY)}finally{binderLoading=false}location.reload()}
  async function logout(){try{await syncNow(true);await api('/api/logout',{method:'POST',body:'{}'})}catch(e){console.warn(e)}user=null;clearInterval(syncTimer);await resetToGuest()}
  async function init(){mount();try{config=await api('/api/config');const me=await api('/api/me');user=me.user||null;renderAuth();await loadGoogle();if(user){await firstAccountSync();startSyncLoop()}}catch(err){console.warn('Cloud account unavailable',err);config={authReady:false};renderAuth()}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
