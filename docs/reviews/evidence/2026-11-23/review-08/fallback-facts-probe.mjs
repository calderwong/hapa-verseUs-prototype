// Review-only method probe, exact snapshot f7c4f0f; no browser or game changes.
import { MemberLabels } from '../../../../../src/hapa/presentation/member-labels.js';

const model = Object.assign(Object.create(MemberLabels.prototype), {
  subject: 'A.test', fontSize: '16px', _scaleCheckAt: 1000,
  level: 'none', pending: null, root: {style: {setProperty(){}}},
  host: {clientWidth: 1280, clientHeight: 720},
  els: new Map(), sizes: new Map(), keys: new Map(), chips: new Map(),
  reading: {hidden:true}, readingKey: null,
  leader: {setAttribute(){}},
  partyEl: {hidden:true, classList:{contains(){return false;}}},
});
const ref = 'A.test.s1|health';
const m = { partyId:'A.test', pxPerMember:50, rowPx:25, expanded:null,
  members:[{id:'A.test.s1', visible:false, anchor:null, chips:[{key:'health',title:'Health',value:'3/3',text:'Current health 3/3'}]}],
  party:{anchor:null, lines:[], key:'test'}, avoid:[] };
model.update(m,1001);
const missing = {scenario:'first inspection, body unavailable, fallback facts supplied', suppliedFact: m.members[0].chips[0], registryHasFact:model.chips.has(ref), tipOpened: model.showTip(ref,{})};
model.chips.set(ref,{key:'health',value:'3/3'});
m.members[0].chips[0] = {key:'health',title:'Health',value:'1/3',text:'Current health 1/3'};
model.update(m,1002);
const stale = {scenario:'body unavailable while facts change', suppliedValue:m.members[0].chips[0].value, registryValue:model.chips.get(ref)?.value};
console.log(JSON.stringify({snapshot:'f7c4f0f69afbc22458c400f01521e5b468f5f602', methodOnly:true, missing,stale},null,2));
