'use strict';

/**
 * MeshXT Smaz-style Short String Compression
 *
 * Optimised for short English text messages typical of Meshtastic.
 * Common substrings (digrams, trigrams, words) are encoded as single bytes.
 * Non-matching runs are emitted as literals with a length prefix.
 *
 * Codebook layout (254 entries, indices 0x00–0xFD):
 *   Each index maps to a common substring.
 * Literal escapes:
 *   0xFE <len> <bytes…>  — literal run of 1–255 bytes
 *   0xFF                  — reserved (future use)
 */

// ---------------------------------------------------------------------------
// Codebook — 254 most common English short-message substrings
// ---------------------------------------------------------------------------
// Ordered by rough frequency in short conversational English.
// The index in this array IS the encoded byte value.

const CODEBOOK = [
  /* 0x00 */ ' ',
  /* 0x01 */ 'e',
  /* 0x02 */ 't',
  /* 0x03 */ 'a',
  /* 0x04 */ 'o',
  /* 0x05 */ 'i',
  /* 0x06 */ 'n',
  /* 0x07 */ 's',
  /* 0x08 */ 'r',
  /* 0x09 */ 'h',
  /* 0x0A */ 'l',
  /* 0x0B */ 'd',
  /* 0x0C */ 'the',
  /* 0x0D */ ' the',
  /* 0x0E */ 'th',
  /* 0x0F */ 'he',
  /* 0x10 */ 'in',
  /* 0x11 */ 'er',
  /* 0x12 */ 'an',
  /* 0x13 */ 'on',
  /* 0x14 */ ' a',
  /* 0x15 */ 're',
  /* 0x16 */ 'nd',
  /* 0x17 */ 'en',
  /* 0x18 */ 'at',
  /* 0x19 */ 'ed',
  /* 0x1A */ 'or',
  /* 0x1B */ 'es',
  /* 0x1C */ 'is',
  /* 0x1D */ 'it',
  /* 0x1E */ 'ou',
  /* 0x1F */ 'to',
  /* 0x20 */ 'ing',
  /* 0x21 */ ' to',
  /* 0x22 */ ' is',
  /* 0x23 */ ' in',
  /* 0x24 */ ' it',
  /* 0x25 */ ' an',
  /* 0x26 */ ' on',
  /* 0x27 */ 'tion',
  /* 0x28 */ 'er ',
  /* 0x29 */ 'ed ',
  /* 0x2A */ 'es ',
  /* 0x2B */ ' of',
  /* 0x2C */ 'of ',
  /* 0x2D */ 'and',
  /* 0x2E */ ' and',
  /* 0x2F */ 'for',
  /* 0x30 */ ' for',
  /* 0x31 */ 'you',
  /* 0x32 */ ' you',
  /* 0x33 */ 'tha',
  /* 0x34 */ 'that',
  /* 0x35 */ ' tha',
  /* 0x36 */ 'hat',
  /* 0x37 */ 'all',
  /* 0x38 */ 'are',
  /* 0x39 */ ' are',
  /* 0x3A */ 'not',
  /* 0x3B */ ' not',
  /* 0x3C */ 'have',
  /* 0x3D */ ' hav',
  /* 0x3E */ 'with',
  /* 0x3F */ ' wit',
  /* 0x40 */ 'was',
  /* 0x41 */ ' was',
  /* 0x42 */ 'can',
  /* 0x43 */ ' can',
  /* 0x44 */ 'but',
  /* 0x45 */ ' but',
  /* 0x46 */ 'ght',
  /* 0x47 */ 'igh',
  /* 0x48 */ 'ing ',
  /* 0x49 */ 'ent',
  /* 0x4A */ 'ion',
  /* 0x4B */ 'her',
  /* 0x4C */ ' her',
  /* 0x4D */ 'his',
  /* 0x4E */ ' his',
  /* 0x4F */ 'ould',
  /* 0x50 */ 'ome',
  /* 0x51 */ 'out',
  /* 0x52 */ ' out',
  /* 0x53 */ 'thi',
  /* 0x54 */ 'this',
  /* 0x55 */ ' thi',
  /* 0x56 */ 'ver',
  /* 0x57 */ 'ever',
  /* 0x58 */ 'ust',
  /* 0x59 */ 'just',
  /* 0x5A */ ' jus',
  /* 0x5B */ 'abo',
  /* 0x5C */ 'abou',
  /* 0x5D */ 'get',
  /* 0x5E */ ' get',
  /* 0x5F */ 'whe',
  /* 0x60 */ 'when',
  /* 0x61 */ ' whe',
  /* 0x62 */ ' wh',
  /* 0x63 */ 'ome ',
  /* 0x64 */ 'here',
  /* 0x65 */ ' her',
  /* 0x66 */ 'ther',
  /* 0x67 */ 'from',
  /* 0x68 */ ' fro',
  /* 0x69 */ 'ght ',
  /* 0x6A */ 'rig',
  /* 0x6B */ 'righ',
  /* 0x6C */ 'ow',
  /* 0x6D */ 'now',
  /* 0x6E */ ' now',
  /* 0x6F */ 'how',
  /* 0x70 */ ' how',
  /* 0x71 */ 'kno',
  /* 0x72 */ 'know',
  /* 0x73 */ ' kno',
  /* 0x74 */ 'will',
  /* 0x75 */ ' wil',
  /* 0x76 */ 'ould ',
  /* 0x77 */ 'hey',
  /* 0x78 */ 'they',
  /* 0x79 */ ' the ',
  /* 0x7A */ 'like',
  /* 0x7B */ ' lik',
  /* 0x7C */ 'goin',
  /* 0x7D */ 'going',
  /* 0x7E */ ' goi',
  /* 0x7F */ 'com',
  /* 0x80 */ 'come',
  /* 0x81 */ ' com',
  /* 0x82 */ 'look',
  /* 0x83 */ ' loo',
  /* 0x84 */ 'wha',
  /* 0x85 */ 'what',
  /* 0x86 */ ' wha',
  /* 0x87 */ 'back',
  /* 0x88 */ ' bac',
  /* 0x89 */ 'been',
  /* 0x8A */ ' bee',
  /* 0x8B */ 'good',
  /* 0x8C */ ' goo',
  /* 0x8D */ 'need',
  /* 0x8E */ ' nee',
  /* 0x8F */ 'help',
  /* 0x90 */ ' hel',
  /* 0x91 */ 'way',
  /* 0x92 */ ' way',
  /* 0x93 */ 'ple',
  /* 0x94 */ 'leas',
  /* 0x95 */ 'ease',
  /* 0x96 */ 'than',
  /* 0x97 */ 'hank',
  /* 0x98 */ 'ank',
  /* 0x99 */ 'here ',
  /* 0x9A */ 'wor',
  /* 0x9B */ 'work',
  /* 0x9C */ ' wor',
  /* 0x9D */ 'yeah',
  /* 0x9E */ ' yea',
  /* 0x9F */ 'sor',
  /* 0xA0 */ 'sorry',
  /* 0xA1 */ ' sor',
  /* 0xA2 */ 'ple',
  /* 0xA3 */ 'pleas',
  /* 0xA4 */ 'lease',
  /* 0xA5 */ 'okay',
  /* 0xA6 */ ' oka',
  /* 0xA7 */ 'may',
  /* 0xA8 */ 'maybe',
  /* 0xA9 */ ' may',
  /* 0xAA */ 'sure',
  /* 0xAB */ ' sur',
  /* 0xAC */ 'min',
  /* 0xAD */ 'minu',
  /* 0xAE */ 'minut',
  /* 0xAF */ 'think',
  /* 0xB0 */ ' thin',
  /* 0xB1 */ ' th',
  /* 0xB2 */ 'don',
  /* 0xB3 */ "don'",
  /* 0xB4 */ "don't",
  /* 0xB5 */ ' do',
  /* 0xB6 */ 'ight',
  /* 0xB7 */ 'night',
  /* 0xB8 */ ' nig',
  /* 0xB9 */ 'cal',
  /* 0xBA */ 'call',
  /* 0xBB */ ' cal',
  /* 0xBC */ 'morn',
  /* 0xBD */ 'morni',
  /* 0xBE */ ' mor',
  /* 0xBF */ 'see',
  /* 0xC0 */ ' see',
  /* 0xC1 */ 'day',
  /* 0xC2 */ ' day',
  /* 0xC3 */ 'today',
  /* 0xC4 */ ' tod',
  /* 0xC5 */ 'tomor',
  /* 0xC6 */ ' tom',
  /* 0xC7 */ 'free',
  /* 0xC8 */ ' fre',
  /* 0xC9 */ 'din',
  /* 0xCA */ 'dinn',
  /* 0xCB */ 'dinne',
  /* 0xCC */ ' din',
  /* 0xCD */ 'lunch',
  /* 0xCE */ ' lun',
  /* 0xCF */ 'meet',
  /* 0xD0 */ ' mee',
  /* 0xD1 */ 'time',
  /* 0xD2 */ ' tim',
  /* 0xD3 */ 'loc',
  /* 0xD4 */ 'locat',
  /* 0xD5 */ ' loc',
  /* 0xD6 */ 'head',
  /* 0xD7 */ ' hea',
  /* 0xD8 */ 'wait',
  /* 0xD9 */ ' wai',
  /* 0xDA */ 'safe',
  /* 0xDB */ ' saf',
  /* 0xDC */ 'leav',
  /* 0xDD */ 'leave',
  /* 0xDE */ ' lea',
  /* 0xDF */ 'around',
  /* 0xE0 */ ' aro',
  /* 0xE1 */ 'stay',
  /* 0xE2 */ ' sta',
  /* 0xE3 */ 'emer',
  /* 0xE4 */ 'emerg',
  /* 0xE5 */ ' eme',
  /* 0xE6 */ 'copy',
  /* 0xE7 */ ' cop',
  /* 0xE8 */ 'rog',
  /* 0xE9 */ 'roger',
  /* 0xEA */ ' rog',
  /* 0xEB */ 'over',
  /* 0xEC */ ' ove',
  /* 0xED */ 'ack',
  /* 0xEE */ ' ack',
  /* 0xEF */ "'s",
  /* 0xF0 */ "n't",
  /* 0xF1 */ "'m",
  /* 0xF2 */ "'re",
  /* 0xF3 */ "'ll",
  /* 0xF4 */ "'ve",
  /* 0xF5 */ 'ly ',
  /* 0xF6 */ 'ment',
  /* 0xF7 */ 'ness',
  /* 0xF8 */ 'able',
  /* 0xF9 */ 'ful',
  /* 0xFA */ 'tion ',
  /* 0xFB */ '. ',
  /* 0xFC */ ', ',
  /* 0xFD */ '? ',
];

