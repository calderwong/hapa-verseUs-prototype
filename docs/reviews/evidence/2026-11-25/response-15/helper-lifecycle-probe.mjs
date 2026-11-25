/**
 * Response 15 (R14-02): the helper-lifecycle proof, derived from Review 14's expired-fx probe with
 * the same fixtures. It keeps its own handles to HitFX's textures before teardown, because the
 * corrected helper clears its references on dispose. Two cases: (A) the effect expired before the
 * board is disposed; (B) an effect still running when the board is disposed. Each board is then
 * disposed a second time. Runs actual HitFX.supply/update/dispose, resources.collectOwned/release
 * and BoardView.dispose.
 * Three, canvas and unrelated import contracts are fixtures. No WebGL, browser or network.
 * This proves missed dispose calls, not a measured GPU allocation increase.
 * Usage: node --experimental-vm-modules <this-file> <repository-root>
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.argv[2];
if (!root || !vm.SourceTextModule) throw Error('Pass repository root with --experimental-vm-modules');
const paths = ['src/hapa/presentation/board-view.js', 'src/hapa/presentation/fx.js', 'src/hapa/presentation/resources.js'];
const data = await Promise.all(paths.map(p => readFile(resolve(root, p))));
const calls = [];
class Vector3 {
  constructor(x=0,y=0,z=0) { this.set(x,y,z); }
  set(x,y,z) { this.x=x;this.y=y;this.z=z;return this; }
  copy(v) { return this.set(v.x,v.y,v.z); }
  clone() { return new Vector3(this.x,this.y,this.z); }
  add(v) { this.x+=v.x;this.y+=v.y;this.z+=v.z;return this; }
}
class Node {
  constructor() { this.children=[];this.userData={};this.position=new Vector3();this.rotation=new Vector3();this.scale=new Vector3(1,1,1); }
  add(...nodes) { for(const n of nodes) { this.children.push(n);n.parent=this; } }
  remove(n) { this.children=this.children.filter(x=>x!==n);if(n.parent===this)n.parent=null; }
  traverse(fn) { fn(this);for(const n of [...this.children])n.traverse(fn); }
}
class Resource {
  constructor() { this.disposeCalls=0; }
  dispose() { this.disposeCalls++;calls.push(this.label??this.constructor.name); }
}
class CanvasTexture extends Resource { constructor(canvas) { super();this.image=canvas;this.isTexture=true; } }
class Material extends Resource { constructor(o={}) { super();Object.assign(this,o); } }
class Geometry extends Resource {}
const spriteQuad=new Geometry();
class Sprite extends Node { constructor(material) { super();this.material=material;this.geometry=spriteQuad;this.isSprite=true; } }
class Mesh extends Node { constructor(geometry,material) { super();this.geometry=geometry;this.material=material; } }
class Sprite3D extends Node {}
const THREE={Group:Node,CanvasTexture,Sprite,SpriteMaterial:Material,Mesh,MeshBasicMaterial:Material,RingGeometry:Geometry,Vector3,Color:class{},SRGBColorSpace:'srgb',DoubleSide:2};
const canvasContext=new Proxy({measureText:text=>({width:String(text).length*20})},{get:(o,k)=>k in o?o[k]:()=>{}});
const document={createElement:()=>({width:0,height:0,getContext:()=>canvasContext})};
const ctx=vm.createContext({console,document,Map,Set,WeakSet,Math,Number,String,Array,Object});
const synth=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context:ctx});
const three=synth(THREE), palette=synth({HUE:{},INK:{ink:'#000',ivory:'#fff'}});
const resources=new vm.SourceTextModule(data[2].toString(),{context:ctx,identifier:paths[2]});
await resources.link(()=>{throw Error('Unexpected resources import');});await resources.evaluate();
const fx=new vm.SourceTextModule(data[1].toString(),{context:ctx,identifier:paths[1]});
await fx.link(s=>s==='three'?three:s==='./palette.js'?palette:(()=>{throw Error('Unexpected HitFX import '+s);})());await fx.evaluate();
const otherExports={
  '../../../vendor/lumina/src/engine/sprite/Sprite3D.js':{Sprite3D},
  '../../../vendor/lumina/src/engine/pixel/CharacterSprites.js':{createCharacterSheet:()=>{}},
  '../rules/economy.js':{territoryColors:()=>{}},
  '../rules/terrain.js':{surfaceBand:()=>{}},
  './terrain-view.js':{TerrainView:class{},bandY:()=>{},textLabel:()=>{},standingOf:()=>{}},
  './ground-painter.js':{paintGround:()=>{},PX:1},
  './gear.js':{attachGear:()=>{},placeGear:()=>{}},
  '../rules/geometry.js':{FACINGS:[]},
  './playback.js':{bodyVisible:()=>{}},
  './firepit.js':{ResourceSites:class{}},
  './boardframe.js':{buildBoardFrame:()=>{}},
  './territory-diorama.js':{TerritoryDiorama:class{}},
  './pieces.js':{pieceOf:()=>{},standardSprite:()=>{},pieceTexture:()=>{},zoomLevel:()=>{},STANDARD_PX:1,STANDARD_OPACITY:1}
};
const boardModule=new vm.SourceTextModule(data[0].toString(),{context:ctx,identifier:paths[0]});
await boardModule.link(s=>s==='three'?three:s==='./resources.js'?resources:s==='./fx.js'?fx:otherExports[s]?synth(otherExports[s]):(()=>{throw Error('Unexpected board import '+s);})());
await boardModule.evaluate();

const makeBoard=(scene,root,effects)=>Object.assign(Object.create(boardModule.namespace.BoardView.prototype),{scene,root,fx:effects,sprites:new Map(),markers:new Map(),cardTiles:new Map(),sheets:new Map()});
function run(expire){
  const scene=new Node(), boardRoot=new Node();scene.add(boardRoot);
  const effects=new fx.namespace.HitFX(boardRoot);
  for(const [name,t]of Object.entries(effects.tex))t.label='hitfx.'+name;
  const handles={...effects.tex};
  effects.supply(new Vector3(),'+2 Supply');
  const activeParts=effects.items.flatMap(it=>it.parts);
  const burstRefs=activeParts.filter(p=>p.material?.map===handles.burst).length;
  if(expire)effects.update(2); // the ordinary expiry path removes the sprites and materials
  const state={items:effects.items.length,children:effects.group.children.length};
  const board=makeBoard(scene,boardRoot,effects);
  const first=board.dispose(), second=board.dispose(), fxAgain=effects.dispose();
  return {
    case:expire?'A: effect expired before teardown':'B: effect still running at teardown',
    burstReferencesWhileActive:burstRefs, beforeTeardown:state,
    firstBoardDisposal:first, secondBoardDisposal:second, secondHelperDisposal:fxAgain,
    helperTextures:Object.fromEntries(Object.entries(handles).map(([n,t])=>[n,{disposeCalls:t.disposeCalls}])),
    activePartMaterialsDisposedOnce:activeParts.every(p=>p.material.disposeCalls===1),
    helperReferencesCleared:Object.keys(effects.tex).length===0&&effects.items.length===0,
    detachedFromBoard:!boardRoot.children.includes(effects.group),
  };
}
const a=run(true), b=run(false);
const pass=[a,b].every(r=>Object.values(r.helperTextures).every(t=>t.disposeCalls===1)&&r.secondBoardDisposal===null&&r.secondHelperDisposal===null&&r.helperReferencesCleared&&r.detachedFromBoard)&&b.activePartMaterialsDisposedOnce&&spriteQuad.disposeCalls===0;
console.log(JSON.stringify({
  schema:'hapa.versus.response15.helper-lifecycle.v1',
  source:paths.map((path,i)=>({path,gitBlobSha:createHash('sha1').update(`blob ${data[i].length}\0`).update(data[i]).digest('hex')})),
  method:'Actual HitFX, resources and BoardView.dispose with Review 14\'s Three/canvas fixtures; texture handles kept by the probe.',
  limitations:'No real renderer, GPU measurement, browser or network.',
  cases:[a,b], sharedSpriteQuadDisposeCalls:spriteQuad.disposeCalls, pass, networkRequests:0
},null,2));
process.exitCode=pass?0:1;
