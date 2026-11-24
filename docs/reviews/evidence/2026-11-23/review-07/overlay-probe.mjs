// Bounded source-method probe. No browser execution; fake rectangles represent open overlays.
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../../../../src/hapa/presentation/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  _avoidRects(now = performance.now()) {');
const end = source.indexOf('\n  }', start) + 4;
const method = source.slice(start, end).trim();
const el = (x,y,w,h) => ({ hidden: false, offsetParent: {}, getBoundingClientRect: () => ({left:x,top:y,width:w,height:h}) });
const boxes = { command:el(350,650,580,45), inspection:el(280,570,680,70), camera:el(8,8,90,90), rail:el(1210,280,50,160), orders:el(872,8,400,704), navigator:el(8,8,300,704), decision:el(872,8,400,704), matchbar:el(0,-44,1280,40) };
const ctx = vm.createContext({ document:{getElementById:()=>boxes.matchbar} });
const fn = vm.runInContext(`({${method}})._avoidRects`, ctx);
const subject = {el:{world:{getBoundingClientRect:()=>({left:0,top:0}),querySelector:()=>boxes.rail},cmdbar:boxes.command,inspectBar:boxes.inspection,camPad:boxes.camera,orders:boxes.orders,roster:boxes.navigator,decision:boxes.decision},inspect:{}};
const returned = fn.call(subject, 1000);
const same = (r,e) => {const b=e.getBoundingClientRect();return r.x===b.left&&r.y===b.top&&r.w===b.width&&r.h===b.height;};
console.log(JSON.stringify({kind:'isolated actual-source method with synthetic rectangles; not live browser',source:'app.js::_avoidRects',returnedCount:returned.length,includes:Object.fromEntries(Object.entries(boxes).map(([k,v])=>[k,returned.some(r=>same(r,v))]))},null,2));
