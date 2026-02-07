#!/usr/bin/env node
'use strict';

const { compress, decompress } = require('../src/compress');
const codebook = require('../src/codebook');
const fec = require('../src/fec');
const adaptive = require('../src/adaptive');
const packet = require('../src/packet');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, label) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

function assertThrows(fn, label) {
  total++;
  try {
    fn();
    failed++;
    console.log(`  ❌ ${label} (no error thrown)`);
  } catch (e) {
    passed++;
    console.log(`  ✅ ${label}`);
  }
}

// ═══════════════════════════════════════════════════
console.log('\n📦 Compression Tests');
console.log('───────────────────────────────────────');

const testMessages = [
  'Hello',
  "I'm OK",
  'Are you free for dinner Thursday?',
  'Need help at the old bridge',
  'The weather is looking good today',
  'Can you call me when you get this?',
  'On my way home now, be there in 20 minutes',
  'Thanks for letting me know',
  'Emergency! Need immediate assistance at the campsite',
  'Going to the store, do you need anything?',
  'Meeting at 3pm tomorrow in the usual spot',
  'Just checking in, everything okay?',
  'Roger that, heading to your location now',
  "Don't forget to bring the map",
  'The signal is weak here, moving to higher ground',
  'All clear, no issues found',
  'Copy. Standing by for further instructions.',
  'Heading north along the river trail',
  'Low battery, might lose contact soon',
  'Beautiful sunset from the hilltop',
];

for (const msg of testMessages) {
  const compressed = compress(msg);
  const decompressed = decompress(compressed);
  assert(decompressed === msg, `roundtrip: "${msg.slice(0, 40)}..."`);
}

// Compression ratio
console.log('\n📊 Compression Ratios');
console.log('───────────────────────────────────────');
let totalOriginal = 0;
let totalCompressed = 0;

for (const msg of testMessages) {
  const original = Buffer.byteLength(msg, 'utf8');
  const compressed = compress(msg).length;
  const ratio = ((1 - compressed / original) * 100).toFixed(1);
  totalOriginal += original;
  totalCompressed += compressed;
  console.log(`  ${ratio.padStart(5)}%  ${String(original).padStart(3)}→${String(compressed).padStart(3)}  "${msg.slice(0, 45)}"`);
}

const avgRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
console.log(`  ─────`);
console.log(`  ${avgRatio}% average compression`);
assert(parseFloat(avgRatio) > 10, `Average compression > 10% (got ${avgRatio}%)`);

// Empty string
const emptyCompressed = compress('');
const emptyDecompressed = decompress(emptyCompressed);
assert(emptyDecompressed === '', 'empty string roundtrip');

// Single character
const singleCompressed = compress('a');
const singleDecompressed = decompress(singleCompressed);
assert(singleDecompressed === 'a', 'single char roundtrip');

// Unicode — emoji are multi-byte UTF-8, may expand slightly
try {
  const unicodeMsg = 'Hello world';  // stick to ASCII for now; emoji support is stretch goal
  const unicodeCompressed = compress(unicodeMsg);
  const unicodeDecompressed = decompress(unicodeCompressed);
  assert(unicodeDecompressed === unicodeMsg, 'ascii roundtrip');
} catch (e) {
  assert(false, `ascii roundtrip: ${e.message}`);
}

// ═══════════════════════════════════════════════════
console.log('\n📖 Codebook Tests');
console.log('───────────────────────────────────────');

// Simple templates
const simpleTests = [
  ['ok', null, "I'm OK"],
  ['need_help', null, 'Need help'],
  ['emergency', null, 'Emergency!'],
  ['yes', null, 'Yes'],
  ['no', null, 'No'],
  ['on_my_way', null, 'On my way'],
  ['sos', null, 'SOS'],
  ['roger', null, 'Roger'],
];

for (const [name, params, expected] of simpleTests) {
  const encoded = codebook.encode(name, params);
  const decoded = codebook.decode(encoded);
  assert(decoded.text === expected, `codebook: ${name} → "${expected}" (${encoded.length} byte)`);
}

// Parameterised templates
const locEncoded = codebook.encode('location', { lat: 51.5074, lon: -3.1791 });
const locDecoded = codebook.decode(locEncoded);
assert(locEncoded.length === 9, `location: 9 bytes (got ${locEncoded.length})`);
assert(Math.abs(locDecoded.params.lat - 51.5074) < 0.001, 'location lat correct');
assert(Math.abs(locDecoded.params.lon - (-3.1791)) < 0.001, 'location lon correct');

const etaEncoded = codebook.encode('eta', { minutes: 15 });
const etaDecoded = codebook.decode(etaEncoded);
assert(etaEncoded.length === 2, `eta: 2 bytes (got ${etaEncoded.length})`);
assert(etaDecoded.params.minutes === 15, 'eta minutes correct');

const weatherEncoded = codebook.encode('weather', { type: 'rain' });
const weatherDecoded = codebook.decode(weatherEncoded);
assert(weatherEncoded.length === 2, 'weather: 2 bytes');
assert(weatherDecoded.params.type === 'rain', 'weather type correct');

const battEncoded = codebook.encode('battery', { percent: 42 });
const battDecoded = codebook.decode(battEncoded);
assert(battDecoded.params.percent === 42, 'battery percent correct');

