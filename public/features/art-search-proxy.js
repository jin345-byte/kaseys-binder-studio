/* Staging web adapter: route Safebooru requests through same-origin Worker API. */
(function(){
  const nativeFetch=globalThis.fetch.bind(globalThis);

  globalThis.fetch=async function(input,init){
    let requestUrl='';
    try{
      requestUrl=typeof input==='string' ? input : (input instanceof URL ? input.href : input?.url || '');
      const parsed=new URL(requestUrl,location.href);
      if(parsed.hostname==='safebooru.org' && parsed.pathname==='/index.php' && parsed.searchParams.get('page')==='dapi'){
        const rawTags=String(parsed.searchParams.get('tags')||'').trim();
        const tag=rawTags.split(/\s+/).find(t=>t && t.toLowerCase()!=='pokemon') || rawTags;
        const page=Math.max(0,Number.parseInt(parsed.searchParams.get('pid')||'0',10)||0);
        const local=`/api/art-search?tag=${encodeURIComponent(tag)}&page=${page}`;
        const upstream=await nativeFetch(local,{signal:init?.signal,headers:{Accept:'application/json'}});
        if(!upstream.ok)return upstream;
        const payload=await upstream.json();
        const rows=(Array.isArray(payload?.results)?payload.results:[]).map(item=>({
          id:item.id,
          file_url:item.url,
          sample_url:item.url,
          preview_url:item.thumb||item.url,
          width:item.width||0,
          height:item.height||0,
          tags:item.tags||''
        }));
        return new Response(JSON.stringify(rows),{
          status:200,
          headers:{'content-type':'application/json','cache-control':'no-store'}
        });
      }
    }catch(e){
      // Fall through to native fetch for unrelated requests or malformed URLs.
    }
    return nativeFetch(input,init);
  };
})();
