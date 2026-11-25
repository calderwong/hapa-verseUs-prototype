/**
 * Review 10 diagnostic witness, not a required permanent suite or production module.
 * Packaged from the executed source-only probe: imports now point to this checkout,
 * and reruns record their actual worktree revision/dirty state.
 * Results committed beside this file are from the original pinned-source run.
 * Fetch is stubbed; no live owner/model calls. One response state is deliberately prepared.
 */
import { createSession, openTick, closeTick } from '../../../../../src/hapa/rules/session.js';
import { profileById, DEFAULT_PROFILE_ID } from '../../../../../fixtures/hapa/profiles.js';
import { CATALOG } from '../../../../../fixtures/hapa/content.js';
import { HeuristicBot } from '../../../../../src/hapa/controllers/heuristic-bot.js';
import { ModelDecider } from '../../../../../src/hapa/controllers/model-decider.js';
import { validatePlan, responseOptions } from '../../../../../src/hapa/rules/match.js';
import { canonicalize } from '../../../../../src/hapa/rules/encoding.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const sourceRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const sourceUnderTest = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: sourceRoot, encoding: 'utf8' }).trim()),
};

const result = { sourceUnderTest, reviewBaseline: '3b812f1877c3d00b080268e57fce5137e574669d', environment: 'headless source-only; fetch stubbed; no model/service/browser calls', probes: {} };
function setup(id) {
 const session = createSession({matchId:id,profile:profileById(DEFAULT_PROFILE_ID),catalog:CATALOG,seed:1});
 const app = {session,ctx:session.ctx,generation:1,get state(){return session.state;}};
 return {session,app,bot:new HeuristicBot({seat:'B',seed:4})};
}
const receipt = req => ({request_id:req.ref.request_id,input_hash:req.ref.input_hash,outcome:'proposal'});
const d = () => new ModelDecider({seat:'B',avatarId:'red-reaper',identityRevision:'red-v1.0'});
function stub(reply) {
 let captured = null;
 globalThis.fetch = async (_url, init) => {
  const body=JSON.parse(init.body);captured=body.request;
  return {ok:true,json:async()=>reply(captured)};
 };
 return () => captured;
}
{
 const {session,app,bot}=setup('review10-funding-witness');
 for(let tick=1;tick<=6;tick++){
  openTick(session);
  const p=bot.plan(app.state,app.ctx);
  closeTick(session,{A:[],B:p},r=>r.seat==='B'?bot.choose(r,app.state,app.ctx):{pass:true});
 }
 openTick(session);
 const getRequest=stub(req=>({proposal:{choices:[{decision:'d1',option:'o3'},{decision:'d2',option:'o1'}],remark:''},receipt:receipt(req)}));
 const out=await d().plan(app,bot);
 const req=getRequest();
 result.probes.combinedFunding={
  label:'ordinary opening reached by six actual resolved Ticks with A passing and B heuristic',
  tick:app.state.tick,
  offered:req.decisions,
  requested:out.receipt.choice,
  actualDestinations:out.commands.filter(c=>c.type==='set_destination'),
  sharedValidator:validatePlan(app.state,app.ctx,'B',out.commands),
  source:out.source,admission:out.receipt.outcome,
  omittedRequestedParty:!out.commands.some(c=>c.type==='set_destination'&&c.partyId==='B.mount.C7')
 };
}
{
 const {session,app,bot}=setup('review10-response-hash');
 openTick(session);
 const cardId=Object.values(app.state.players.B.bank.minor).find(Boolean);
 app.state.cards[cardId].abilityId='fixture.blue_denial';
 app.state.players.B.pool={blue:2};
 app.state.phase='responding';
 app.state.stack=[{id:'S1.1',seat:'A',defId:'fixture.ember_strike',counterable:true,countered:false,target:{}}];
 const req={kind:'response',seat:'B',choiceId:'C1.1',stack:app.state.stack.map(x=>({...x})),options:responseOptions(app.state,app.ctx,'B')};
 app.state.pending=req;
 const expectedFallback=bot.choose(req,app.state,app.ctx);
 const decider=d();
 const getRequest=stub(request=>({proposal:{choices:[{decision:'d1',option:'pass'}],remark:''},receipt:{...receipt(request),input_hash:'0'.repeat(64)}}));
 const answer=await decider.respond(app,bot,req);
 result.probes.responseHash={
  label:'prepared diagnostic response snapshot, not reached by ordinary match',
  preparedCounter:expectedFallback,
  sentInputHash:getRequest().ref.input_hash,
  returnedInputHash:'0'.repeat(64),
  answer,lastReceipt:decider.receipts.at(-1),
  mismatchedHashAdmitted:decider.receipts.at(-1).outcome==='admitted'&&answer.pass===true
 };
}
for(const [label,proposal] of [['emptyChoices',{choices:[],remark:''}],['missingChoices',{remark:''}],['nonArrayChoices',{choices:{decision:'d1',option:'hold'},remark:''}]]){
 const {session,app,bot}=setup('review10-shape-'+label);
 openTick(session);
 const baseline=new HeuristicBot({seat:'B',seed:4}).plan(app.state,app.ctx);
 stub(req=>({proposal,receipt:receipt(req)}));
 const decider=d();
 try{
  const out=await decider.plan(app,bot);
  result.probes[label]={source:out.source,outcome:out.receipt.outcome,equalsStoredFallback:canonicalize(out.commands)===canonicalize(baseline)};
 }catch(error){
  result.probes[label]={throws:error.message,lastReceipt:decider.receipts.at(-1)??null};
 }
}
const testSource=readFileSync(new URL('../../../../../tests/hapa/model-decider.test.js',import.meta.url),'utf8');
const evidence=JSON.parse(readFileSync(new URL('../../../../../docs/integrations/evidence/milestone-c-model-decisions.json',import.meta.url),'utf8'));
result.evidence={
 modelDeciderTestCalls:{plan:(testSource.match(/\.plan\(/g)||[]).length,respond:(testSource.match(/\.respond\(/g)||[]).length},
 admitted:evidence.match.receipts.filter(r=>r.o==='admitted').length,
 admittedWithEmptyChoices:evidence.match.receipts.filter(r=>r.o==='admitted'&&r.ch==='').map(r=>r.t),
 submittedReplayVerification:evidence.match.replayVerify,
 actualReplayArtifactPresent:false,
 note:'Submitted aggregate/abbreviated receipts inspected; no independent replay recomputation from a full replay artifact in this task.'
};
console.log(JSON.stringify(result,null,2));

