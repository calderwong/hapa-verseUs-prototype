/**
 * Review 20 controlled source-method diagnostics at da8c9e062984aa7ee870b61e771da38460f57854.
 * Run: node review-probe.mjs [checkout]
 * Source blobs are checked against source-register.json. Imports/exports alone are stripped.
 * Actual encoding/control bodies and Ed25519 signatures are used; persistence, Hypercore and
 * OnlineMatch startup are bounded fixtures. This is not native replication, an installed app,
 * actual relay transport, Windows/WAN, or a full gameplay test.
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
const memories=new Map();const persistence={readJson:(p,f)=>structuredClone(memories.get(p)??f),writeJsonAtomic:(p,v)=>memories.set(p,structuredClone(v))};
class FakeCore{static stores=new Map();constructor(dir){this.dir=dir;if(!FakeCore.stores.has(dir))FakeCore.stores.set(dir,[]);this.records=FakeCore.stores.get(dir);this.fork=0;}get length(){return this.records.length;}async ready(){}async get(i){return structuredClone(this.records[i]);}async append(v){this.records.push(...structuredClone(Array.isArray(v)?v:[v]));}async close(){}}
const services=load('src/hapa/network/services.js',{Hypercore:FakeCore,createHash:crypto.createHash,canonicalize:encoding.canonicalize},['ServicePolicy','project','effectivePolicy','POLICY_SCHEMA','PUBLIC_BOOTSTRAP','defaultDescriptors']);
const contacts=load('src/hapa/network/contact.js',{Hypercore:FakeCore,b4a,join,...control,...persistence,fingerprint:encoding.fingerprint,fingerprintOf:k=>String(k).slice(0,16)},['ContactBook','CONTACT_SCHEMA','SNAPSHOT_SCHEMA']);
const {Lobby}=load('src/hapa/network/lobby.js',{b4a,createHash:crypto.createHash},['Lobby']);
const A=identity(0x42),B=identity(0x43),subject=A.participantId,coreKey='ab'.repeat(32),routeA='11'.repeat(32),routeB='22'.repeat(32);
function snap(seq,routes){const body={schema:contacts.SNAPSHOT_SCHEMA,subject,core:coreKey,seq,length:seq+1,transports:routes,at:'2026-11-27T12:00:00.000Z'};return {...body,sig:control.signBody('contact',{kind:'snapshot',...body},A)};}
function record(seq,routes,prev=null){const body={schema:contacts.CONTACT_SCHEMA,subject,core:coreKey,seq,prev,at:'2026-11-27T12:00:00.000Z',sources:['peer-replication'],kind:seq?'update':'binding',transports:routes,retired:[]};return {...body,sig:control.signBody('contact',body,A)};}
const makeBook=name=>new contacts.ContactBook({dir:name,storeFile:name+'.json',self:B.participantId});
const coreOf=rs=>({length:rs.length,fork:0,get:async i=>structuredClone(rs[i])});
const results=[];
const r0=record(0,[routeA]);
{
 const b=makeBook('proof');b.admitSnapshot(snap(0,[routeA]));await b.verifyCore(subject,coreOf([r0]));b.admitSnapshot(snap(1,[routeB]));
 const ev=b.evidenceOf(subject);assert.deepEqual([ev.revision,ev.proof,ev.checkpoint.revision],[1,'snapshot',0]);
 const restarted=makeBook('proof');assert.deepEqual(restarted.evidenceOf(subject),ev);
 results.push({id:'C1',status:'corrected',actual:ev,scope:'newer signed snapshot retains its own snapshot-only evidence across cache reopen'});
}
{
 const b=makeBook('conflict-forward');b.admitSnapshot(snap(0,[routeA]));const outcome=await b.verifyCore(subject,coreOf([record(0,[routeB])]));assert.equal(outcome.ok,false);assert.deepEqual(b.transportsOf(subject),[routeA]);
 const c=makeBook('conflict-reverse');c.cache.contacts[subject]={core:coreKey,accepted:null,checkpoint:null,revisions:{},conflicts:[],retired:[],gen:0};await c.verifyCore(subject,coreOf([r0]));assert.equal(c.admitSnapshot(snap(0,[routeB])).ok,false);assert.deepEqual(c.transportsOf(subject),[routeA]);
 results.push({id:'C2',status:'corrected',forward:b.evidenceOf(subject),reverse:c.evidenceOf(subject)});
}
{
 const b=makeBook('late');b.admitSnapshot(snap(0,[routeA]));let resume;const slow={length:1,fork:0,get:async()=>{await new Promise(r=>{resume=r;});return r0;}};const pending=b.verifyCore(subject,slow);b.admitSnapshot(snap(1,[routeB]));resume();await pending;assert.deepEqual([b.evidenceOf(subject).revision,b.evidenceOf(subject).proof,b.evidenceOf(subject).checkpoint.revision],[1,'snapshot',0]);results.push({id:'C3',status:'corrected',actual:b.evidenceOf(subject)});
}
{
 const p=new services.ServicePolicy({dir:'policy',local:{bootstrap:{mode:'extend',nodes:['203.0.113.1@replacement.example:49737']},retire:services.defaultDescriptors().map(x=>x.id)}});const e=await p.open();assert.deepEqual(e.bootstrap,['203.0.113.1@replacement.example:49737']);
 const no=await p.decide({action:'disable',serviceId:[...p.projection.services.values()].find(s=>s.endpoint.node==='203.0.113.1@replacement.example:49737').id});assert.deepEqual(no.bootstrap,[]);assert.ok(no.noRoute);results.push({id:'P1',status:'corrected',replacement:e.bootstrap,afterDisablingLast:no.bootstrap,noRoute:no.noRoute});
}
{
 const local={bootstrap:{mode:'replace',nodes:['203.0.113.1@a.example:49737','203.0.113.2@b.example:49737']}};const cuts=[];
 for(const k of [1,2,3]){const dir='import'+k;await new services.ServicePolicy({dir}).open();await assert.rejects(new services.ServicePolicy({dir,local,interruptAfter:k}).open(),/interrupted/);const p=new services.ServicePolicy({dir,local});const e=await p.open();assert.deepEqual(e.bootstrap,local.bootstrap.nodes);const n=p.records.length;const again=new services.ServicePolicy({dir,local});await again.open();assert.equal(again.records.length,n);cuts.push({cut:k,bootstrap:e.bootstrap,records:n,incomplete:p.projection.incomplete.length});}results.push({id:'P2',status:'corrected-in-controlled-storage',cuts});
}
let releaseMatch;
class ControlledMatch{constructor(o){this.o=o;this.matchId=o.session.descriptor.matchId;this.seat=o.session.seat;this.opponent={participantId:A.participantId,label:'A'};this.status='active';}async open(){await new Promise(r=>{releaseMatch=r;});}attach(){}async close(){this.closed=true;}}
class CapturedLobby{constructor(o){this.o=o;}async start(){}dial(){}join(){}}
const {PeerRuntime}=load('src/hapa/network/runtime.js',{b4a,join,...persistence,...control,fingerprint:encoding.fingerprint,existsSync:()=>true,OnlineMatch:ControlledMatch,Lobby:CapturedLobby},['PeerRuntime']);
function runtime(name){const events=[],sent=[];const r=new PeerRuntime({root:name,onEvent:e=>events.push(structuredClone(e))});r.identity=B;r.store={path:(...ps)=>join(name,...ps)};r.tombstones={attempts:{}};r.lobby={announce(){},send:(to,msg)=>sent.push({to,msg}),peers:new Map(),join(){}};r.lobbyView=()=>({reservation:r.reservation,match:!!r.match});r.attempt={id:name,stage:'negotiating',challengeId:name,cancel:new AbortController(),startedAt:Date.now()};return {r,events,sent};}
{
 const {r,events}=runtime('cancel-accepted');r.reservation={phase:'accepted',role:'joiner',challengeId:r.attempt.id,matchId:'hv-'+r.attempt.id,opponent:A.participantId};r.cancelAttempt({attemptId:r.attempt.id});await r.attempt.leaving;assert.equal(r.attempt.stage,'cancelled');assert.equal(r.reservation,null);assert.equal(Object.keys(r.tombstones.attempts).length,1);results.push({id:'A1',status:'corrected',stage:r.attempt.stage,tombstones:Object.keys(r.tombstones.attempts).length});
}
{
 const {r,events,sent}=runtime('cancel-opening');const challengeId=r.attempt.id,matchId='hv-'+challengeId;
 r.reservation={phase:'accepted',role:'joiner',challengeId,matchId,opponent:A.participantId};
 // The start is a valid already-admitted fixture; descriptor compatibility is outside this cut.
 r._descriptorError=()=>null;
 const descriptor={matchId,players:{A:{participantId:A.participantId,publicKey:A.publicKey},B:{participantId:B.participantId,publicKey:B.publicKey}}};
 const start={descriptor,manifest:{},sig:control.signBody('session',descriptor,A)};
 const opening=r._serial(()=>r._onStart({playerId:A.participantId},start));
 await Promise.resolve();assert.equal(r.reservation.phase,'active');assert.ok(r.match);assert.equal(r.attempt.stage,'negotiating');
 const response=r.cancelAttempt({attemptId:challengeId});assert.equal(response.attempt.stage,'cancelled');
 releaseMatch();await opening;await r.attempt.leaving;
 const actual={attempt:r.attempt.stage,reservation:r.reservation?.phase,authorityRetained:!!r.match,tombstones:Object.keys(r.tombstones.attempts).length,openedEvents:events.filter(e=>e.type==='match'&&e.kind==='opened').length,startedMessages:sent.filter(x=>x.msg.t==='started').length,durableSessionPhase:memories.get(join('cancel-opening','matches',matchId,'session.json')).phase};
 assert.deepEqual(actual,{attempt:'cancelled',reservation:'active',authorityRetained:true,tombstones:0,openedEvents:1,startedMessages:1,durableSessionPhase:'active'});
 results.push({id:'A2_cancel_during_match_open',status:'reproduced',actual,expected:'Cancellation and the activation boundary must agree: either fence/close the still-opening match with durable leave, or return an explicitly already-connected/non-cancellable state; never cancelled plus an opened active authority.'});
}
{
 const now=Date.now(),expiresAt=now+60_000,expiredAt=expiresAt+1;
 const p=new services.ServicePolicy({dir:'expiry-policy',local:{services:[{id:'short-lived-bootstrap',role:'bootstrap',endpoint:{node:'203.0.113.3@short.example:49737'},expiresAt}],retire:services.defaultDescriptors().map(x=>x.id)}});
 const policy=await p.open();assert.deepEqual(policy.bootstrap,['203.0.113.3@short.example:49737']);
 const {r}=runtime('expiry-join');r.policy=policy;r.services=p;r.lobby=null;r.settings={joined:false};r.compat={};r._transportKeyPair=()=>({});
 const saved=Date.now;Date.now=()=>expiredAt;
 try{await r.joinLobby({});}finally{Date.now=saved;clearInterval(r._sweepTimer);}
 const fresh=services.effectivePolicy(services.project(p.records,expiredAt));
 const actual={expiredAt,expiresAt,passedToNewLobby:r.lobby.o.bootstrap,eligibleAtJoinTime:fresh.bootstrap,recordedState:p.summary().services.find(s=>s.id==='short-lived-bootstrap').state};
 assert.deepEqual(actual.passedToNewLobby,['203.0.113.3@short.example:49737']);assert.deepEqual(actual.eligibleAtJoinTime,[]);assert.equal(actual.recordedState,'active');
 results.push({id:'P3_expired_provider_reused_on_later_join',status:'reproduced',actual,expected:'Recompute time-dependent eligibility before constructing a new lobby/provider attempt; a provider that expired after runtime startup is no longer eligible.'});
}
const output={sourceCommit:'da8c9e062984aa7ee870b61e771da38460f57854',scope:'controlled source-method diagnostics; no native/installed/WAN claim',sourceFiles,results};
writeFileSync(join(here,'review-probe-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
