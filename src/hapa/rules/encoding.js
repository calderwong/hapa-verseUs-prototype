/**
 * public_protocol_v1 — canonical encoding and fingerprints (Master Requirements v3, Appendix B).
 *
 * A hashed or signed value is JSON made of objects, arrays, strings, booleans, null and safe
 * integers. Canonical bytes: object keys sorted by UTF-16 code units (written directly, never by
 * rebuilding an object), arrays in order, no whitespace, ECMAScript string escaping, UTF-8.
 * The fingerprint is SHA-256 of those bytes, shown as `sha256:<64 hex>`.
 *
 * Pure JavaScript and synchronous so the rules run the same way in Node, a browser and a bot.
 */

export class EncodingError extends Error {
  /** @param {string} message @param {string} path */
  constructor(message, path) {
    super(`${message} at ${path || '$'}`);
    this.name = 'EncodingError';
    this.path = path;
  }
}

/** UTF-16 code unit order (JavaScript's default string comparison). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Canonical JSON text of a value; throws EncodingError for anything public_protocol_v1 rejects.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  const out = [];
  write(value, '$', out);
  return out.join('');
}

function write(v, path, out) {
  if (v === null) { out.push('null'); return; }
  switch (typeof v) {
    case 'boolean': out.push(v ? 'true' : 'false'); return;
    case 'number':
      if (!Number.isFinite(v)) throw new EncodingError('non-finite number', path);
      if (!Number.isInteger(v)) throw new EncodingError(`decimal number ${v}`, path);
      if (!Number.isSafeInteger(v)) throw new EncodingError(`unsafe integer ${v}`, path);
      if (Object.is(v, -0)) throw new EncodingError('negative zero', path);
      out.push(String(v));
      return;
    case 'string':
      checkSurrogates(v, path);
      out.push(JSON.stringify(v));
      return;
    case 'object': {
      if (Array.isArray(v)) {
        out.push('[');
        for (let i = 0; i < v.length; i++) {
          if (!(i in v)) throw new EncodingError('sparse array', `${path}[${i}]`);
          if (i) out.push(',');
          write(v[i], `${path}[${i}]`, out);
        }
        out.push(']');
        return;
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new EncodingError('non-plain object', path);
      const keys = Object.keys(v).sort(byCodeUnit);
      out.push('{');
      let first = true;
      for (const k of keys) {
        if (v[k] === undefined) throw new EncodingError(`undefined value for "${k}"`, path);
        checkSurrogates(k, path);
        if (!first) out.push(',');
        first = false;
        out.push(JSON.stringify(k), ':');
        write(v[k], `${path}.${k}`, out);
      }
      out.push('}');
      return;
    }
    default:
      throw new EncodingError(`unsupported ${typeof v}`, path);
  }
}

function checkSurrogates(s, path) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (!(d >= 0xdc00 && d <= 0xdfff)) throw new EncodingError('unpaired surrogate', path);
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      throw new EncodingError('unpaired surrogate', path);
    }
  }
}

/**
 * Strict parse: ordinary JSON.parse silently keeps the last duplicate key, so scan for duplicates
 * first, then reject values canonicalize would reject.
 * @param {string} text
 */
export function parseStrict(text) {
  rejectDuplicateKeys(text);
  const v = JSON.parse(text);
  canonicalize(v);
  return v;
}

function rejectDuplicateKeys(text) {
  // a small JSON tokenizer: track the keys of each open object
  const stack = [];
  let i = 0;
  const n = text.length;
  let expectKey = false;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const raw = text.slice(i, j + 1);
      const top = stack[stack.length - 1];
      if (top && top.type === 'o' && expectKey) {
        const key = JSON.parse(raw);
        if (top.keys.has(key)) throw new EncodingError(`duplicate key "${key}"`, '$');
        top.keys.add(key);
        expectKey = false;
      }
      i = j + 1;
      continue;
    }
    if (c === '{') { stack.push({ type: 'o', keys: new Set() }); expectKey = true; }
    else if (c === '[') { stack.push({ type: 'a' }); }
    else if (c === '}' || c === ']') { stack.pop(); }
    else if (c === ',') { const top = stack[stack.length - 1]; if (top?.type === 'o') expectKey = true; }
    i++;
  }
}

// --- SHA-256 (FIPS 180-4) -----------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** @param {Uint8Array} bytes @returns {string} lowercase hex digest */
export function sha256Hex(bytes) {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, bits >>> 0);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = w[t - 15], b = w[t - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  let hex = '';
  for (let i = 0; i < 8; i++) hex += h[i].toString(16).padStart(8, '0');
  return hex;
}

const encoder = new TextEncoder();

/** UTF-8 bytes (no byte-order mark). @param {string} s */
export const utf8 = (s) => encoder.encode(s);

/**
 * Application fingerprint of a value: `sha256:` + SHA-256 of its canonical UTF-8 bytes.
 * @param {unknown} value
 */
export function fingerprint(value) {
  return `sha256:${sha256Hex(utf8(canonicalize(value)))}`;
}

/** Deep copy of a canonical-safe value (structured, no prototypes). @template T @param {T} v @returns {T} */
export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// --- xorshift32_v1 ------------------------------------------------------------------------------

/**
 * One step of the named xorshift32_v1 stream (Appendix B). The state lives in game state as an
 * unsigned 32-bit integer; zero is rejected.
 * @param {number} x
 * @returns {number} next state (also the output)
 */
export function xorshift32(x) {
  if (!Number.isInteger(x) || x <= 0 || x > 0xffffffff) throw new RangeError('xorshift32_v1: seed must be a nonzero unsigned 32-bit integer');
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  return x;
}