const LITERAL_MARKER = 0xFE;
// 0xFF reserved

// ---------------------------------------------------------------------------
// Build a reverse lookup for fast compression
// ---------------------------------------------------------------------------

// We'll use a trie for O(max_len) matching at each position.
class TrieNode {
  constructor() {
    this.children = {};  // char → TrieNode
    this.index = -1;     // codebook index if this is a terminal
  }
}

function buildTrie(codebook) {
  const root = new TrieNode();
  for (let i = 0; i < codebook.length; i++) {
    let node = root;
    const str = codebook[i];
    for (let c = 0; c < str.length; c++) {
      const ch = str[c];
      if (!node.children[ch]) {
        node.children[ch] = new TrieNode();
      }
      node = node.children[ch];
    }
    node.index = i;
  }
  return root;
}

const trie = buildTrie(CODEBOOK);

// Max codebook entry length (for bounds checking)
const MAX_ENTRY_LEN = Math.max(...CODEBOOK.map(s => s.length));

// ---------------------------------------------------------------------------
// compress(text) → Buffer
// ---------------------------------------------------------------------------

/**
 * Compress a UTF-8 text string using the MeshXT Smaz-style codebook.
 *
 * Algorithm: greedy longest-match via trie traversal.
 * Non-matching characters are accumulated and flushed as literal runs.
 *
 * @param {string} text - Input text
 * @returns {Buffer} Compressed bytes
 */
