#!/usr/bin/env node
'use strict';

const meshxt = require('../src/index');
const { compress, decompress } = require('../src/compress');
const codebook = require('../src/codebook');
const fec = require('../src/fec');
const adaptive = require('../src/adaptive');
const packet = require('../src/packet');

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`
MeshXT — Meshtastic Extended
Compression & error correction for Meshtastic

Usage:
  meshxt encode <message> [--fec low|medium|high] [--compress smaz|codebook|none]
  meshxt decode <hex>
  meshxt bench <message>
  meshxt range [--sf 7-12] [--bw 125|250|500] [--power 14] [--antenna 3]
  meshxt codebook                    List all codebook templates
  meshxt help

Examples:
  meshxt encode "Are you free for dinner Thursday?"
  meshxt encode "I'm OK" --compress codebook
  meshxt bench "Need help at the old bridge, heading south"
  meshxt range --sf 12 --bw 125 --power 14 --antenna 6
`);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function doEncode() {
  const message = args[1];
  if (!message) { console.error('Error: provide a message to encode'); process.exit(1); }
  
  const flags = parseFlags(args.slice(2));
  const fecLevel = flags.fec || 'medium';
  const compressMode = flags.compress || 'smaz';
  
  try {
    const result = packet.createPacket(message, { compression: compressMode, fec: fecLevel });
    const pkt = result.packet;
    const originalSize = Buffer.byteLength(message, 'utf8');
    const compressedSize = result.stats.compressedSize;
    
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    const rec = adaptive.recommend(pkt.length);
    
    console.log(`\n📡 MeshXT Encode`);
    console.log(`─────────────────────────────────`);
    console.log(`Original:      ${originalSize} bytes`);
    console.log(`Compressed:    ${compressedSize} bytes (${ratio}% saved)`);
    console.log(`+ FEC (${fecLevel}):   +${fec.parityBytes(fecLevel)} bytes`);
    console.log(`+ Header:      +2 bytes`);
    console.log(`Total packet:  ${pkt.length} bytes / 237 max`);
    console.log(`─────────────────────────────────`);
    if (rec) {
      console.log(`Recommended:   SF${rec.sf} BW${rec.bw}kHz CR${rec.cr}`);
      console.log(`Est. range:    ~${rec.rangeKm}km (${Math.round(rec.rangeKm * 0.621)}mi)`);
      console.log(`Airtime:       ${rec.airtimeMs}ms`);
    }
    console.log(`─────────────────────────────────`);
    console.log(`Hex: ${pkt.toString('hex')}`);
    console.log();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function doDecode() {
  const hex = args[1];
  if (!hex) { console.error('Error: provide hex data to decode'); process.exit(1); }
  
  try {
    const buf = Buffer.from(hex, 'hex');
    const result = packet.parsePacket(buf);
    
    console.log(`\n📡 MeshXT Decode`);
    console.log(`─────────────────────────────────`);
    console.log(`Message:       ${result.message}`);
    console.log(`Compression:   ${result.compression}`);
    console.log(`FEC level:     ${result.fec}`);
    console.log(`Errors fixed:  ${result.errorsFixed || 0}`);
    console.log();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function doBench() {
  const message = args[1];
  if (!message) { console.error('Error: provide a message to benchmark'); process.exit(1); }
  
  const originalSize = Buffer.byteLength(message, 'utf8');
  
  console.log(`\n📊 MeshXT Benchmark`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`Message: "${message}"`);
  console.log(`Original size: ${originalSize} bytes`);
  console.log(`───────────────────────────────────────────`);
  
  // Smaz compression
  try {
    const compressed = compress(message);
    const ratio = ((1 - compressed.length / originalSize) * 100).toFixed(1);
    console.log(`Smaz:          ${compressed.length} bytes (${ratio}% saved)`);
  } catch (e) {
    console.log(`Smaz:          error - ${e.message}`);
  }
  
  // Codebook
  try {
    const enc = codebook.encode(message);
    if (enc) {
      const ratio = ((1 - enc.length / originalSize) * 100).toFixed(1);
      console.log(`Codebook:      ${enc.length} bytes (${ratio}% saved)`);
    } else {
      console.log(`Codebook:      no template match`);
    }
  } catch (e) {
    console.log(`Codebook:      no template match`);
  }
  
  console.log(`───────────────────────────────────────────`);
  
  // Full packet sizes with different FEC levels
  for (const level of ['low', 'medium', 'high']) {
    try {
      const result = packet.createPacket(message, { compression: 'smaz', fec: level });
      const pkt = result.packet;
      const rec = adaptive.recommend(pkt.length);
      const rangeStr = rec ? `~${rec.rangeKm}km SF${rec.sf}` : 'N/A';
      console.log(`Packet (${level.padEnd(6)}): ${String(pkt.length).padStart(3)} bytes → ${rangeStr}`);
    } catch (e) {
      console.log(`Packet (${level.padEnd(6)}): error - ${e.message}`);
    }
  }
  
  console.log(`═══════════════════════════════════════════\n`);
}

function doRange() {
  const flags = parseFlags(args.slice(1));
  const sf = parseInt(flags.sf || '12');
  const bw = parseInt(flags.bw || '125');
  const power = parseFloat(flags.power || '14');
  const antenna = parseFloat(flags.antenna || '3');
  
  const range = adaptive.rangeEstimate(sf, bw, power, antenna);
  
  console.log(`\n📡 MeshXT Range Estimate`);
  console.log(`─────────────────────────────────`);
  console.log(`SF:            ${sf}`);
  console.log(`Bandwidth:     ${bw} kHz`);
  console.log(`TX Power:      ${power} dBm`);
  console.log(`Antenna gain:  ${antenna} dBi`);
  console.log(`─────────────────────────────────`);
  console.log(`Est. range:    ~${range.rangeKm}km (${Math.round(range.rangeKm * 0.621)}mi)`);
  console.log(`Link budget:   ${range.linkBudget}dB`);
  console.log(`Sensitivity:   ${range.sensitivity}dBm`);
  console.log();
}

function doCodebook() {
  console.log(`\n📖 MeshXT Codebook Templates`);
  console.log(`─────────────────────────────────`);
  const templates = codebook.listTemplates();
  for (const t of templates) {
    console.log(`  [${String(t.id).padStart(2)}] "${t.name}" → ${t.bytes} byte(s)`);
  }
  console.log();
}

// Dispatch
switch (command) {
  case 'encode':  doEncode(); break;
  case 'decode':  doDecode(); break;
  case 'bench':   doBench(); break;
  case 'range':   doRange(); break;
  case 'codebook': doCodebook(); break;
  case 'help': case '--help': case '-h': case undefined: usage(); break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
