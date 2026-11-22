/**
 * Sound (Design Companion v1, sound direction): Luminati's procedural AudioSystem (no audio files)
 * voiced from resolved rule events only — a sound never announces something that did not happen.
 * Silent until the first user gesture (browser autoplay rules); a mute toggle is remembered per
 * viewer. A batch plays at most a few voices, spread slightly in time, so a large exchange reads
 * as one clash rather than a wall of noise.
 */
import { AudioSystem } from '../../../vendor/lumina/src/engine/audio/AudioSystem.js';

const KEY = 'hapa-versus.sound.v1';

export class VersusSound {
  constructor() {
    this.audio = new AudioSystem({ volume: 0.5, sfxVolume: 0.8, reverb: 0.22 });
    try { this.muted = localStorage.getItem(KEY) === 'muted'; } catch { this.muted = false; }
    const unlock = () => { this.audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(KEY, this.muted ? 'muted' : 'on'); } catch { /* storage unavailable */ }
    if (!this.muted) this.play('confirm');
    return this.muted;
  }

  play(name, opts) { if (!this.muted) this.audio.playSfx(name, opts); }

  /** Voice a batch of newly reached events (at most six voices). */
  events(events) {
    if (this.muted || !events.length) return;
    const voices = [];
    const add = (name, o = {}) => { if (voices.length < 6) voices.push([name, { ...o, delay: (o.delay ?? 0) + voices.length * 0.045 }]); };
    for (const e of events) {
      switch (e.type) {
        case 'contact': add('guard', { volume: 0.7 }); break;
        case 'exchange': {
          const magic = e.hits.some((h) => h.channel === 'magic'), above = e.hits.some((h) => h.face === 'above');
          const big = e.hits.some((h) => h.damage >= 3e6);
          if (above) add('arrowHit', { volume: 0.6 });
          add(big ? 'crit' : 'hit', { volume: 0.75, pitch: 0.9 + Math.random() * 0.2 });
          if (magic) add('boltHit', { volume: 0.55 });
          break;
        }
        case 'card_damage': add(e.channel === 'magic' ? 'boltHit' : 'hit', { volume: 0.8 }); break;
        case 'ability_announced': case 'response_announced': add('bolt', { volume: 0.55 }); break;
        case 'ability_countered': add('cancel', { volume: 0.7 }); break;
        case 'member_died': add('enemyDie', { volume: 0.45 }); break;
        case 'parties_merged': add('confirm', { volume: 0.5 }); break;
        case 'helper_stepped': case 'breach_advanced': add('step', { volume: 0.6 }); break;
        case 'deposit_extracted': case 'item_crafted': add('pickup', { volume: 0.6 }); break;
        case 'match_ended': add('levelup', { volume: 0.7 }); break;
        default: break;
      }
    }
    for (const [n, o] of voices) this.audio.playSfx(n, o);
  }
}
