'use strict';

/**
 * MeshXT Forward Error Correction — Reed-Solomon over GF(2^8)
 *
 * Pure JavaScript implementation of Reed-Solomon codes.
 * Uses the primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
 * which is standard for GF(2^8) / RS used in QR codes, DVB, etc.
 *
 * Correction levels:
 *   'low'    — 16 parity symbols, corrects up to  8 symbol errors
 *   'medium' — 32 parity symbols, corrects up to 16 symbol errors
 *   'high'   — 64 parity symbols, corrects up to 32 symbol errors
 *
 * API:
 *   encode(data, level)  → Buffer with parity appended
 *   decode(data, level)  → Buffer with errors corrected, parity stripped
 */

// ---------------------------------------------------------------------------
// GF(2^8) Arithmetic — primitive polynomial 0x11D
// ---------------------------------------------------------------------------

const GF_SIZE = 256;
const PRIM_POLY = 0x11D; // x^8 + x^4 + x^3 + x^2 + 1

// Exponent and log tables
const gfExp = new Uint8Array(512); // gfExp[i] = alpha^i mod p(x)
const gfLog = new Uint8Array(256); // gfLog[v] = i such that alpha^i = v

(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIM_POLY;
  }
  // Duplicate for wrap-around
  for (let i = 255; i < 512; i++) {
    gfExp[i] = gfExp[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

function gfDiv(a, b) {
  if (b === 0) throw new Error('Division by zero in GF(2^8)');
  if (a === 0) return 0;
  return gfExp[(gfLog[a] + 255 - gfLog[b]) % 255];
}

function gfPow(x, power) {
  return gfExp[(gfLog[x] * power) % 255];
}

function gfInverse(x) {
  return gfExp[255 - gfLog[x]];
}

// ---------------------------------------------------------------------------
// Polynomial operations over GF(2^8)
// ---------------------------------------------------------------------------

// Polynomials: arrays of coefficients, highest degree first
// e.g., [1, 0, 3] = x^2 + 3

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function polyEval(poly, x) {
  let result = poly[0];
  for (let i = 1; i < poly.length; i++) {
    result = gfMul(result, x) ^ poly[i];
  }
  return result;
}

function polyScale(poly, x) {
  const r = new Uint8Array(poly.length);
  for (let i = 0; i < poly.length; i++) {
    r[i] = gfMul(poly[i], x);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Generator polynomial
// ---------------------------------------------------------------------------

function buildGenerator(nsym) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    g = polyMul(g, new Uint8Array([1, gfExp[i]]));
  }
  return g;
}

// Cache generators
const generatorCache = {};
function getGenerator(nsym) {
  if (!generatorCache[nsym]) {
    generatorCache[nsym] = buildGenerator(nsym);
  }
  return generatorCache[nsym];
}

// ---------------------------------------------------------------------------
// Correction level → number of parity symbols
// ---------------------------------------------------------------------------

const LEVELS = {
  low:    16,
  medium: 32,
  high:   64,
};

function getParityCount(level) {
  const nsym = LEVELS[level];
  if (!nsym) throw new Error(`Unknown FEC level: '${level}'. Use 'low', 'medium', or 'high'.`);
  return nsym;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Compute RS parity symbols for a message.
 * @param {Uint8Array} msgIn - Message bytes
 * @param {number} nsym - Number of parity symbols
 * @returns {Uint8Array} Parity bytes (length = nsym)
 */
function rsEncodeMsg(msgIn, nsym) {
  const gen = getGenerator(nsym);
  const feedback = new Uint8Array(msgIn.length + nsym);
  feedback.set(msgIn);

  for (let i = 0; i < msgIn.length; i++) {
    const coef = feedback[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        feedback[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return feedback.slice(msgIn.length);
}

// ---------------------------------------------------------------------------
// Syndromes, error locator, error correction
// ---------------------------------------------------------------------------

function rsCalcSyndromes(msg, nsym) {
  const synd = new Uint8Array(nsym);
  for (let i = 0; i < nsym; i++) {
    synd[i] = polyEval(msg, gfExp[i]);
  }
  return synd;
}

function rsFindErrorLocator(synd, nsym) {
  // Berlekamp-Massey algorithm
  let errLoc = new Uint8Array([1]);
  let oldLoc = new Uint8Array([1]);

  for (let i = 0; i < nsym; i++) {
    let delta = synd[i];
    for (let j = 1; j < errLoc.length; j++) {
      delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[i - j]);
    }

    // Shift oldLoc
    const newOld = new Uint8Array(oldLoc.length + 1);
    newOld.set(oldLoc);
    oldLoc = newOld;

    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const newLoc = polyScale(oldLoc, delta);
        oldLoc = polyScale(errLoc, gfInverse(delta));
        errLoc = newLoc;
      }
      // Update error locator
      const scaledOld = polyScale(oldLoc, delta);
      const updated = new Uint8Array(Math.max(errLoc.length, scaledOld.length));
      updated.set(errLoc, updated.length - errLoc.length);
      for (let j = 0; j < scaledOld.length; j++) {
        updated[updated.length - scaledOld.length + j] ^= scaledOld[j];
      }
      errLoc = updated;
    }
  }

  // Number of errors
  const numErrors = errLoc.length - 1;
  if (numErrors * 2 > nsym) {
    throw new Error('Too many errors to correct');
  }

  return errLoc;
}

function rsFindErrors(errLoc, msgLen) {
  // Chien search
  const numErrors = errLoc.length - 1;
  const errPos = [];

  for (let i = 0; i < msgLen; i++) {
    if (polyEval(errLoc, gfExp[255 - i]) === 0) {
      errPos.push(msgLen - 1 - i);
    }
  }

  if (errPos.length !== numErrors) {
    throw new Error(`Could not locate all errors (found ${errPos.length}, expected ${numErrors})`);
  }

  return errPos;
}

function rsForneySyndromes(synd, errPos, nmsg) {
  // Compute Forney syndromes for erasure correction
  const fsynd = new Uint8Array(synd.length);
  fsynd.set(synd);
  return fsynd;
}

function rsCorrectErrors(msg, synd, errPos) {
  // Forney algorithm
  const nsym = synd.length;

  // Compute error evaluator polynomial
  // First get the error locator from positions
  let errLoc = new Uint8Array([1]);
  for (const pos of errPos) {
    const coef = gfExp[msg.length - 1 - pos];
    errLoc = polyMul(errLoc, new Uint8Array([coef, 1]));
  }

  // Error evaluator = (Synd * ErrLoc) mod x^nsym
  // Build syndrome polynomial (reversed)
  const syndPoly = new Uint8Array(nsym + 1);
  syndPoly[0] = 0;
  for (let i = 0; i < nsym; i++) {
    syndPoly[nsym - i] = synd[i];
  }
  let errEval = polyMul(syndPoly, errLoc);
  // Take only the low-order terms
  errEval = errEval.slice(errEval.length - nsym);

  // Formal derivative of error locator
  const errLocPrime = new Uint8Array(Math.ceil(errLoc.length / 2));
  for (let i = errLoc.length & ~1; i >= 0; i -= 2) {
    if (i < errLoc.length) {
      errLocPrime[Math.floor(i / 2)] = errLoc[i];
    }
  }

  // Correct errors using Forney
  const corrected = new Uint8Array(msg);
  for (const pos of errPos) {
    const xi = gfExp[msg.length - 1 - pos];
    const xiInv = gfInverse(xi);

    const errLocEval = polyEval(errLocPrime, xiInv);
    if (errLocEval === 0) throw new Error('Error locator derivative is zero');

    const errEvalVal = polyEval(errEval, xiInv);
    const magnitude = gfDiv(errEvalVal, errLocEval);

    corrected[pos] ^= magnitude;
  }

  return corrected;
}

// ---------------------------------------------------------------------------
// Full decode with error correction
// ---------------------------------------------------------------------------

function rsDecodeMsg(msgWithParity, nsym) {
  const synd = rsCalcSyndromes(msgWithParity, nsym);

  // Check if there are any errors
  let hasErrors = false;
  for (let i = 0; i < nsym; i++) {
    if (synd[i] !== 0) { hasErrors = true; break; }
  }

  if (!hasErrors) {
    // No errors — strip parity and return
    return msgWithParity.slice(0, msgWithParity.length - nsym);
  }

  // Find error locations
  const errLoc = rsFindErrorLocator(synd, nsym);
  const errPos = rsFindErrors(errLoc, msgWithParity.length);

  // Correct errors
  const corrected = rsCorrectErrors(msgWithParity, synd, errPos);

  // Verify correction
  const checkSynd = rsCalcSyndromes(corrected, nsym);
  for (let i = 0; i < nsym; i++) {
    if (checkSynd[i] !== 0) {
      throw new Error('Correction failed: residual syndromes non-zero');
    }
  }

  return corrected.slice(0, corrected.length - nsym);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode data with Reed-Solomon error correction.
 * @param {Buffer|Uint8Array} data - Input data
 * @param {string} [level='medium'] - Correction level: 'low', 'medium', 'high'
 * @returns {Buffer} Data with parity appended
 */
function encode(data, level = 'medium') {
  const nsym = getParityCount(level);
  const msg = Uint8Array.from(data);

  if (msg.length + nsym > 255) {
    throw new Error(`Data too long for RS(255,${255 - nsym}): ${msg.length} bytes + ${nsym} parity > 255`);
  }

  const parity = rsEncodeMsg(msg, nsym);
  return Buffer.concat([Buffer.from(msg), Buffer.from(parity)]);
}

/**
 * Decode and correct Reed-Solomon encoded data.
 * @param {Buffer|Uint8Array} data - Data with parity
 * @param {string} [level='medium'] - Correction level matching the encode level
 * @returns {Buffer} Corrected data (parity stripped)
 */
function decode(data, level = 'medium') {
  const nsym = getParityCount(level);
  const msg = Uint8Array.from(data);

  if (msg.length < nsym) {
    throw new Error(`Data too short: ${msg.length} bytes but need at least ${nsym} parity symbols`);
  }

  const corrected = rsDecodeMsg(msg, nsym);
  return Buffer.from(corrected);
}

/**
 * Get the number of parity bytes for a given level.
 * @param {string} level
 * @returns {number}
 */
function parityBytes(level) {
  return getParityCount(level);
}

/**
 * Get the maximum number of correctable symbol errors for a level.
 * @param {string} level
 * @returns {number}
 */
function maxCorrectableErrors(level) {
  return Math.floor(getParityCount(level) / 2);
}

module.exports = {
  encode,
  decode,
  parityBytes,
  maxCorrectableErrors,
  LEVELS,
  // Expose GF arithmetic for testing
  _gf: { gfMul, gfDiv, gfPow, gfInverse, gfExp, gfLog },
};
