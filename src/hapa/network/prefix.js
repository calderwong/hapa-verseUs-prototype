/**
 * Authenticated feed prefixes (review 16, R16-01; p2p-matchmaking-v1 §10). A prefix is a feed's
 * exact first `length` blocks, identified by its key, fork, length and Merkle root. The root is
 * recomputed here from the raw block bytes with Hypercore's own tree hashing (leaf = data hash,
 * parent = node hash over both children and sizes, root = hash over the full roots), so a JSON
 * claim about a root is never trusted: it must match the bytes supplied.
 */
import crypto from 'hypercore-crypto';
import flat from 'flat-tree';
import b4a from 'b4a';

/** Merkle root (hex) of a feed prefix from its raw blocks, identical to `core.treeHash(length)`. */
export function prefixRoot(rawBlocks) {
  const nodes = new Map();
  const node = (idx) => {
    let n = nodes.get(idx);
    if (n) return n;
    if (idx % 2 === 0) { const b = rawBlocks[idx / 2]; n = { index: idx, size: b.byteLength, hash: crypto.data(b) }; }
    else { const [l, r] = flat.children(idx); const a = node(l), c = node(r); n = { index: idx, size: a.size + c.size, hash: crypto.parent(a, c) }; }
    nodes.set(idx, n);
    return n;
  };
  return b4a.toString(crypto.tree(flat.fullRoots(2 * rawBlocks.length).map(node)), 'hex');
}

/** The prefix descriptor of a local or replicated core at `length` (from the core's own tree). */
export async function feedPrefix(core, length) {
  return { key: b4a.toString(core.key, 'hex'), fork: core.fork, length, root: b4a.toString(await core.treeHash(length), 'hex') };
}

/** Raw stored bytes of blocks [from, to). */
export async function rawBlocks(core, from, to) {
  const out = [];
  for (let i = from; i < to; i++) out.push(await core.get(i, { valueEncoding: 'binary' }));
  return out;
}
