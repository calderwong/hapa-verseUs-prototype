/**
 * Review 14: a BoardView must also release its helper's dormant owned resources.
 * Runs actual HitFX.supply/update, resources.collectOwned/release and BoardView.dispose.
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
const scene=new Node(), boardRoot=new Node();scene.add(boardRoot);
const effects=new fx.namespace.HitFX(boardRoot);
for(const [name,t]of Object.entries(effects.tex))t.label='hitfx.'+name;
effects.supply(new Vector3(),'+2 Supply');
const referencesWhileActive=[];boardRoot.traverse(n=>{if(n.material?.map)referencesWhileActive.push(n.material.map);});
const activeBurstReferences=referencesWhileActive.filter(t=>t===effects.tex.burst).length;
effects.update(2); // the actual ordinary expiry path removes the sprites and materials
const board=Object.assign(Object.create(boardModule.namespace.BoardView.prototype),{scene,root:boardRoot,fx:effects,sprites:new Map(),markers:new Map(),cardTiles:new Map(),sheets:new Map()});
const first=board.dispose();
const second=board.dispose();
const result={
  schema:'hapa.versus.review14.expired-fx-disposal.v1',
  reviewBaselineCommit:'3fc3f1b386a03ea2d3f307adc4391e090de4592a',
  source:paths.map((path,i)=>({path,gitBlobSha:createHash('sha1').update(`blob ${data[i].length}\0`).update(data[i]).digest('hex')})),
  method:'Actual HitFX.supply and expiry, followed by actual BoardView.dispose and resources collector, with Three/canvas/unrelated imports as fixtures.',
  limitations:'No real renderer, GPU measurements, browser or network. Confirms dispose calls are omitted for the dormant helper textures; does not quantify GPU growth.',
  activeBurstReferences,
  expired:{items:effects.items.length,children:effects.group.children.length},
  firstBoardDisposal:first,
  secondBoardDisposal:second,
  helperTextures:Object.fromEntries(Object.entries(effects.tex).map(([name,t])=>[name,{disposeCalls:t.disposeCalls,referencedByActiveEffect:referencesWhileActive.includes(t)}])),
  missedPreviouslyUsedTexture:activeBurstReferences>0&&effects.tex.burst.disposeCalls===0,
  networkRequests:0
};
console.log(JSON.stringify(result,null,2));
