/**
 * Review 21 controlled exact-source diagnostics at d0be02d0e4a7b6f6132ce499bf0d45d82b30327f.
 * Run: node review-probe.mjs [checkout]
 * Imports/exports are stripped; source bodies and Ed25519 signatures are real. Persistence,
 * Hypercore, transport and awaited match initialization are controlled fixtures. No native,
 * installed-app, real relay carriage or WAN qualification is claimed by this diagnostic.
 * Exit 0 means the asserted corrections and remaining defects were reproduced as described.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as crypto from 'node:crypto';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const source=process.argv[2]?resolve(process.argv[2]):join(here,'source');
const expected=new Map(JSON.parse(readFileSync(join(here,'source-register.json'),'utf8')).files.map(f=>[f.path,f.blob]));
const sourceFiles=[];
function load(path,deps,names){
 const raw=readFileSync(join(source,path),'utf8'),bytes=Buffer.from(raw);
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(blob,expected.get(path),'exact reviewed blob '+path);
 sourceFiles.push({path,blob,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 const body=raw.replace(/^import .+ from .+;\s*$/gm,'').replace(/^export \{.*\};\s*$/gm,'').replace(/\bexport (?=class |function |const |async function )/g,'');
 return new Function(...Object.keys(deps),body+'\nreturn {'+names.join(',')+'};')(...Object.values(deps));
}
const encoding=load('src/hapa/rules/encoding.js',{},['canonicalize','fingerprint','utf8','parseStrict']);
const b4a={from:(...a)=>Buffer.from(...a),toString:(b,e)=>Buffer.from(b).toString(e)};
const pri=Buffer.from('302e020100300506032b657004220420','hex'),pub=Buffer.from('302a300506032b6570032100','hex');
function identity(seed){const sk=Buffer.alloc(32,seed),key=crypto.createPrivateKey({key:Buffer.concat([pri,sk]),format:'der',type:'pkcs8'});const pk=crypto.createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32);return {participantId:'hv1:'+pk.toString('hex'),publicKey:pk.toString('hex'),secretKey:Buffer.concat([sk,pk]).toString('hex')};}
const signing={sign:(data,key)=>crypto.sign(null,data,crypto.createPrivateKey({key:Buffer.concat([pri,Buffer.from(key).subarray(0,32)]),format:'der',type:'pkcs8'})),verify:(data,sig,key)=>crypto.verify(null,data,crypto.createPublicKey({key:Buffer.concat([pub,Buffer.from(key)]),format:'der',type:'spki'}),sig),randomBytes:crypto.randomBytes};
const control=load('src/hapa/network/control.js',{crypto:signing,b4a,...encoding},['signBody','verifyBody','keyOfPlayer']);
const memories=new Map();
const persistence={readJson:(p,f)=>structuredClone(memories.get(p)??f),writeJsonAtomic:(p,v)=>memories.set(p,structuredClone(v))};
class FakeCore{
 static stores=new Map();
 constructor(dir){this.dir=dir;if(!FakeCore.stores.has(dir))FakeCore.stores.set(dir,[]);this.records=FakeCore.stores.get(dir);}
 get length(){return this.records.length;}
 async ready(){} async get(i){return structuredClone(this.records[i]);}
 async append(v){this.records.push(...structuredClone(Array.isArray(v)?v:[v]));}
 async close(){}
}
const services=load('src/hapa/network/services.js',{Hypercore:FakeCore,createHash:crypto.createHash,canonicalize:encoding.canonicalize},['ServicePolicy','project','effectivePolicy','defaultDescriptors']);
const {Lobby}=load('src/hapa/network/lobby.js',{b4a,createHash:crypto.createHash},['Lobby']);
const A=identity(0x42),B=identity(0x43);
let releaseMatch;
class ControlledMatch{
 constructor(o){this.o=o;this.dir=o.dir;this.matchId=o.session.descriptor.matchId;this.seat=o.session.seat;const other=this.seat==='A'?'B':'A';this.opponent={...o.session.descriptor.players[other],label:other};this.status='opening';this.history=[];}
 async open(){await new Promise(r=>{releaseMatch=r;});this.status='active';}
 attach(){} async close(){this.closed=true;}
}
class CapturedLobby{
 constructor(o){this.o=o;this.dials=[];}
 async start(){} dial(key){this.dials.push(key);} join(){}
}
const {PeerRuntime}=load('src/hapa/network/runtime.js',{b4a,join,...persistence,...control,fingerprint:encoding.fingerprint,existsSync:()=>true,OnlineMatch:ControlledMatch,Lobby:CapturedLobby},['PeerRuntime']);
function runtime(name){
 const events=[],sent=[];
 const r=new PeerRuntime({root:name,onEvent:e=>events.push(structuredClone(e))});
 r.identity=B;r.store={path:(...ps)=>join(name,...ps)};r.tombstones={attempts:{}};
 r.lobby={announce(){},send:(to,msg)=>sent.push({to,msg}),peers:new Map(),join(){},leaveTopic(){}};
 r.lobbyView=()=>({reservation:r.reservation,match:!!r.match});
 r.attempt={id:name,stage:'negotiating',challengeId:name,cancel:new AbortController(),startedAt:Date.now()};
 return {r,events,sent};
}
function openingFixture(name){
 const f=runtime(name),r=f.r,challengeId=r.attempt.id,matchId='hv-'+challengeId;
 r.reservation={phase:'accepted',role:'joiner',challengeId,matchId,opponent:A.participantId};
 // Already-admitted descriptor compatibility is outside this lifecycle cut; both session signatures
 // are verified by the real _openMatch/control implementation using real Ed25519.
 r._descriptorError=()=>null;
 const descriptor={matchId,players:{A:{participantId:A.participantId,publicKey:A.publicKey},B:{participantId:B.participantId,publicKey:B.publicKey}}};
 const start={descriptor,manifest:{},sig:control.signBody('session',descriptor,A)};
 const peer={playerId:A.participantId};
 const opening=r._serial(()=>r._onStart(peer,start));
 return {...f,challengeId,matchId,peer,opening};
}
const results=[];
{
 const f=openingFixture('cancel-opening-fixed');await Promise.resolve();
 const {r,events,sent,challengeId,matchId,opening}=f;
 assert.equal(r.reservation.phase,'active');assert.equal(r.match.status,'opening');
 r.cancelAttempt({attemptId:challengeId});
 assert.ok(memories.get(join(challengeId,'tombstones.json')).attempts[challengeId]);
 releaseMatch();await opening;await r.attempt.leaving;
 const actual={attempt:r.attempt.stage,reservation:r.reservation,authorityRetained:!!r.match,tombstones:Object.keys(r.tombstones.attempts).length,openedEvents:events.filter(e=>e.kind==='opened').length,startedMessages:sent.filter(x=>x.msg.t==='started').length,progress:memories.get(join(challengeId,'matches',matchId,'progress.json')).status};
 assert.deepEqual(actual,{attempt:'cancelled',reservation:null,authorityRetained:false,tombstones:1,openedEvents:0,startedMessages:0,progress:'abandoned_setup'});
 results.push({id:'A1_original_cancel_open_cut',status:'corrected',actual});
}
{
 const f=openingFixture('cancel-reconnect-cut');await Promise.resolve();
 const {r,events,sent,challengeId,matchId,peer,opening}=f;
 r.cancelAttempt({attemptId:challengeId});
 // Exact reconnect-resend method, called by _onPeer(peer,'joined') outside _setupChain. The
 // authority is still awaiting open(), but durable cancel intent already exists.
 r._resendStart(peer);
 const beforeRelease={attempt:r.attempt.stage,authorityStatus:r.match.status,tombstoned:!!r.tombstones.attempts[challengeId],startedMessages:sent.filter(x=>x.msg.t==='started').length};
 assert.deepEqual(beforeRelease,{attempt:'cancelled',authorityStatus:'opening',tombstoned:true,startedMessages:1});
 const releaseJoiner=releaseMatch;
 // Deliver that actual, correctly signed message to the challenger's exact _onStarted path.
 const host=runtime('reconnect-receiver');host.r.identity=A;host.r.attempt=null;
 host.r.reservation={phase:'starting',role:'challenger',challengeId,matchId,opponent:B.participantId};
 const accepted=memories.get(join(challengeId,'matches',matchId,'session.json'));
 persistence.writeJsonAtomic(host.r.store.path('matches',matchId,'session.json'),{...accepted,sigs:{A:accepted.sigs.A},seat:'A',phase:'starting'});
 const startingHost=host.r._onStarted({playerId:B.participantId,player:{publicKey:B.publicKey}},sent.find(x=>x.msg.t==='started').msg);
 releaseMatch();await startingHost;
 const receiver={reservation:host.r.reservation.phase,authorityStatus:host.r.match.status,openedEvents:host.events.filter(e=>e.kind==='opened').length,session:memories.get(host.r.store.path('matches',matchId,'session.json')).phase};
 assert.deepEqual(receiver,{reservation:'active',authorityStatus:'active',openedEvents:1,session:'active'});
 releaseJoiner();await opening;await r.attempt.leaving;
 const afterRelease={attempt:r.attempt.stage,reservation:r.reservation,authorityRetained:!!r.match,openedEvents:events.filter(e=>e.kind==='opened').length,wireMessages:sent.map(x=>x.msg.t),progress:memories.get(join(challengeId,'matches',matchId,'progress.json')).status};
 assert.deepEqual(afterRelease.wireMessages,['started','decline']);
 results.push({id:'A2_cancelled_reconnect_resends_started',status:'reproduced',beforeRelease,receiver,afterRelease,expected:'A reconnect must not send STARTED for an initializing or tombstoned attempt; all first-send and resend paths must share activation ownership.'});
}
{
 const f=openingFixture('activated-normal');await Promise.resolve();releaseMatch();await f.opening;
 const response=f.r.cancelAttempt({attemptId:f.challengeId});
 assert.equal(response.attempt.stage,'connected');assert.match(response.notCancellable,/already started/);
 assert.equal(f.sent.filter(x=>x.msg.t==='started').length,1);
 results.push({id:'A3_cancel_after_activation',status:'corrected',actual:{attempt:response.attempt.stage,notCancellable:response.notCancellable,authorityRetained:!!f.r.match}});
}
{
 const at=Date.now(),expiresAt=at+60_000;
 const p=new services.ServicePolicy({dir:'expiry-bootstrap',local:{services:[{id:'short-bootstrap',role:'bootstrap',endpoint:{node:'203.0.113.3@short.example:49737'},expiresAt}],retire:services.defaultDescriptors().map(x=>x.id)}});
 const policy=await p.open(),records=p.records.length;
 const {r}=runtime('expiry-join');r.policy=policy;r.services=p;r.lobby=null;r.settings={joined:false};r.compat={};r._transportKeyPair=()=>({});r.o.now=()=>expiresAt+1;
 try{await r.joinLobby({});}finally{clearInterval(r._sweepTimer);}
 assert.deepEqual(r.lobby.o.bootstrap,[]);assert.match(r.lobby.o.noRoute,/no eligible/);assert.equal(p.records.length,records);
 results.push({id:'P1_expiry_at_new_join',status:'corrected',actual:{bootstrap:r.lobby.o.bootstrap,noRoute:r.lobby.o.noRoute,recordCountUnchanged:p.records.length===records,providerState:p.summary().services.find(x=>x.id==='short-bootstrap').state}});
}
{
 const expiresAt=Date.now()+60_000,transport='33'.repeat(32);
 const p=new services.ServicePolicy({dir:'expiry-archive',local:{services:[{id:'archive-x',role:'archive',player:A.participantId,transport,expiresAt}]}});
 const policy=await p.open();assert.equal(policy.archives.length,1);
 const {r}=runtime('archive-join');r.policy=policy;r.services=p;r.lobby=null;r.settings={joined:false};r.compat={};r._transportKeyPair=()=>({});r.o.now=()=>expiresAt+1;
 // This is the initialized runtime cache created by open() lines 105-106.
 r.archives=[...policy.archives];
 try{await r.joinLobby({});}finally{clearInterval(r._sweepTimer);}
 const actual={eligibleArchiveCount:r.policy.archives.length,cachedArchiveCount:r.archives.length,dialledExpiredTransport:r.lobby.dials.includes(transport),providerState:p.summary().services.find(x=>x.id==='archive-x').state};
 assert.deepEqual(actual,{eligibleArchiveCount:0,cachedArchiveCount:1,dialledExpiredTransport:true,providerState:'expired'});
 results.push({id:'P2_expired_archive_used_on_later_join',status:'reproduced',actual,expected:'New automatic configured-service dials must consume current eligible policy, including archives. Existing healthy transport and retained evidence need a separately stated policy.'});
}
{
 const list=[{id:'A',key:'a'.repeat(64)},{id:'B',key:'b'.repeat(64)}];
 const l=new Lobby({relays:()=>list});l.relayState=new Map();
 const picks=Array.from({length:8},()=>l._nextRelay().toString('hex')[0]);
 assert.deepEqual(picks,['a','b','a','b','a','b','a','b']);assert.ok(l.relays.every(r=>r.suspected===0));
 for(const r of l.relays)r.cooldownUntil=Number(process.hrtime.bigint()/1_000_000n)+60_000;
 assert.equal(l._nextRelay(),null);assert.equal(l.relaysExhausted,true);
 results.push({id:'R1_concurrent_handouts_and_exhaustion',status:'corrected',actual:{picks,suspicionsAfterBurst:0,allCoolingPick:null,exhausted:l.relaysExhausted}});
}
{
 let list=[{id:'adopted-relay',key:'a'.repeat(64),endpoint:'198.51.100.1:49740'}];
 const l=new Lobby({relays:()=>list});l.relayState=new Map();
 assert.equal(l._nextRelay().toString('hex'),list[0].key);
 list=[{id:'adopted-relay',key:'b'.repeat(64),endpoint:'198.51.100.2:49740'}];
 const advertised=l._relayList()[0].key,handed=l._nextRelay().toString('hex');
 assert.equal(advertised,'b'.repeat(64));assert.equal(handed,'a'.repeat(64));
 results.push({id:'R2_replaced_relay_key_keeps_cached_buffer',status:'reproduced-component-boundary',actual:{listedKeyPrefix:advertised.slice(0,8),handedKeyPrefix:handed.slice(0,8)},qualification:'A dynamic relay list updates the descriptor under the same id. The current packaged UI does not expose live policy editing; configuration imports on a fresh runtime rebuild the cache. This is a reusable dynamic-policy defect, not evidence of ordinary friend.5 sessions selecting a rotated key.'});
}
const output={sourceCommit:'d0be02d0e4a7b6f6132ce499bf0d45d82b30327f',scope:'controlled exact-source diagnostics; real Ed25519; stubbed storage/transport/startup; no native/installed/WAN claim',sourceFiles,results};
writeFileSync(join(here,'review-probe-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
