/**
 * Review 13 focused diagnostic of non-playing Play and Previous chronology.
 * Actual Soundtrack module, fixture audio/fetch/storage; no browser/network/owner changes.
 * Usage: node transport-state-probe.mjs <repository-root>
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = process.argv[2];
if (!root) throw Error('Pass repository root');
const file = resolve(root, 'src/hapa/presentation/soundtrack.js');
const bytes = await readFile(file);
const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
class FakeAudio extends EventTarget {
  constructor() { super(); this.calls=[]; this.paused=true; this.ended=false; this.currentTime=0; this.duration=100; this.volume=1; this.readyState=1; this._src=null; }
  set src(v) { this.calls.push('src'); this._src=v; this.currentTime=0; this.ended=false; }
  get src() { return this._src; }
  getAttribute(k) { return k==='src'?this._src:null; }
  removeAttribute() { this.calls.push('removeSrc'); this._src=null; }
  load() { this.calls.push('load'); this.currentTime=0; this.ended=false; }
  play() { this.calls.push('play'); this.paused=false; this.ended=false; queueMicrotask(()=>this.dispatchEvent(new Event('playing'))); return Promise.resolve(); }
  pause() { this.calls.push('pause'); this.paused=true; }
}
globalThis.Audio=FakeAudio;
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const offer=n=>({manifest:{files:[{assetId:`sha256:${String(n).repeat(64)}`}],recording:{id:`rec-${n}`}}});
const snap={playlistId:'p-red',revision:1,contributor:{nodeId:'red-node',label:'Red',participant:{label:'Red',avatarId:'red-reaper'}},entries:[1,2,3].map(n=>({entryId:`song-${n}`,recordingId:`rec-${n}`,title:`Song ${n}`,durationSeconds:100,offer:offer(n)}))};
const requests=[];
globalThis.fetch=async(url,options={})=>{
  requests.push({url,method:options.method??'GET'});
  const json=v=>new Response(JSON.stringify(v),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/retained'))return json({entries:[]});
  if(url.endsWith('/encounters'))return json({encounters:[]});
  if(url.endsWith('/contributions'))return json(snap);
  if(url.endsWith('/audio'))return new Response(new Blob([new Uint8Array(8)]),{status:200});
  throw Error('Unexpected request '+url);
};
const {Soundtrack}=await import(pathToFileURL(file).href);
const settle=()=>new Promise(r=>setTimeout(r,6));
async function make(){const m=new Soundtrack({sessionId:'fixture',epoch:1,listener:{library:'cj',seat:'A',label:'You'},controller:true});await m.prepare([{library:'red',songIds:['1','2','3'],participant:{label:'Red'}}]);m.start();await settle();return m;}
const state=m=>({status:m.status,listening:m.settings.listening,mode:m.mode,key:m.now?.key,paused:m.audio.paused,time:m.audio.currentTime,plays:m.audio.calls.filter(c=>c==='play').length,generation:m.playGen});

// A real error event in replay mode creates a terminal state (no automatic table skip timer).
const a=await make();a.playItem(a.now,[a.now],'queue');await settle();a.audio.paused=true;a.audio.dispatchEvent(new Event('error'));
const failedBefore=state(a);a.togglePlay();await settle();const failedFirst=state(a);a.togglePlay();await settle();const failedSecond=state(a);a.dispose();

// The final table track naturally ends; the deck presents Play while listening remains true.
const b=await make();b.next();await settle();b.next();await settle();b.audio.currentTime=100;b.audio.paused=true;b.audio.ended=true;b.audio.dispatchEvent(new Event('ended'));
const finishedBefore=state(b);b.togglePlay();await settle();const finishedFirst=state(b);b.togglePlay();await settle();const finishedSecond=state(b);b.dispose();

// After hearing 1,2,3, replay 1, Return to 3 and press Previous near its beginning.
// First-heard ordering selects 2, despite 1 being the most recently heard other recording.
const c=await make();c.next();await settle();c.next();await settle();const table=c.now;c.audio.currentTime=20;
const first=c.played[0].item;c.playItem(first,c.played.map(p=>p.item),'played');await settle();c.returnToTable();await settle();c.seek(0);
const chronologyBefore={...state(c),history:c.played.map(p=>({key:p.item.key,firstAt:p.firstAt,lastAt:p.lastAt,plays:p.plays})),expectedPrevious:first.key};
c.previous();await settle();const chronologyAfter=state(c);c.dispose();

console.log(JSON.stringify({schema:'hapa.versus.review13.transport-state-probe.v1',reviewBaselineCommit:'e04286188e13800e588557bd5cb53a9b0e3724c0',source:{path:file,gitBlobSha:gitBlob},method:'Actual prepare/start/playItem/error event/ended event/togglePlay/next/seek/previous/Return with local audio/fetch/storage fixtures',limitations:'No browser hit testing, real audio output or owner calls. The failing/finished Play label is separately established from MusicDeck.patch source.',failedPlay:{before:failedBefore,firstClick:failedFirst,secondClick:failedSecond},finishedPlay:{before:finishedBefore,firstClick:finishedFirst,secondClick:finishedSecond},previousChronology:{before:chronologyBefore,after:chronologyAfter},networkRequests:0,fixtureRequests:requests.length},null,2));
