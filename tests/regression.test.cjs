const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements={};
function el(id){return elements[id]??={value:['league','market'].includes(id)?'all':'',innerHTML:'',textContent:'',handlers:{},addEventListener(k,f){this.handlers[k]=f},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false}}}
const ctx={document:{querySelector:s=>el(s.slice(1)),getElementById:el}};vm.createContext(ctx);vm.runInContext(script,ctx);
assert.equal(el('count').textContent,'6 of 6 demo matches');
el('league').value='Premier Division';el('league').handlers.change();assert.equal(el('count').textContent,'2 of 6 demo matches');
el('market').value='away';el('market').handlers.change();assert.equal(el('count').textContent,'0 of 6 demo matches');assert.match(el('cards').innerHTML,/No matches found/);
el('reset').handlers.click();assert.equal(el('count').textContent,'6 of 6 demo matches');
el('search').value='  SUMMIT  ';el('search').handlers.input();assert.equal(el('count').textContent,'1 of 6 demo matches');
for(let id=1;id<=6;id++){vm.runInContext(`openMatch(${id})`,ctx);assert.equal(el('detail').open,true);assert.match(el('detail-body').innerHTML,/Fictional demo/);assert.match(el('detail-body').innerHTML,/Behind the outlook/);el('close').handlers.click();assert.equal(el('detail').open,false)}
assert.equal(vm.runInContext('matches.every(m=>m.p.reduce((a,b)=>a+b,0)===100)',ctx),true);
assert.match(html,/<title>Predix ora/);assert.match(html,/@media\(max-width:620px\)/);
console.log('PASS: initial render, league filter, combined filters, empty state, reset, case-insensitive trimmed search, all six analysis dialogs, close interaction, probability totals, responsive styles.');

assert.ok(!html.includes('data-plan='));assert.ok(!html.includes('id="pricing"'));assert.ok(html.includes('FREE ACCESS'));assert.ok(html.includes('Predictions are never guaranteed.'));assert.ok(html.includes('Dumebi The Creator'));assert.ok(html.includes('0 verified predictions published'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),'Missing destination '+m[1]);
console.log('PASS: free layout, no purchase offers, source disclosures, navigation destinations.');