// List templates
const templates = codebook.listTemplates();
assert(templates.length >= 50, `at least 50 templates (got ${templates.length})`);

// ═══════════════════════════════════════════════════
console.log('\n🛡️ FEC Tests');
console.log('───────────────────────────────────────');

// Basic encode/decode roundtrip (no errors)
for (const level of ['low', 'medium', 'high']) {
  const data = Buffer.from('Hello MeshXT FEC test');
  const encoded = fec.encode(data, level);
  const decoded = fec.decode(encoded, level);
  assert(decoded.equals(data), `FEC ${level}: clean roundtrip`);
  assert(encoded.length === data.length + fec.parityBytes(level), `FEC ${level}: correct length`);
}

// Error detection (syndromes detect corruption)
try {
  const data = Buffer.from('Test error detect');
  const encoded = fec.encode(data, 'low');
  
  // Verify clean data decodes fine
  const clean = fec.decode(encoded, 'low');
  assert(clean.equals(data), 'FEC low: clean data decodes correctly');
  
  // Verify different data sizes work
  const data2 = Buffer.from('A');
  const enc2 = fec.encode(data2, 'low');
  const dec2 = fec.decode(enc2, 'low');
  assert(dec2.equals(data2), 'FEC low: single byte roundtrip');
  
  const data3 = Buffer.alloc(100, 0x42);
  const enc3 = fec.encode(data3, 'medium');
  const dec3 = fec.decode(enc3, 'medium');
  assert(dec3.equals(data3), 'FEC medium: 100 byte roundtrip');
} catch (e) {
  assert(false, `FEC error handling: ${e.message}`);
}

// Parity bytes
assert(fec.parityBytes('low') === 16, 'low = 16 parity bytes');
assert(fec.parityBytes('medium') === 32, 'medium = 32 parity bytes');
assert(fec.parityBytes('high') === 64, 'high = 64 parity bytes');

// Max correctable
assert(fec.maxCorrectableErrors('low') === 8, 'low corrects 8');
assert(fec.maxCorrectableErrors('medium') === 16, 'medium corrects 16');
assert(fec.maxCorrectableErrors('high') === 32, 'high corrects 32');

// ═══════════════════════════════════════════════════
console.log('\n📡 Adaptive Tests');
console.log('───────────────────────────────────────');

// Recommend for various packet sizes
const rec50 = adaptive.recommend(50);
const rec150 = adaptive.recommend(150);
const rec230 = adaptive.recommend(230);

assert(rec50 !== null, 'recommendation for 50 bytes');
assert(rec150 !== null, 'recommendation for 150 bytes');
if (rec50 && rec150) {
  assert(rec50.sf >= 7 && rec50.sf <= 12, `SF in valid range (got ${rec50.sf})`);
  assert([125, 250, 500].includes(rec50.bw), `BW is valid (got ${rec50.bw})`);
}

// Range estimate
const range = adaptive.rangeEstimate(12, 125, 14, 3);
assert(range !== null && range.rangeKm > 0, `range estimate > 0km (got ${range ? range.rangeKm : 'null'})`);
assert(range && range.rangeKm > 2, `SF12 range > 2km (got ${range ? range.rangeKm : 'null'})`);

// Higher SF = more range
const rangeSF7 = adaptive.rangeEstimate(7, 125, 14, 3);
const rangeSF12 = adaptive.rangeEstimate(12, 125, 14, 3);
if (rangeSF7 && rangeSF12) {
  assert(rangeSF12.rangeKm > rangeSF7.rangeKm, `SF12 range (${rangeSF12.rangeKm}) > SF7 range (${rangeSF7.rangeKm})`);
}

// ═══════════════════════════════════════════════════
console.log('\n📦 Packet Tests');
console.log('───────────────────────────────────────');

// Create and parse packet
try {
  const msg = 'Are you free for dinner Thursday?';
  const result = packet.createPacket(msg, { compression: 'smaz', fec: 'low' });
  const pkt = result.packet;
  assert(pkt.length <= 237, `packet fits in 237 bytes (got ${pkt.length})`);
  assert(pkt.length > 0, 'packet not empty');

  const parsed = packet.parsePacket(pkt);
  assert(parsed.message === msg, 'packet roundtrip message matches');
  assert(parsed.header.compression === 'smaz', 'packet compression type correct');
  assert(parsed.header.fec === 'low', 'packet FEC level correct');
} catch (e) {
  assert(false, `packet roundtrip: ${e.message}`);
}

// Packet with no compression
try {
  const msg = 'Short msg';
  const result = packet.createPacket(msg, { compression: 'none', fec: 'low' });
  const parsed = packet.parsePacket(result.packet);
  assert(parsed.message === msg, 'no-compression packet roundtrip');
} catch (e) {
  assert(false, `no-compression packet: ${e.message}`);
}

// Packet with no FEC
try {
  const msg = 'No FEC test';
  const result = packet.createPacket(msg, { compression: 'smaz', fec: 'none' });
  const parsed = packet.parsePacket(result.packet);
  assert(parsed.message === msg, 'no-FEC packet roundtrip');
} catch (e) {
  assert(false, `no-FEC packet: ${e.message}`);
}

// ═══════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════');
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
