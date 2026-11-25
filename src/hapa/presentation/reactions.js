/**
 * What the Avatar opponent says, and when (CJ's defaults, docs/integrations/IMPLEMENTATION_CHECKPOINT.md).
 *
 * Sparse and grounded: a line is chosen only from events the viewer has already been shown (the
 * displayed playback prefix, never the computed future), and it names only facts in those events.
 * Normal mode speaks at a greeting, a party lost or won, a Commander hit, the result and when asked;
 * Quiet only at the result and when asked; Talkative adds Pawn absorption and first contact. The
 * words are authored here (no model, no hidden reasoning claims); the Avatar's voice and renderer
 * come from its owner. Pure: no DOM, no audio, no time.
 */

export const MODES = {
  quiet: new Set(['result', 'question']),
  normal: new Set(['greeting', 'party-lost', 'party-won', 'commander', 'result', 'question', 'kept']),
  talkative: new Set(['greeting', 'party-lost', 'party-won', 'commander', 'result', 'question', 'kept', 'absorbed', 'contact']),
};

/** Priority: a newer line of equal or higher priority replaces a pending one. */
export const PRIORITY = { greeting: 2, absorbed: 1, contact: 1, 'party-won': 3, 'party-lost': 3, commander: 4, kept: 2, question: 5, result: 6 };

const plan = (text, expression = 'neutral', gesture = 'rest', turn = 0) => ({ version: 'hapa.avatar-drive.v1', text, expression, turn, gesture, wink: 'none' });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @param {{ kind: string, priority: number, text: string, plan: any, source: { events: string[] } }} r
 */
const line = (kind, text, expr, gesture, events) => ({ kind, priority: PRIORITY[kind], text, plan: plan(text, expr, gesture), source: { events } });

/** The greeting, true to what the opponent actually brought. */
export function greeting({ name = 'Red', contributedTracks = 0 } = {}) {
  return line('greeting', contributedTracks ? `Good to see you. I brought ${contributedTracks === 1 ? 'a track' : 'a few tracks'}. Let's play.` : `Good to see you. Let's play.`, 'smile', 'rest', []);
}

/**
 * Reactions to newly shown events, most important first (the caller keeps at most one).
 * @param {any[]} shown events just revealed by playback, in order
 * @param {{ seat: 'A'|'B', partyLabel: (id: string) => string, firstContactSeen?: boolean }} o
 */
export function reactionsTo(shown, o) {
  const mine = (partyId) => String(partyId || '').startsWith(`${o.seat}.`);
  const out = [];
  for (const e of shown) {
    if (e.type === 'party_defeated') {
      out.push(mine(e.partyId)
        ? line('party-lost', `I left my ${o.partyLabel(e.partyId)} exposed. Nicely played.`, 'concern', 'rest', [e.id])
        : line('party-won', `That ${o.partyLabel(e.partyId)} is gone. My turn to press.`, 'smile', 'emphasis', [e.id]));
    } else if (e.type === 'member_died' && e.commander) {
      out.push(mine(e.partyId) ? line('commander', 'My Commander has fallen.', 'surprise', 'rest', [e.id]) : line('commander', 'Your Commander is down.', 'surprise', 'rest', [e.id]));
    } else if (e.type === 'parties_merged' && mine(e.partyId)) {
      out.push(line('absorbed', `My ${o.partyLabel(e.partyId)} picked up its Pawn.`, 'smile', 'thumbs-up', [e.id]));
    } else if (e.type === 'contact' && !o.firstContactSeen && (mine(e.a) || mine(e.b))) {
      out.push(line('contact', 'There it is. First contact.', 'surprise', 'emphasis', [e.id]));
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/** The match result, from the Avatar's seat. */
export function resultLine(outcome, seat) {
  if (!outcome || outcome.result === 'unfinished') return null;
  if (outcome.result === 'draw') return line('result', 'A draw. That was close all the way.', 'neutral', 'rest', []);
  return outcome.winner === seat ? line('result', 'Good game. That one went my way.', 'smile', 'thumbs-up', []) : line('result', 'Good game. You earned that.', 'smile', 'rest', []);
}

/** A track the human kept, after the library has acknowledged the saved reference. */
export function keptLine(title) {
  return line('kept', `Glad you liked ${title ? 'that one' : 'it'}.`, 'smile', 'thumbs-up', []);
}

/**
 * A direct question, answered from the opponent's accepted orders and visible facts only — an
 * account of what it did, not a claim about how it decided.
 * @param {string} question
 * @param {{ lastOrders: string[], controller: string }} facts
 */
export function answer(question, facts) {
  const q = String(question || '').toLowerCase();
  if (/why|what.*(do|did|doing)|move|plan|order/.test(q)) {
    if (!facts.lastOrders.length) return line('question', 'This Tick I gave no new orders; my parties keep their routes.', 'neutral', 'rest', []);
    return line('question', `This Tick I ${spokenOrders(facts.lastOrders)}. That is the plan I committed.`, 'neutral', 'rest', []);
  }
  if (/who|how.*(play|decide|think)|bot|model|ai/.test(q)) return line('question', `My moves this match come from ${facts.controller}. I am still Red either way.`, 'smile', 'rest', []);
  if (/song|music|track/.test(q)) return line('question', 'The songs I brought come from my library. Keep any you like.', 'smile', 'rest', []);
  return line('question', 'Ask me about my last move, or about the music.', 'neutral', 'rest', []);
}

/**
 * The opponent's committed orders as one spoken sentence fragment (plain words; no symbols).
 * @param {{ type: string, party: string|null, column: number|null, ability: string|null }[]} orders
 */
export function spokenOrders(orders) {
  const parts = [];
  const loads = orders.filter((o) => o.type === 'load_supply');
  if (loads.length) {
    const parties = [...new Set(loads.map((o) => o.party).filter(Boolean))];
    parts.push(`loaded Supply ${loads.length === 1 ? 'once' : `${loads.length} times`}${parties.length ? ` into my ${parties.slice(0, 2).join(' and ')}` : ''}`);
  }
  for (const o of orders) {
    if (o.type === 'set_destination' || o.type === 'retreat') parts.push(`${o.type === 'retreat' ? 'pulled back' : 'sent'} my ${o.party ?? 'party'}${o.column ? ` toward column ${o.column}` : ''}`);
    else if (o.type === 'play_ability') parts.push(`cast ${o.ability ?? 'an ability'}`);
    else if (o.type === 'change_formation') parts.push(`turned my ${o.party ?? 'party'}`);
  }
  const burns = orders.filter((o) => o.type === 'burn').length;
  if (burns) parts.push(`burned ${burns === 1 ? 'a card' : `${burns} cards`} for Mana`);
  const said = parts.slice(0, 3);
  return said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said.at(-1)}` : said[0] ?? 'kept my routes';
}
