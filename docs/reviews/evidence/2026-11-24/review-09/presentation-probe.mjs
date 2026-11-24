// Historical Review 09 probe. Prints results; does not overwrite committed evidence.
// Focused review method probe. Uses exact source methods; no browser or game-file edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MemberLabels } from '../../../../../src/hapa/presentation/member-labels.js';

class Element {
  constructor() { this.nodeType=1; this.children=[]; this.style={}; this.hidden=false; this.isConnected=true; this.offsetWidth=200; this.offsetHeight=60; this.classList={contains(){return false;},remove(){},add(){}}; }
  setAttribute(){} append(...x){this.children.push(...x);} replaceChildren(...x){this.children=x;}
  get textContent(){return this.children.map(x=>x.textContent??'').join('');}
  getBoundingClientRect(){return {left:100,top:200,width:40,height:20,bottom:220};}
}
globalThis.document={createElement(){return new Element();},createTextNode(x){return {nodeType:3,textContent:x};},activeElement:null};
globalThis.CSS={escape:x=>x};
const model=Object.assign(Object.create(MemberLabels.prototype),{
  subject:'A.test',fontSize:'16px',_scaleCheckAt:1000,level:'none',pending:null,
  root:{style:{setProperty(){}},querySelectorAll(){return [];},querySelector(){return null;}},
  host:{clientWidth:1280,clientHeight:720,getBoundingClientRect(){return {left:0,top:0};}},
  els:new Map(),sizes:new Map(),keys:new Map(),chips:new Map(),reading:{hidden:true},readingKey:null,
  leader:{setAttribute(){}},partyEl:{hidden:true,classList:{contains(){return false;}}},tip:new Element()
});
model.tip.hidden=true;
const ref='A.test.s1|health',anchor=new Element();
const m={partyId:'A.test',pxPerMember:50,rowPx:25,expanded:null,
  members:[{id:'A.test.s1',visible:false,anchor:null,chips:[{key:'health',title:'Health',value:'3/3',text:'Current health 3/3'}]}],
  party:{anchor:null,lines:[],key:'test'},avoid:[]};
const checks=[];
model.update(m,1001);
assert.equal(model.showTip(ref,anchor,{pinned:true}),true);
assert.match(model.tip.textContent,/3\/3/);
checks.push('Unavailable body: supplied health is registered and its actual tooltip opens');
m.members[0].chips[0]={key:'health',title:'Health',value:'1/3',text:'Current health 1/3'};
model.update(m,1002);
assert.match(model.tip.textContent,/1\/3/); assert.doesNotMatch(model.tip.textContent,/3\/3/); assert.equal(model.tipPinned,true);
checks.push('Open pinned definition refreshes to changed current health while body remains unavailable');
m.members[0].chips=[]; model.update(m,1003);
assert.equal(model.chips.size,0);assert.equal(model.tip.hidden,true);assert.equal(model.tipFor,null);
checks.push('Removed fact is unregistered and an open definition is dismissed');

// Execute the changed pointer-leave handler extracted verbatim from the current app.
const source=fs.readFileSync(new URL('../../../../../src/hapa/presentation/app.js',import.meta.url),'utf8');
const found=source.match(/onpointerleave: (\(\) => \{ const f = document\.activeElement;[^\n]+?\}),\n\s+onclick: \(e\) => showTip/);
assert.ok(found,'changed fallback pointer-leave handler found');
let shown=null,hidden=0;
const ctx={labels:{hideTip(){hidden++;}}};
const leave=new Function('document','showTip',`return (${found[1]});`).call(ctx,document,(ref,anchor)=>{shown={ref,anchor};});
document.activeElement={classList:{contains:x=>x==='ib-fact'},dataset:{fact:ref}};
leave();assert.equal(shown.ref,ref);assert.equal(shown.anchor,document.activeElement);assert.equal(hidden,0);
checks.push('Pointer departure returns to the keyboard-focused symbol, instead of hiding its explanation');
document.activeElement=null;leave();assert.equal(hidden,1);
checks.push('With no focused symbol, pointer departure dismisses the transient definition');
console.log(JSON.stringify({snapshot:'2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f',methodOnly:true,checks,passed:checks.length},null,2));
