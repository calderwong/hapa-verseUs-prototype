// frames around one logged onset: node onsetstrip.mjs <seg> <nth-onset> <out>
import fs from 'node:fs';
const [seg, nth, out] = process.argv.slice(2);
const { log } = JSON.parse(fs.readFileSync('signal-log.json'));
const L = log.filter((x) => x.seg === +seg);
const ev = L.filter((x, i) => i && x.on > L[i - 1].on)[+nth];
const list = fs.readFileSync(`seg${seg}/list.txt`, 'utf8').split('\n').filter((l) => l.startsWith('file')).map((l) => l.slice(6, -1));
// frame times: cumulative durations from list.txt; map wall time via first frame ≈ first log wall
const durs = fs.readFileSync(`seg${seg}/list.txt`, 'utf8').split('\n').filter((l) => l.startsWith('duration')).map((l) => +l.split(' ')[1]);
let acc = 0; const times = durs.map((d) => { const t = acc; acc += d; return t; });
const t0 = L[0].wall, at = (ev.wall - t0) / 1000 - 0.15;
const pick = []; for (let k = 0; k < 10; k++) { const want = at + k * 0.1; let best = 0; times.forEach((t, i) => { if (Math.abs(t - want) < Math.abs(times[best] - want)) best = i; }); pick.push(`seg${seg}/${list[best]}`); }
fs.writeFileSync(out, pick.join('\n'));
console.log('onset at song', ev.t.toFixed(2), 'frames', pick[0], '…');
