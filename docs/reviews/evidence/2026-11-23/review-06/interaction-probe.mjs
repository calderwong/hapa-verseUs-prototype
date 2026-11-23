/**
 * Narrow source probes for response-06. These exercise the checked-in method bodies in isolation
 * with minimal presentation doubles. They are not live-browser or rendered-geometry tests.
 * Run: node docs/reviews/evidence/2026-11-23/review-06/interaction-probe.mjs [repository-root]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const repo = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../../../../../', import.meta.url));
const base = path.join(repo, 'src/hapa/presentation');
const read = (name) => fs.readFileSync(path.join(base, name), 'utf8');
const app = read('app.js');
const method = (name, next) => app.slice(app.indexOf(`  ${name}(`), app.indexOf(next, app.indexOf(`  ${name}(`)));
class El {
  constructor(tag, attrs = {}, ...children) { this.tag = tag; this.attrs = attrs; this.style = {}; this.children = children.flat().filter((x) => x != null); this.hidden = false; }
  append(...xs) { this.children.push(...xs); }
  replaceChildren(...xs) { this.children = xs; }
  remove() { this.removed = true; }
  text() { return this.children.map((x) => x instanceof El ? x.text() : String(x)).join(' '); }
  all() { return [this, ...this.children.flatMap((x) => x instanceof El ? x.all() : [])]; }
}
const h = (tag, attrs, ...children) => new El(tag, attrs, ...children);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const pts = (x) => String(x);
const report = {};

// 1. Execute the actual navigator activation closure: no browser observations are claimed.
const rosterCode = method('_renderRoster', '\n  /**');
const rosterCtor = new Function('h', 'cap', 'pts', 'supplyOf', 'partyShort', 'activeCatalog', 'fmtMana', 'SUIT_NAME', 'SUIT',
  `return class Probe { ${rosterCode} };`)(h, cap, pts, (p) => p.supply, (_s, id) => id, {cards:{}}, () => '', {}, {});
const roster = new rosterCtor();
const p = (id, owner) => ({id, owner, alive:true, retired:false, localColumn:1, kind:'pawn', region:{row:1,column:1}, slots:{1:`${id}.m`}, supply:2, state:'idle'});
roster.state = {parties:{A:p('A','A'),B:p('B','B')}, members:{'A.m':{alive:true},'B.m':{alive:true}}, players:{}};
for (const seat of ['A','B']) roster.state.players[seat] = {bank:{minor:{},major:{},rows:{}},pool:{}};
Object.assign(roster, {viewSeat:'A', selected:{kind:'party',id:'A'}, ctx:{geo:{toGlobal:(_seat,column)=>({column})}}, el:{roster:h('div')}, _plannedSupply:()=>0, _plannedCardIds:()=>new Set(), inspect:{focusSubject(){},blurSubject(){}}, _autoLayer(){}, _renderAll(){}, focusCalls:0, _focusSelection(){this.focusCalls++;}});
roster._renderRoster();
const enemy = roster.el.roster.all().find((el) => el.attrs['aria-label']?.startsWith("B's Pawn"));
assert.ok(enemy);
enemy.attrs.onclick();
report.navigatorEnemyActivation = {selectedBefore:'A',selectedAfter:roster.selected.id,cameraFocusCalls:roster.focusCalls};
assert.equal(roster.selected.id,'B');
assert.equal(roster.focusCalls,1);

// 2. Actual camera.zoom ignores the elevated point's y. Calculate the projection consequence for
// a static representative camera; this calculation is evidence of geometry, not a browser trace.
const cameraSource = read('camera.js').replace(/^import .*;\n/gm,'').replace('export class BoardCamera','class BoardCamera');
const BoardCamera = new Function('THREE','globalUniforms',`${cameraSource}; return BoardCamera;`)({},{});
const projectY = (target, focus, distance, pitch, height=800, fov=24*Math.PI/180) => {
  const dy=target.y-focus.y, dz=target.z-focus.z;
  const viewY=dy*Math.cos(pitch)-dz*Math.sin(pitch);
  const depth=distance-dy*Math.sin(pitch)-dz*Math.cos(pitch);
  return height/2 - height/2 * viewY/depth/Math.tan(fov/2);
};
report.wheelZoomAtElevation=[];
for (const y of [0,6,-6]) {
  const camera = Object.create(BoardCamera.prototype);
  Object.assign(camera,{board:{size:80,center:{x:0,z:0}},goal:{distance:120,focus:{x:0,y:0,z:0}},atHome:true});
  const target={x:0,y,z:0}, pitch=56*Math.PI/180;
  const before=projectY(target,camera.goal.focus,camera.goal.distance,pitch);
  camera.zoom(0.5,target);
  const after=projectY(target,camera.goal.focus,camera.goal.distance,pitch);
  report.wheelZoomAtElevation.push({targetY:y,focusYAfter:camera.goal.focus.y,beforePx:before,afterPx:after,driftPx:after-before});
  assert.equal(camera.goal.focus.y,0);
}

// 3. Execute actual member text and MemberLabels cache with a changed conditional preview.
const textCode=method('_memberText','\n  /**');
let preview={power:1,range:2,elevation:'level',blocked:false};
const TextProbe = new Function('h','cap','pts','rangedPreview','partyShort',`return class Probe { ${textCode} };`)(h,cap,pts,()=>preview,(_s,id)=>id);
const textProbe=new TextProbe(); Object.assign(textProbe,{ctx:{U:1000},state:{}});
const facts={id:'archer',role:'archer',health:{mode:'member',hp:5,max:5},attacks:[{id:'bow',kind:'ranged',power:1,hits:2,range:2,channel:'physical',elevationAware:true}],protection:{physical:{},magic:{}},conditions:[],alive:true};
const beforeText=textProbe._memberText(facts,'enemy');
const labelsSource=read('member-labels.js').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
const MemberLabels=new Function('h',`${labelsSource}; return MemberLabels;`)(h);
const host=h('div'); host.clientWidth=960;host.clientHeight=600;
const labels=new MemberLabels(host);
const model={partyId:'A',members:[{id:'archer',visible:true,anchor:{x:400,y:300},text:beforeText}],party:{anchor:{x:700,y:300},lines:['Party facts'],key:'party'},pxPerMember:100,rowPx:60,expanded:'archer'};
labels.update(model,0);labels.update(model,200);
const beforeDom=labels.els.get('archer').text();
preview={power:2,range:3,elevation:'high_ground',blocked:true};
const afterText=textProbe._memberText(facts,'enemy');
model.members[0].text=afterText;
labels.update(model,400);
const afterDom=labels.els.get('archer').text();
report.previewCache={keyChanged:beforeText.key!==afterText.key,beforeBuiltDetail:beforeText.detail.text(),afterBuiltDetail:afterText.detail.text(),displayedChanged:beforeDom!==afterDom,displayedAfter:afterDom};
assert.notEqual(beforeText.detail.text(),afterText.detail.text());
assert.equal(beforeText.key,afterText.key);
assert.equal(beforeDom,afterDom);

// 4. A party summary with an anchor outside the canvas is still presented at that location.
// CSS overflow:hidden subsequently clips it; this does not purport to measure text rectangles.
model.party.anchor={x:980,y:300};labels.update(model,600);
report.outsideSummary={hostWidth:host.clientWidth,anchorX:980,hidden:labels.partyEl.hidden,transform:labels.partyEl.style.transform};
assert.equal(labels.partyEl.hidden,false);
assert.ok(labels.partyEl.style.transform.includes('980px'));

// 5. The visible Home button and Home key use different app-state paths.
const padCode=method('_renderCamPad','\n  _onHover');
const PadProbe=new Function('h',`return class Probe { ${padCode} };`)(h);
const pad=new PadProbe();
Object.assign(pad,{cam:{homeCalls:0,home(){this.homeCalls++;}},el:{world:h('div')},_returnPose:{name:'old non-home pose'},inspectParty:{partyId:'A',via:'focus'}});
pad._renderCamPad();
pad.el.camPad.all().find((el)=>el.attrs['aria-label']==='Home view (Home)').attrs.onclick();
report.homeButtonState={homeCalls:pad.cam.homeCalls,returnPoseAfter:pad._returnPose,inspectPartyAfter:pad.inspectParty};
assert.ok(pad._returnPose);
assert.ok(pad.inspectParty);
console.log(JSON.stringify(report,null,2));
