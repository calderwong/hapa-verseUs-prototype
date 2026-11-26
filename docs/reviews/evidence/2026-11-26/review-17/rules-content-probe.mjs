// Bounded diagnostic fixtures against the unmodified shared rules.
// Run from a checkout root, or pass the checkout root as the first argument.
// The historical fixture asserts the reviewed defect; it writes JSON only to stdout.
import assert from 'node:assert/strict';
import { resolve as resolvePath, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=pathToFileURL(resolvePath(process.argv[2]??'.')+sep);
const {scenario}=await import(new URL('fixtures/hapa/scenarios.js',root));
const {CATALOG}=await import(new URL('fixtures/hapa/content.js',root));
const {beginCount,validatePlan,resolveTick}=await import(new URL('src/hapa/rules/match.js',root));
const {stateFingerprint}=await import(new URL('src/hapa/rules/state.js',root));
const {validateContent}=await import(new URL('src/hapa/rules/validate.js',root));
const {exportBundle,loadBundle}=await import(new URL('src/hapa/adapters/content.js',root));

const make = (catalog=CATALOG) => {
  const s = scenario({profileId:'hapa_open_10x9_v3_07',catalog, parties:[
    {id:'A.caster',owner:'A',mount:'castle',column:1,row:3,slots:{5:'center'}},
    {id:'B.target',owner:'B',mount:'castle',column:1,row:4,slots:{5:'center'}},
  ]});
  beginCount(s.state,s.ctx);
  // Explicit prepared Card/resource state, not claimed to arise in this opening Tick.
  s.state.players.A.pool={};
  s.state.cards['probe.cast']={id:'probe.cast',owner:'A',column:1,state:'available',category:'minor',abilityId:'fixture.ember_strike',ability:'fixture.ember_strike@1',supply:0,mana:{}};
  s.state.cards['probe.fuel']={id:'probe.fuel',owner:'A',column:2,state:'available',category:'minor',abilityId:'fixture.resource_only',ability:'fixture.resource_only@1',supply:0,mana:{red:1}};
  s.state.players.A.bank.minor['1']='probe.cast';
  s.state.players.A.bank.minor['2']='probe.fuel';
  return s;
};
const action=(burns)=>({type:'play_ability',cardId:'probe.cast',actorPartyId:'A.caster',target:{memberId:'B.target.s5'},burns});
const resolve=(s,command)=>{
  const g=resolveTick(s.state,s.ctx,{A:[command],B:[]});
  let n=g.next();while(!n.done)n=g.next({pass:true});return n.value;
};
const honest=make(), repeated=make();
const honestPlan=validatePlan(honest.state,honest.ctx,'A',[action(['probe.fuel'])]);
const badPlan=validatePlan(repeated.state,repeated.ctx,'A',[action(['probe.fuel','probe.fuel'])]);
assert.equal(honestPlan.ok,false);
assert.equal(badPlan.ok,true);
const unchangedByValidation = repeated.state.cards['probe.fuel'].state==='available' && Object.keys(repeated.state.players.A.pool).length===0;
const events=resolve(repeated,action(['probe.fuel','probe.fuel']));
const burnEvents=events.filter(e=>e.type==='card_burned'&&e.cardId==='probe.fuel');
const damage=events.filter(e=>e.type==='card_damage');
assert.equal(burnEvents.length,2);
assert.ok(damage.length>0);

const counterCase = (duplicate) => {
  const s=make();s.state.players.A.pool={red:2};s.state.players.B.pool={};
  s.state.cards['probe.counter']={id:'probe.counter',owner:'B',column:9,state:'available',category:'minor',abilityId:'fixture.blue_denial',ability:'fixture.blue_denial@1',supply:0,mana:{}};
  s.state.cards['probe.bluefuel']={id:'probe.bluefuel',owner:'B',column:8,state:'available',category:'minor',abilityId:'fixture.resource_only',ability:'fixture.resource_only@1',supply:0,mana:{blue:1}};
  s.state.players.B.bank.minor['9']='probe.counter';s.state.players.B.bank.minor['8']='probe.bluefuel';
  const g=resolveTick(s.state,s.ctx,{A:[action([])],B:[]});
  let n=g.next(), answered=false;
  while(!n.done){
    const req=n.value;
    if(!answered&&req.kind==='response'&&req.seat==='B'){
      answered=true;
      n=g.next({cardId:'probe.counter',actorPartyId:'B.target',target:{stackId:req.stack[0].id},burns:duplicate?['probe.bluefuel','probe.bluefuel']:['probe.bluefuel']});
    }else n=g.next({pass:true});
  }
  const es=n.value;
  return {counterAnnounced:es.some(e=>e.type==='response_announced'),burnedFuelEvents:es.filter(e=>e.type==='card_burned'&&e.cardId==='probe.bluefuel').length,counteredOriginal:es.some(e=>e.type==='ability_countered'&&e.cardId==='probe.cast'),spellDamageEvents:es.filter(e=>e.type==='card_damage'&&e.cardId==='probe.cast').length,rejected:es.filter(e=>e.type==='command_rejected').map(e=>e.reason),fuelState:s.state.cards['probe.bluefuel'].state};
};
const honestCounter=counterCase(false),repeatedCounter=counterCase(true);
assert.equal(honestCounter.counterAnnounced,false);
assert.equal(repeatedCounter.counterAnnounced,true);
assert.equal(repeatedCounter.burnedFuelEvents,2);
assert.equal(repeatedCounter.counteredOriginal,true);

const corrupt=structuredClone(CATALOG);
const broken=structuredClone(CATALOG.cards['fixture.ember_strike']);
broken.id='probe.missing_power';broken.title='Missing power fixture';broken.cost.mana={};delete broken.operations[0].power;
corrupt.cards[broken.id]=broken;
const validation=validateContent(corrupt);
const bundle=exportBundle(corrupt,[broken.id],{exporter:{id:'dev:review-fixture',kind:'local_development_identity'}});
const imported=loadBundle(bundle,CATALOG);
assert.equal(validation.ok,true);
assert.equal(imported.ok,true);
const brokenMatch=make(imported.catalog);
brokenMatch.state.cards['probe.cast'].abilityId=broken.id;
brokenMatch.state.cards['probe.cast'].ability=broken.id+'@1';
const brokenCommand=action([]);
const brokenPlan=validatePlan(brokenMatch.state,brokenMatch.ctx,'A',[brokenCommand]);
assert.equal(brokenPlan.ok,true);
let resolutionError=null,fingerprintError=null,brokenEvents=[];
try {brokenEvents=resolve(brokenMatch,brokenCommand);} catch(e) {resolutionError=e.message;}
try {stateFingerprint(brokenMatch.state);} catch(e) {fingerprintError=e.message;}
const out={
  reviewBaseline:'d113216c8473cf8fc1809e7720cd7a09ad76fa6b',
  sourceIdentityNote:'The source register verifies this baseline run. Record the actual checkout when rerunning.',
  nodeVersion:process.version,
  method:'Explicitly prepared ordinary-cast, response and imported-content diagnostic scenarios; actual unmodified rules/content adapter; no browser, native peer or remote match.',
  duplicateBurn:{
    spellCost:{red:2},uniqueFuelCards:1,fuelMana:{red:1},
    honestAccepted:honestPlan.ok,honestErrors:honestPlan.errors,
    repeatedAccepted:badPlan.ok,sourceStateUnchangedByValidation:unchangedByValidation,burnedSameCardEvents:burnEvents.length,postResolutionFuelState:repeated.state.cards['probe.fuel'].state,
    payments:events.filter(e=>e.type==='mana_paid').map(e=>({assigned:e.assigned,cost:e.cost})),
    damage:damage.map(e=>({recipient:e.recipient,damage:e.damage,cardId:e.cardId})),
    responseVariant:{honest:honestCounter,repeated:repeatedCounter},
  },
  missingOperationField:{
    missingField:'damage.power',contentValidation:validation,bundleImportAccepted:imported.ok,planAccepted:brokenPlan.ok,
    resolutionError,fingerprintError,targetHpIsFinite:Number.isFinite(brokenMatch.state.members['B.target.s5'].hp),
    damageEvents:brokenEvents.filter(e=>e.type==='card_damage').map(e=>({damageIsFinite:Number.isFinite(e.damage),recipient:e.recipient})),
  }
};
assert.ok(fingerprintError||resolutionError||!out.missingOperationField.targetHpIsFinite);
console.log(JSON.stringify(out,null,2));
