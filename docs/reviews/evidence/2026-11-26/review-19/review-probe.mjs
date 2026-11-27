/**
 * Focused reviewer diagnostics for Hapa Versus b42f555e35f7686dd3391e4f00f64a03875b5fb5.
 * Run beside the retrieved source/ folder: node review-probe.mjs
 * Or with an explicit checkout at the reviewed commit: node review-probe.mjs /path/to/checkout
 *
 * Executes pinned module bodies with import/export declarations removed and supplied dependencies.
 * Canonicalization/fingerprinting/control signing bodies are the pinned source. Ed25519 uses Node
 * crypto with the same raw-key and detached-signature format; signature admission is not bypassed.
 * Hypercore and JSON persistence are controlled in-memory fixtures. No native replication, Electron,
 * actual provider outage, Windows execution, or WAN behavior is claimed by these diagnostics.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as nodeCrypto from 'node:crypto';
import assert from 'node:assert/strict';

const here=dirname(fileURLToPath(import.meta.url));
const source=process.argv[2] ? resolve(process.argv[2]) : join(here,'source');
const checkedFiles=new Map();
const expectedBlobs=new Map(JSON.parse(readFileSync(join(here,'source-register.json'),'utf8')).files.map(f=>[f.path,f.blob]));
function loadModule(path, dependencies, names) {
  const raw=readFileSync(join(source,path),'utf8');
  const bytes=Buffer.from(raw,'utf8');
  const blob=nodeCrypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(expectedBlobs.get(path)!==blob) throw new Error('Historical diagnostic requires the pinned GitHub blob for '+path);
  checkedFiles.set(path,nodeCrypto.createHash('sha256').update(raw).digest('hex'));
  const body=raw.replace(/^import .+ from .+;\s*$/gm,'')
    .replace(/^export \{.*\};\s*$/gm,'')
    .replace(/\bexport (?=class |function |const |async function )/g,'');
  return new Function(...Object.keys(dependencies),body+'\nreturn {'+names.join(',')+'};')(...Object.values(dependencies));
}
const encoding=loadModule('src/hapa/rules/encoding.js',{},['canonicalize','fingerprint','utf8','parseStrict']);
const b4a={from:(...args)=>Buffer.from(...args),toString:(buf,encoding)=>Buffer.from(buf).toString(encoding)};
const PRIVATE_PREFIX=Buffer.from('302e020100300506032b657004220420','hex');
const PUBLIC_PREFIX=Buffer.from('302a300506032b6570032100','hex');
const privateKey=nodeCrypto.createPrivateKey({key:Buffer.concat([PRIVATE_PREFIX,Buffer.alloc(32,0x42)]),format:'der',type:'pkcs8'});
const publicRaw=nodeCrypto.createPublicKey(privateKey).export({format:'der',type:'spki'}).subarray(-32);
const secretRaw=Buffer.concat([Buffer.alloc(32,0x42),publicRaw]);
const signing={
  sign(data,key){const k=nodeCrypto.createPrivateKey({key:Buffer.concat([PRIVATE_PREFIX,Buffer.from(key).subarray(0,32)]),format:'der',type:'pkcs8'});return nodeCrypto.sign(null,data,k);},
  verify(data,sig,key){const k=nodeCrypto.createPublicKey({key:Buffer.concat([PUBLIC_PREFIX,Buffer.from(key)]),format:'der',type:'spki'});return nodeCrypto.verify(null,data,k,sig);},
  randomBytes:nodeCrypto.randomBytes,
};
const control=loadModule('src/hapa/network/control.js',{crypto:signing,b4a,...encoding},['signBody','verifyBody','keyOfPlayer']);
const memories=new Map();
const persistence={
  readJson:(file,fallback)=>structuredClone(memories.get(file)??fallback),
  writeJsonAtomic:(file,data)=>memories.set(file,structuredClone(data)),
};
class FakeCore {
  static stores=new Map();
  static fault=null;
  constructor(dir){this.dir=dir;if(!FakeCore.stores.has(dir))FakeCore.stores.set(dir,[]);this.records=FakeCore.stores.get(dir);this.fork=0;}
  get length(){return this.records.length;}
  async ready(){}
  async get(index){return structuredClone(this.records[index]);}
  async append(record){if(FakeCore.fault?.(record,this))throw new Error('injected crash before append');this.records.push(structuredClone(record));}
  async close(){}
}
const services=loadModule('src/hapa/network/services.js',{Hypercore:FakeCore,createHash:nodeCrypto.createHash,canonicalize:encoding.canonicalize},
  ['POLICY_SCHEMA','SERVICE_SCHEMA','PUBLIC_BOOTSTRAP','PUBLIC_OVERLAY','defaultDescriptors','project','effectivePolicy','ServicePolicy']);
const contact=loadModule('src/hapa/network/contact.js',{Hypercore:FakeCore,b4a,join,...control,...persistence,fingerprint:encoding.fingerprint,fingerprintOf:(key)=>String(key).slice(0,16)},
  ['CONTACT_SCHEMA','SNAPSHOT_SCHEMA','ContactBook','checkSnapshot','checkRecord']);
const {Lobby}=loadModule('src/hapa/network/lobby.js',{b4a,createHash:nodeCrypto.createHash},['Lobby']);

const results=[];
function report(id,actual,expected,sourceLocations){results.push({id,reproduced:true,actual,expected,sourceLocations});}
const subject='hv1:'+publicRaw.toString('hex');
const identity={secretKey:secretRaw.toString('hex'),participantId:subject};
const coreKey='ab'.repeat(32),routeA='11'.repeat(32),routeB='22'.repeat(32);
function snapshot(seq,transports){
 const body={schema:contact.SNAPSHOT_SCHEMA,subject,core:coreKey,seq,length:seq+1,transports,at:'2026-11-27T00:00:00.000Z'};
 return {...body,sig:control.signBody('contact',{kind:'snapshot',...body},identity)};
}
function record(seq,transports,prev=null){
 const body={schema:contact.CONTACT_SCHEMA,subject,core:coreKey,seq,prev,at:'2026-11-27T00:00:00.000Z',sources:['peer-replication'],kind:seq?'update':'binding',transports,retired:[]};
 return {...body,sig:control.signBody('contact',body,identity)};
}
function book(name){return new contact.ContactBook({dir:name,storeFile:name+'.json',self:'hv1:'+'ff'.repeat(32)});}
function attachRecords(b,records){b.cores.set(subject,{length:records.length,fork:0,get:async i=>structuredClone(records[i])});}

// Signature checks are real: unmodified signatures admit; a changed route without re-signing refuses.
const signedSnapshot=snapshot(0,[routeA]);
assert.equal(contact.checkSnapshot(signedSnapshot),null);
assert.match(contact.checkSnapshot({...signedSnapshot,transports:[routeB]}),/signature/);
const recordA=record(0,[routeA]);
assert.equal(contact.checkRecord(recordA,{subject,core:coreKey,seq:0,prev:null}),null);

// C1: "core verified" proof is incorrectly carried onto an unreplicated newer snapshot.
{
 const b=book('c1');
 assert.equal(b.admitSnapshot(signedSnapshot).ok,true);
 attachRecords(b,[recordA]);
 assert.equal((await b.verifyCore(subject)).ok,true);
 assert.equal(b.cache.contacts[subject].evidence,'core-verified');
 assert.equal(b.admitSnapshot(snapshot(1,[routeB])).ok,true);
 const c=b.cache.contacts[subject];
 assert.equal(c.seq,1);
 assert.equal(c.checkpoint.length,1);
 assert.equal(c.evidence,'core-verified'); // reproduces bug, not the desired behavior
 report('C1_newer_snapshot_inherits_old_core_proof',
  {acceptedSequence:c.seq,verifiedCheckpointLength:c.checkpoint.length,evidence:c.evidence,summary:b.summary()},
  {currentEvidence:'snapshot',verifiedSequence:0,acceptedSequence:1},
  ['src/hapa/network/contact.js:132-148','src/hapa/network/contact.js:194']);
}

// C2: two valid root-signed statements disagree at the same sequence; later core read silently wins.
{
 const b=book('c2'),conflictingRecord=record(0,[routeB]);
 assert.equal(b.admitSnapshot(signedSnapshot).ok,true);
 assert.equal(contact.checkRecord(conflictingRecord,{subject,core:coreKey,seq:0,prev:null}),null);
 attachRecords(b,[conflictingRecord]);
 const outcome=await b.verifyCore(subject);
 assert.equal(outcome.ok,true);
 assert.deepEqual(b.cache.contacts[subject].transports,[routeB]);
 assert.equal(b.rejected.length,0);
 report('C2_conflicting_same_sequence_snapshot_and_core_accepted',
  {snapshotRoute:routeA,recordRoute:routeB,result:outcome,cacheRoute:b.cache.contacts[subject].transports[0],rejections:b.rejected},
  {result:'conflict',preserveBothSignedStatements:true,noSilentRouteReplacement:true},
  ['src/hapa/network/contact.js:174-191']);
}

// P1: final retirement in the history does not remove bundled bootstrap nodes from effective options.
{
 let seq=0;
 const at='2026-11-27T00:00:00.000Z';
 const records=services.defaultDescriptors().map(d=>({schema:services.POLICY_SCHEMA,seq:seq++,at,action:'seed',service:d,provenance:{kind:'bundled-default',digest:d.id}}));
 for(const d of services.defaultDescriptors())records.push({schema:services.POLICY_SCHEMA,seq:seq++,at,action:'retire',serviceId:d.id,provenance:{kind:'user',digest:'retire-'+d.id}});
 records.push({schema:services.POLICY_SCHEMA,seq:seq++,at,action:'add',service:{id:'replacement',role:'bootstrap',endpoint:{node:'bootstrap.example.test:49737'},overlay:services.PUBLIC_OVERLAY},provenance:{kind:'user',digest:'replacement'}});
 const projection=services.project(records);
 const effective=services.effectivePolicy(projection);
 assert(services.defaultDescriptors().every(d=>projection.services.get(d.id).state==='retired'));
 assert(services.PUBLIC_BOOTSTRAP.every(n=>effective.bootstrap.includes(n)));
 report('P1_retired_bootstrap_nodes_resurrected',
  {projectedStates:Object.fromEntries([...projection.services].map(([k,v])=>[k,v.state])),effectiveBootstrap:effective.bootstrap,warnings:effective.warnings},
  {effectiveBootstrap:['bootstrap.example.test:49737'],retiredNodesUsed:0},
  ['src/hapa/network/services.js:121-142','src/hapa/network/services.js:145-166']);
}

// P2: after only one event of a multi-event import, its digest is considered complete after restart.
{
 const config={bootstrap:{mode:'replace',nodes:['one.example.test:49737','two.example.test:49737']}};
 let localAppendCount=0;
 FakeCore.fault=(r)=>r.provenance?.kind==='local-config-import' && ++localAppendCount===2;
 const p1=new services.ServicePolicy({dir:'partial-import',local:config});
 await assert.rejects(p1.open(),/injected crash/);
 const atCrash=FakeCore.stores.get('partial-import').filter(r=>r.provenance?.kind==='local-config-import').map(r=>({action:r.action,id:r.service?.id??null,mode:r.mode??null}));
 FakeCore.fault=null;
 const p2=new services.ServicePolicy({dir:'partial-import',local:config});
 const effective=await p2.open();
 const afterRestart=p2.records.filter(r=>r.provenance?.kind==='local-config-import').map(r=>({action:r.action,id:r.service?.id??null,mode:r.mode??null}));
 assert.equal(afterRestart.length,1);
 assert.equal(effective.mode,'default');
 assert(!effective.bootstrap.includes('two.example.test:49737'));
 report('P2_partial_policy_import_never_resumed',
  {atCrash,afterRestart,effectiveMode:effective.mode,effectiveBootstrap:effective.bootstrap},
  {allAcceptedConfigEventsDurable:true,mode:'replace',bootstrap:['one.example.test:49737','two.example.test:49737']},
  ['src/hapa/network/services.js:126','src/hapa/network/services.js:190-208']);
}

// R1: once A was observed working, repeated later relay requests cannot advance to B for ten minutes.
{
 const lobby=new Lobby({});
 const t=Number(process.hrtime.bigint()/1_000_000n);
 lobby.relays=[{id:'previously-good-now-offline',buf:Buffer.alloc(32,0x11),handed:0,observed:t-1000},{id:'available-alternate',buf:Buffer.alloc(32,0x22),handed:0,observed:0}];
 const selected=Array.from({length:8},()=>lobby._nextRelay().toString('hex'));
 assert(selected.every(k=>k==='11'.repeat(32)));
 assert.equal(lobby.relays[1].handed,0);
 report('R1_recent_success_starves_alternate_relay',
  {selectionCount:selected.length,selectedIds:selected.map(k=>k==='11'.repeat(32)?lobby.relays[0].id:lobby.relays[1].id),alternateHanded:lobby.relays[1].handed},
  {afterUnsuccessfulRetry:'bounded rotation or cooldown reaches alternate; historical success does not pin every retry'},
  ['src/hapa/network/lobby.js:46-55','src/hapa/network/lobby.js:64-72']);
}

// A1: cancel an already accepted attempt: durable leave is done, but its public terminal state is failed.
{
 const runtimeRaw=readFileSync(join(source,'src/hapa/network/runtime.js'),'utf8');
 checkedFiles.set('src/hapa/network/runtime.js',nodeCrypto.createHash('sha256').update(runtimeRaw).digest('hex'));
 function between(start,end){const i=runtimeRaw.indexOf(start),j=runtimeRaw.indexOf(end,i);assert(i>=0&&j>i);return runtimeRaw.slice(i,j);}
 const exactMethods=[
   between('  _reserve(r) {','  _publicReservation()'),
   between('  setupLeave(args) {','  /** Serialize every decision'),
   between('  _setStage(a, stage, error = null) {','  /**\n   * Cancel a live attempt.'),
   between('  cancelAttempt(args) {','  /** Join an open table seen in the lobby'),
 ].join('\n');
 const fixture=new Function('writeJsonAtomic','existsSync','return new class {\n'+exactMethods+'\n}')(persistence.writeJsonAtomic,()=>false);
 Object.assign(fixture,{reservation:{phase:'accepted',challengeId:'12'.repeat(16),matchId:'hv-test',opponent:'hv1:other'},attempt:{id:'attempt-probe-0001',kind:'table',challengeId:'12'.repeat(16),stage:'negotiating',startedAt:Date.now(),cancel:new AbortController()},tombstones:{attempts:{}},store:{path:(...p)=>p.join('/')},lobby:{send(){},announce(){}},emit(){},_publicReservation(){return this.reservation;},lobbyView(){return {reservation:this.reservation};}});
 const result=fixture.cancelAttempt({attemptId:'attempt-probe-0001'});
 assert.equal(result.attempt.stage,'failed');
 assert.equal(fixture.reservation,null);
 assert(fixture.tombstones.attempts['12'.repeat(16)]);
 report('A1_accepted_attempt_cancel_reports_failed',
  {stage:result.attempt.stage,error:result.attempt.error,reservation:fixture.reservation,tombstoneWritten:!!fixture.tombstones.attempts['12'.repeat(16)]},
  {stage:'cancelled',durableTombstone:true,reservation:null},
  ['src/hapa/network/runtime.js:170-173','src/hapa/network/runtime.js:333-342','src/hapa/network/runtime.js:393-415']);
}

const output={
 reviewedCommit:'b42f555e35f7686dd3391e4f00f64a03875b5fb5',
 level:'controlled exact-source-method diagnostics; fixture persistence/transport; valid Node Ed25519 signatures',
 limitations:['No native Hypercore/Hyperswarm dependency execution','No Electron or Windows process execution','No public-network or forced-relay success witness','Diagnostics deliberately assert current undesired behavior to make review reproductions deterministic'],
 checkedFilesSha256:Object.fromEntries(checkedFiles),
 resultCount:results.length,results,
};
writeFileSync(join(here,'review-probe-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({reviewedCommit:output.reviewedCommit,level:output.level,resultCount:results.length,results:results.map(r=>({id:r.id,reproduced:r.reproduced,actual:r.actual})),evidence:join(here,'review-probe-results.json')},null,2));

