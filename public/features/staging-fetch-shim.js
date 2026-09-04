(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    let raw='';
    try{raw=input instanceof Request?input.url:String(input)}catch{return nativeFetch(input,init)}
    let url;
    try{url=new URL(raw,location.href)}catch{return nativeFetch(input,init)}
    if(url.protocol==='https:'&&url.hostname==='api.pokemontcg.io'&&url.pathname==='/v2/cards'){
      const proxy=new URL('/api/card-search',location.origin);
      proxy.search=url.search;
      return nativeFetch(proxy.href,init);
    }
    if(url.origin===location.origin&&url.pathname==='/api/art-feed'){
      const proxy=new URL('/api/art-feed-v2',location.origin);
      proxy.search=url.search;
      return nativeFetch(proxy.href,init);
    }
    return nativeFetch(input,init);
  };
})();