function compress(text) {
  const out = [];
  let literalBuf = [];
  let pos = 0;

  function flushLiterals() {
    while (literalBuf.length > 0) {
      const chunk = literalBuf.splice(0, 255);
      out.push(LITERAL_MARKER);
      out.push(chunk.length);
      for (const b of chunk) out.push(b);
    }
  }

  while (pos < text.length) {
    // Try longest match in trie
    let node = trie;
    let bestIndex = -1;
    let bestLen = 0;

    for (let i = 0; pos + i < text.length && i < MAX_ENTRY_LEN; i++) {
      const ch = text[pos + i];
      if (!node.children[ch]) break;
      node = node.children[ch];
      if (node.index >= 0) {
        bestIndex = node.index;
        bestLen = i + 1;
      }
    }

    if (bestLen >= 2 || (bestLen === 1 && bestIndex >= 0)) {
      // Emit codebook match — flush any pending literals first
      flushLiterals();
      out.push(bestIndex);
      pos += bestLen;
    } else {
      // No useful match — accumulate as literal
      const byte = text.charCodeAt(pos);
      if (byte > 255) {
        // Multi-byte character: encode as UTF-8 literal bytes
        const encoded = Buffer.from(text[pos], 'utf8');
        for (const b of encoded) literalBuf.push(b);
      } else {
        literalBuf.push(byte);
      }
      pos += 1;
    }
  }

  flushLiterals();
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// decompress(buffer) → string
// ---------------------------------------------------------------------------

/**
 * Decompress a MeshXT Smaz-compressed buffer back to text.
 *
 * @param {Buffer|Uint8Array} buf - Compressed data
 * @returns {string} Original text
 */
function decompress(buf) {
  const parts = [];
  let pos = 0;

  while (pos < buf.length) {
    const byte = buf[pos];

    if (byte === LITERAL_MARKER) {
      // Literal run
      pos++;
      if (pos >= buf.length) throw new Error('Truncated literal marker');
      const len = buf[pos];
      pos++;
      if (pos + len > buf.length) throw new Error('Truncated literal data');
      parts.push(Buffer.from(buf.slice(pos, pos + len)).toString('utf8'));
      pos += len;
    } else if (byte === 0xFF) {
      throw new Error('Reserved byte 0xFF encountered');
    } else {
      // Codebook entry
      if (byte >= CODEBOOK.length) {
        throw new Error(`Invalid codebook index: 0x${byte.toString(16)}`);
      }
      parts.push(CODEBOOK[byte]);
      pos++;
    }
  }

  return parts.join('');
}

module.exports = {
  compress,
  decompress,
  CODEBOOK,
  LITERAL_MARKER,
};
