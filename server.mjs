import http from 'node:http';
import {readFileSync, writeFileSync, mkdirSync, renameSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const DAY=86400000;
const text=(v,fallback='Unknown')=>typeof v==='string'&&v.trim()?v.slice(0,200):fallback;
const number=v=>Number.isFinite(v)?v:null;
export function normalizeFixtures(body){
  if(!body || typeof body!=='object' || !('errors' in body) || !Array.isArray(body.response))throw Error('invalid');
  if(!body.errors || typeof body.errors!=='object')throw Error('invalid');
  if(Object.keys(body.errors).length)throw Error('provider');
  if(body.paging?.total>1)throw Error('partial'); // Never silently claim a partial page is complete.
  return body.response.map(x=>{
    if(!Number.isInteger(x.fixture?.id)||!x.teams?.home?.name||!x.teams?.away?.name||!Number.isFinite(Date.parse(x.fixture.date)))throw Error('invalid');
    return {id:x.fixture.id,kickoff:new Date(x.fixture.date).toISOString(),leagueId:String(x.league?.id??'unknown'),league:text(x.league?.name),country:text(x.league?.country,''),home:text(x.teams.home.name),away:text(x.teams.away.name),homeGoals:number(x.goals?.home),awayGoals:number(x.goals?.away),status:text(x.fixture.status?.short,'TBD'),statusLabel:text(x.fixture.status?.long,'Status unavailable'),elapsed:number(x.fixture.status?.elapsed)};
  });
}
// One shared cache and in-flight request per local server, not per browser tab.
export function createFeed({key='',mode='today',pollSeconds=900,requestBudget=90,fetchImpl=fetch,now=Date.now,cacheFile=null}={}){
  const interval=Math.max(60,Math.min(86400,Number(pollSeconds)||900))*1000;
  if(!['today','live'].includes(mode))throw Error('FIXTURE_MODE must be today or live');
  const budget=Math.max(1,Math.min(150000,Math.floor(Number(requestBudget)||90)));
  let attempts=[];
  let state={updatedAt:null,fixtures:[],scopeDate:null,nextAttempt:0,error:null},pending=null;
  if(cacheFile){try{const saved=JSON.parse(readFileSync(cacheFile,'utf8'));if(Number.isFinite(saved.state?.nextAttempt)&&saved.state.nextAttempt<=now()+DAY){if(saved.mode===mode&&Array.isArray(saved.state.fixtures))state=saved.state;else state.nextAttempt=saved.state.nextAttempt;} attempts=Array.isArray(saved.attempts)?saved.attempts.filter(t=>Number.isFinite(t)&&t>now()-DAY&&t<=now()):[];}catch{}}
  function persist(){if(!cacheFile)return true;try{mkdirSync(path.dirname(cacheFile),{recursive:true});writeFileSync(cacheFile+'.tmp',JSON.stringify({mode,state,attempts}),{mode:0o600});renameSync(cacheFile+'.tmp',cacheFile);return true;}catch{console.warn('Fixture cache could not be saved; provider refresh paused.');return false;}}
  function snapshot(){const t=now(),date=new Date(t).toISOString().slice(0,10);const tooOld=state.updatedAt&&t-Date.parse(state.updatedAt)>DAY;const fixtures=tooOld?[]:state.fixtures;const stale=!!state.updatedAt&&(!!state.error||t-Date.parse(state.updatedAt)>=interval||(mode==='today'&&state.scopeDate!==date));
    return {provider:'API-Football',mode,scopeDate:state.scopeDate,status:!key?'setup-required':stale?'stale':state.error?'error':state.updatedAt?(fixtures.length?'ready':'empty'):'error',message:!key?'The fixture connection is not configured yet.':state.error|| (!state.updatedAt?'Waiting for the shared provider cooldown before the first snapshot.':stale?'The last available snapshot is out of date.':fixtures.length?'Provider fixture data, not predictions.':'No fixtures were returned for this feed. Coverage may vary.'),fixtures:!key?[]:fixtures,updatedAt:!key?null:state.updatedAt,nextRefreshAt:new Date(Math.max(t,state.nextAttempt)).toISOString(),pollSeconds:interval/1000,requestBudget:budget};
  }
  async function refresh(){attempts=attempts.filter(t=>t>now()-DAY);if(attempts.length>=budget){state.nextAttempt=Math.max(state.nextAttempt,attempts[0]+DAY);state.error='Local rolling 24-hour request budget reached. Provider requests are paused.';persist();return snapshot();}attempts.push(now());state.nextAttempt=now()+interval;if(!persist()){state.error='Local cache is not writable. Provider requests paused to protect the request budget.';return snapshot();}
    try{
      const date=new Date(now()).toISOString().slice(0,10);
      const params=mode==='live'?'live=all':`date=${date}&timezone=UTC`;
      const response=await fetchImpl(`https://v3.football.api-sports.io/fixtures?${params}`,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(12000),redirect:'error'});
      const remaining=response.headers.get('x-ratelimit-requests-remaining');
      if(remaining!==null&&Number(remaining)<=0)state.nextAttempt=Math.max(state.nextAttempt,now()+DAY);
      if(response.status===429){const retry=response.headers.get('retry-after');const seconds=Number(retry);const retryAt=retry?(Number.isFinite(seconds)?now()+seconds*1000:Date.parse(retry)):now()+3600000;state.nextAttempt=Math.max(state.nextAttempt,Number.isFinite(retryAt)?Math.min(retryAt,now()+DAY):now()+3600000);throw Error('rate');}
      if(response.status===401||response.status===403)throw Error('auth');
      if(!response.ok)throw Error('http');
      const body=await response.json();
      // Provider errors can occur inside HTTP 200. Never return raw errors or credentials.
      if(body.errors&&Object.keys(body.errors).length){const hints=JSON.stringify(body.errors).toLowerCase();if(/limit|quota|request.*day/.test(hints)){state.nextAttempt=Math.max(state.nextAttempt,now()+DAY);throw Error('rate');}if(/token|key|auth/.test(hints))throw Error('auth');}
      const fixtures=normalizeFixtures(body);
      state={...state,fixtures,updatedAt:new Date(now()).toISOString(),scopeDate:mode==='today'?date:null,error:null};
    }catch(error){const messages={auth:'Provider authentication failed. Check the private API-Sports key and account access.',rate:'Provider request allowance reached. Automatic requests are paused before retrying.',partial:'The provider returned multiple pages. The incomplete response was not published.',provider:'The provider rejected the request. Check plan coverage and account settings.',invalid:'The provider returned an unexpected response. No replacement data was published.'};state.error=messages[error.message]||'The provider could not be reached. Retrying after the shared cooldown; any previous data is marked stale.';}
    persist();return snapshot();
  }
  return {async get(){if(!key)return snapshot();if(pending)return pending;if(now()<state.nextAttempt)return snapshot();pending=refresh();try{return await pending;}finally{pending=null;}}};
}
export function createApp({feed,root=ROOT,publicHostname=''}={}){
  const publicFiles={'/':'index.html','/index.html':'index.html','/live.js':'live.js','/live.css':'live.css'};
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    // Local-only host allowlist protects this endpoint from browser DNS rebinding.
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'') && !(publicHostname && (req.headers.host||'').toLowerCase()===publicHostname.toLowerCase())){res.writeHead(403);res.end('Local access only');return;}
    if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return;}
    let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400);res.end();return;}
    try{
      if(url.pathname==='/api/fixtures'){const data=await feed.get();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));return;}
      const file=publicFiles[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
      const body=readFileSync(path.join(root,file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(body);
    }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'error',message:'Local server error. No provider details were exposed.'}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be 1024–65535');
  const feed=createFeed({key:process.env.API_FOOTBALL_KEY?.trim(),mode:process.env.FIXTURE_MODE||'today',pollSeconds:process.env.FIXTURE_POLL_SECONDS,requestBudget:process.env.FIXTURE_REQUEST_BUDGET,cacheFile:path.join(ROOT,'.cache','fixtures.json')});
  const publicHostname=process.env.RENDER_EXTERNAL_HOSTNAME||'';
  const app=createApp({feed,publicHostname});app.on('error',()=>{console.error('Could not start local server. Check whether the port is already in use.');process.exitCode=1;});app.listen(port,publicHostname?'0.0.0.0':'127.0.0.1',()=>console.log(`Predix ora: http://127.0.0.1:${port} — ${process.env.API_FOOTBALL_KEY?'provider configured; not yet verified':'API key missing; setup state only'}`));
}
