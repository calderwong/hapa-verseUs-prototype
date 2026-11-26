/**
 * Review 18 historical diagnostic. Failure assertions describe the pinned baseline;
 * exit 0 is not product acceptance. The complete diagnostic body was executed in
 * the functions V8 isolate against pinned source; this Node filesystem wrapper was
 * NOT separately executed. Pin the checkout and record its actual revision when
 * rerunning; the baseline field below names this historical review.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? process.cwd());
const paths = ["src/hapa/network/runtime.js","src/hapa/network/result-index.js","src/hapa/network/results.js","src/hapa/rules/validate.js"];
const sources = Object.fromEntries(paths.map(p => [p, readFileSync(resolve(root, p), 'utf8')]));
async function runRecordReview(sources) {
 const runtimeSource=sources["src/hapa/network/runtime.js"],indexSource=sources["src/hapa/network/result-index.js"],resultsSource=sources["src/hapa/network/results.js"];
 const assert=(ok,m)=>{if(!ok)throw Error(m);};
 function cut(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,"Source boundary changed: "+a);return s.slice(i,j).trim();}
 const resume=cut(runtimeSource,"  async _resumeMatches() {","\n  _onComplete("),joinLobby=cut(runtimeSource,"  async joinLobby(args = {}) {","\n  async leaveLobby("),connection=cut(runtimeSource,"  _onConnection(peer, conn) {","\n  setAvailability(");
 async function routing(progress){
  const joins=[];let attaches=0;
  class FakeLobby{constructor(){this.peers=new Map();}async start(){}join(kind,id){joins.push({kind,id});}dial(){}announce(){}}
  const session={phase:"active",sigs:{A:"sigA",B:"sigB"},descriptor:{online:"v2",matchId:"match-one"}};
  const rt=new Function("existsSync","readdirSync","readJson","join","ONLINE_PROTOCOL","Lobby",`return ({${resume},${joinLobby},${connection}});`)(()=>true,()=>["match-one"],p=>p.endsWith("session.json")?session:{status:progress},(...p)=>p.join("/"),"v2",FakeLobby);
  const authority={matchId:"match-one",status:"finishing",opponent:{participantId:"peer-b"},attach(){attaches++;}};
  Object.assign(rt,{store:{path:(...p)=>"/store/"+p.join("/")},finishing:new Map(),match:null,settings:{joined:true},archives:[],_sweepTimer:1,identity:{},compat:{},o:{},networkId:"test",_tombstoned:()=>false,_openMatch:async(s,{finishing})=>{if(finishing)rt.finishing.set(s.descriptor.matchId,authority);else rt.match=authority;},log(){},_transportKeyPair:()=>({}),lobbyView:()=>({}),_presence:()=>({})});
  await rt._resumeMatches();await rt.joinLobby({});rt._onConnection({playerId:"peer-b"},{kind:"authenticated connection"});
  return{progress,finishingAuthorities:rt.finishing.size,currentMatch:rt.match?.matchId??null,topicJoins:joins,attachCalls:attaches};
 }
 const terminalRouting={terminal:await routing("terminal"),activeControl:await routing("active")};
 assert(terminalRouting.terminal.attachCalls===0&&terminalRouting.terminal.topicJoins.length===0&&terminalRouting.activeControl.attachCalls===1,"Terminal routing failure no longer reproduces");
 const bucketSource=cut(resultsSource,"export function bucketOf(","\nexport { other }").replace(/^export /,"");
 const bucketOf=new Function(bucketSource+"\nreturn bucketOf;")();
 const indexMethods=[cut(indexSource,"  _add(v) {","\n  /**"),cut(indexSource,"  has(key, commitment) {","\n  /**"),cut(indexSource,"  list({ playerId = null","\n  /**"),cut(indexSource,"  stats(playerId) {","\n}\n")];
 function makeIndex(){const idx=new Function("bucketOf","return ({"+indexMethods.join(",")+"});")(bucketOf);idx.entries=new Map();return idx;}
 const A="hv1:"+"a".repeat(64),B="hv1:"+"b".repeat(64);
 const first={key:"network/match",descriptorHash:"same-session",commitment:"first-history",matchId:"match",outcome:{result:"win",winner:"A"},players:{A:{participantId:A,label:"Ada"},B:{participantId:B,label:"Bram"}},controllers:{A:"human",B:"human"},ticks:4};
 const conflict={...first,commitment:"conflicting-history",outcome:{result:"win",winner:"B"}},bundles=[{verified:first},{verified:conflict}];
 const archive=makeIndex();archive._add(first);archive._add(conflict);archive.bundles=()=>bundles;
 const queryMethod=cut(runtimeSource,"  _onResultsQuery(peer, msg) {","\n  _onResultGet("),getMethod=cut(runtimeSource,"  _onResultGet(peer, msg) {","\n  _ask("),syncMethod=cut(runtimeSource,"  async syncResults(args = {}) {","\n  /**");
 let sent;
 const server=new Function("verifyBundle","return ({"+queryMethod+","+getMethod+"});")(bundle=>({ok:true,...bundle.verified}));
 server.results=archive;server.lobby={send:(_p,m)=>{sent=m;}};
 async function observe(known){
  const idx=makeIndex();if(known)idx._add(first);
  idx.submit=bundle=>{const v=bundle.verified;if(idx.has(v.key,v.commitment))return{status:"duplicate"};const e=idx._add(v);return{status:e.disputed?"disputed":"added"};};
  const peer={playerId:"archive",fingerprint:"archive",presence:{role:"archive"}};
  const observer=new Function("return ({"+syncMethod+"});")();
  Object.assign(observer,{results:idx,lobby:{peers:new Map([["archive",peer]])},_ask:async(_p,m)=>{if(m.t==="results.query")server._onResultsQuery({playerId:"observer"},m);else server._onResultGet({playerId:"observer"},m);return sent;}});
  const pulled=await observer.syncResults({playerId:A});return{initiallyKnewFirstHistory:known,pulled,stats:idx.stats(A)};
 }
 const conflictPropagation={archiveStats:archive.stats(A),freshObserver:await observe(false),priorObserver:await observe(true)};
 assert(conflictPropagation.archiveStats.disputed===1&&conflictPropagation.freshObserver.stats.disputed===0&&conflictPropagation.priorObserver.stats.buckets["human-vs-human"].wins===1,"Conflict distribution failure no longer reproduces");
 const profileMethod=cut(runtimeSource,"  async profile(args) {","\n  /**");
 const rt=new Function("keyOfPlayer","fingerprintOf",`return ({${syncMethod},${profileMethod}});`)(id=>id.slice(4),key=>"fixture:"+key.slice(0,8));
 let requests=0;const peer={playerId:"archive-a",player:{label:"Configured Archive"},presence:{role:"archive"}};
 Object.assign(rt,{lobby:{peers:new Map([["archive-a",peer]])},_connectedArchives:()=>[peer],_profileCache:new Map(),_syncInFlight:new Map(),_ask:async()=>{requests++;throw Error("the archive did not answer");},results:{stats:playerId=>({playerId,buckets:{},disputed:0}),list:()=>({total:0,items:[]})}});
 const args={playerId:A},p1=await rt.profile(args),p2=await rt.profile(args);
 const archiveFailure={requests,first:{sync:p1.sync,checkedZero:p1.checkedZero},second:{sync:p2.sync,checkedZero:p2.checkedZero}};
 assert(requests===1&&p1.sync.state==="synced"&&p1.checkedZero===true&&p2.checkedZero===true,"Archive timeout failure no longer reproduces");
 const validateText=sources["src/hapa/rules/validate.js"].replace(/^export (?=(?:function|const) )/gm,"");
 const validateContent=new Function(validateText+"\nreturn validateContent;")();
 const op={type:"damage",hits:1,power:2,channel:"magic",incomingFace:"front"};
 function catalog(operation){return{operations:{damage:{}},archetypes:{},items:{},cards:{spark:{id:"spark",category:"spell",target:{kind:"member"},lineage:{creator:{id:"review-fixture"}},operations:[operation],cost:{mana:{}}}}};}
 const missing={...op};delete missing.power;
 const validation={valid:validateContent(catalog(op)),missingPower:validateContent(catalog(missing)),invalidChannel:validateContent(catalog({...op,channel:"uninstalled"}))};
 assert(validation.valid.ok&&!validation.missingPower.ok&&!validation.invalidChannel.ok,"Validator positive correction failed");
 return{baseline:"b2a31f45baed1b70f0e1777eba93fe0267b09a5b",method:"Exact runtime/index methods with controlled files, transport, already-verified evidence and injected archive failure; actual standalone content validator with minimal catalog. No native storage, cryptographic verification, real transport or browser execution.",terminalRouting,conflictPropagation,archiveFailure,validation};
}
console.log(JSON.stringify(await runRecordReview(sources), null, 2));
