import stagingWorker from './staging-worker.js';

const PREVIEW_BUILD='2.9.0-prod-db-live-auth';

export default{
  async fetch(request,env,ctx){
    const response=await stagingWorker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);
    headers.set('x-kbs-production-preview',PREVIEW_BUILD);
    headers.set('cache-control','no-store');
    headers.delete('content-length');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
