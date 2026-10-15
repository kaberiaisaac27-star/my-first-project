/* Provider fixtures are separate from the fictional prediction examples. No API key here. */
(() => {
  const $=id=>document.getElementById(id);
  const liveCodes=new Set(['1H','HT','2H','ET','BT','P','LIVE','INT']);
  let visibleLimit=12;
  let fixtures=[],snapshot=null,busy=false,timer=null,networkFailed=false;
  const dateTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString(): 'Unavailable';};
  function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function setStatus(state,message){$('feed-status').dataset.state=state;$('feed-status').textContent=message;}
  function render(){
    const query=$('live-search').value.trim().toLowerCase(),league=$('live-league').value,phase=$('live-phase').value;
    const filtered=fixtures.filter(m=>(m.home+' '+m.away).toLowerCase().includes(query)&&(league==='all'||m.leagueId===league)&&(phase==='all'||(phase==='live'?liveCodes.has(m.status):phase==='upcoming'?['NS','TBD'].includes(m.status):['FT','AET','PEN'].includes(m.status))));
    $('live-count').textContent=`${filtered.length} of ${fixtures.length} provider fixtures`;
    $('live-more').hidden=filtered.length<=visibleLimit;$('live-visible').textContent=filtered.length?`Showing ${Math.min(visibleLimit,filtered.length)} of ${filtered.length} matching fixtures`:'';
    const grid=$('live-cards');grid.replaceChildren();
    if(!filtered.length){const message=fixtures.length?'No fixtures match these filters. Try Reset.':networkFailed?'No verified fixture data available. Check the local server connection.':snapshot?.status==='empty'?'The provider returned no fixtures for this feed. This does not confirm there are no matches worldwide.':snapshot?.status==='stale'?'No recent fixtures can be shown. Waiting for a fresh provider response.':'No provider fixtures to display yet. Fictional examples remain separate below.';grid.append(node('p',message,'empty'));return;}
    for(const m of filtered.slice(0,visibleLimit)){const card=node('article',undefined,'score-card'+(liveCodes.has(m.status)?' live':''));card.append(node('h3',m.league+(m.country?' · '+m.country:'')));
      for(const [name,goals] of [[m.home,m.homeGoals],[m.away,m.awayGoals]]){const row=node('div',undefined,'score-row');row.append(node('span',name),node('strong',goals===null?'—':String(goals)));card.append(row);}
      card.append(node('p',m.statusLabel+(m.elapsed!==null?` · ${m.elapsed} min`:'')+' · Snapshot, not an instant score','score-status'),node('p','Kickoff: '+dateTime(m.kickoff),'tiny'));grid.append(card);
    }
  }
  function updateLeagues(){const select=$('live-league'),previous=select.value;select.replaceChildren();const all=node('option','All provider leagues');all.value='all';select.append(all);const leagues=new Map(fixtures.map(m=>[m.leagueId,m.league+(m.country?' · '+m.country:'')]));for(const [id,name] of [...leagues].sort((a,b)=>a[1].localeCompare(b[1]))){const option=node('option',name);option.value=id;select.append(option);}select.value=leagues.has(previous)?previous:'all';}
  async function load(){if(busy||document.hidden)return;busy=true;$('refresh-live').disabled=true;$('live-cards').setAttribute('aria-busy','true');setStatus('loading',snapshot?'Checking the shared fixture feed…':'Loading provider fixture status…');
    try{const response=await fetch('/api/fixtures',{signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw Error('local');const data=await response.json();if(!Array.isArray(data.fixtures)||!['ready','empty','stale','error','setup-required'].includes(data.status))throw Error('shape');snapshot=data;fixtures=data.fixtures;networkFailed=false;updateLeagues();
      const label={ready:'Provider snapshot',empty:'No fixtures returned',stale:'STALE — not current',error:'Feed unavailable','setup-required':'Setup required'}[data.status];setStatus(data.status,label+'. '+data.message);
      $('feed-updated').textContent='Last successful fetch: '+(data.updatedAt?dateTime(data.updatedAt):'Never');
      $('feed-cadence').textContent=`Shared provider refresh: ${data.pollSeconds} seconds. Additional tabs do not trigger extra calls.`;
      $('feed-scope').textContent=data.mode==='live'?'Feed scope: matches in progress only.':`Feed scope: ${data.scopeDate||'today'} (UTC fixture date). Kickoffs shown in your device time.`;
      $('feed-next').textContent=data.status==='setup-required'?'Add credentials locally and restart.':'Next eligible provider refresh: '+dateTime(data.nextRefreshAt);
    }catch{networkFailed=true;setStatus(fixtures.length?'stale':'error',fixtures.length?'STALE — connection to the local server failed. Showing the last received snapshot, not current scores.':'Could not load the local fixture service. Check that the local server is running. Demo predictions are not used as a fallback.');}
    finally{render();busy=false;$('refresh-live').disabled=false;$('live-cards').setAttribute('aria-busy','false');clearTimeout(timer);timer=setTimeout(load,60000);}
  }
  const filterChanged=()=>{visibleLimit=12;render();};$('live-search').addEventListener('input',filterChanged);$('live-league').addEventListener('change',filterChanged);$('live-phase').addEventListener('change',filterChanged);$('live-more').addEventListener('click',()=>{visibleLimit+=12;render();});$('reset-live').addEventListener('click',()=>{$('live-search').value='';$('live-league').value='all';$('live-phase').value='all';visibleLimit=12;render();});$('refresh-live').addEventListener('click',load);
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)load();});
  if(location.protocol==='file:'){setStatus('setup-required','Start the local server and open http://127.0.0.1:3000 to use the fixture feed. Opening the HTML file directly only shows the local preview.');$('refresh-live').disabled=true;render();}else load();
})();
