import stagingWorker from './staging-worker.js';

const PREVIEW_BUILD='2.9.0-prod-db-compat';

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-kbs-production-preview':PREVIEW_BUILD
    }
  });
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const mutatingApi=url.pathname==='/api/auth/google'||url.pathname==='/api/logout'||(url.pathname==='/api/sync'&&request.method!=='GET');
    if(mutatingApi){
      return json({error:'Production database compatibility preview is read-only.'},403);
    }

    const response=await stagingWorker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);
    headers.set('x-kbs-production-preview',PREVIEW_BUILD);
    headers.set('cache-control','no-store');
    headers.delete('content-length');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
