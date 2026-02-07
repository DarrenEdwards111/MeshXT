'use strict';

/**
 * MeshXT Packet Framing
 *
 * Packet structure:
 *   ┌──────────┬───────────────────┬──────────────┐
 *   │  Header  │     Payload       │   FEC Parity  │
 *   │ (2 bytes)│ (compressed data) │  (0-64 bytes) │
 *   └──────────┴───────────────────┴──────────────┘
 *
 * Header layout (2 bytes = 16 bits):
 *   Bits 15-12: Version (4 bits) — currently 0x1
 *   Bits 11-8:  Compression type (4 bits)
 *                 0x0 = none
 *                 0x1 = smaz
 *                 0x2 = codebook
 *   Bits 7-4:   FEC level (4 bits)
 *                 0x0 = none
 *                 0x1 = low (8 symbols)
 *                 0x2 = medium (16 symbols)
 *                 0x3 = high (32 symbols)
 *   Bits 3-0:   Flags (4 bits)
 *                 Bit 3: reserved
 *                 Bit 2: reserved
 *                 Bit 1: reserved
 *                 Bit 0: fragment flag (1 = this is a fragment)
 *
 * Total packet must fit in 237 bytes (Meshtastic max payload).
 */

const { compress, decompress } = require('./compress');
const codebook = require('./codebook');
const fec = require('./fec');

const PACKET_VERSION = 1;
const MAX_PACKET_SIZE = 237;
const HEADER_SIZE = 2;

// Compression type codes
const COMP_NONE     = 0x0;
const COMP_SMAZ     = 0x1;
const COMP_CODEBOOK = 0x2;

// FEC level codes
const FEC_NONE   = 0x0;
const FEC_LOW    = 0x1;
const FEC_MEDIUM = 0x2;
const FEC_HIGH   = 0x3;

const COMP_MAP = {
  none: COMP_NONE,
  smaz: COMP_SMAZ,
  codebook: COMP_CODEBOOK,
};

const COMP_REVERSE = {
  [COMP_NONE]: 'none',
  [COMP_SMAZ]: 'smaz',
  [COMP_CODEBOOK]: 'codebook',
};

const FEC_MAP = {
  none: FEC_NONE,
  low: FEC_LOW,
  medium: FEC_MEDIUM,
  high: FEC_HIGH,
};

const FEC_REVERSE = {
  [FEC_NONE]: 'none',
  [FEC_LOW]: 'low',
  [FEC_MEDIUM]: 'medium',
  [FEC_HIGH]: 'high',
};

// ---------------------------------------------------------------------------
// Header encode/decode
// ---------------------------------------------------------------------------

function encodeHeader(version, compType, fecLevel, flags) {
  const byte0 = ((version & 0xF) << 4) | (compType & 0xF);
  const byte1 = ((fecLevel & 0xF) << 4) | (flags & 0xF);
  return Buffer.from([byte0, byte1]);
}

function decodeHeader(buf) {
  if (buf.length < HEADER_SIZE) {
    throw new Error('Buffer too small for MeshXT header');
  }
  const byte0 = buf[0];
  const byte1 = buf[1];

  return {
    version: (byte0 >> 4) & 0xF,
    compType: byte0 & 0xF,
    fecLevel: (byte1 >> 4) & 0xF,
    flags: byte1 & 0xF,
  };
}

// ---------------------------------------------------------------------------
// createPacket
// ---------------------------------------------------------------------------

/**
 * Create a MeshXT packet from a message.
 *
 * @param {string} message - The text message to encode
 * @param {Object} [options]
 * @param {string} [options.compression='smaz'] - 'smaz', 'codebook', or 'none'
 * @param {string} [options.fec='medium'] - 'low', 'medium', 'high', or 'none'
 * @param {string} [options.template] - Codebook template name (required if compression='codebook')
 * @param {Object} [options.params] - Codebook template params
 * @param {number} [options.flags=0] - Header flags (4 bits)
 * @returns {{ packet: Buffer, stats: Object }}
 */
function createPacket(message, options = {}) {
  const {
    compression = 'smaz',
    fec: fecLevel = 'medium',
    template,
    params,
    flags = 0,
  } = options;

  // Validate options
  if (!(compression in COMP_MAP)) {
    throw new Error(`Unknown compression: '${compression}'. Use 'smaz', 'codebook', or 'none'.`);
  }
  if (!(fecLevel in FEC_MAP)) {
    throw new Error(`Unknown FEC level: '${fecLevel}'. Use 'low', 'medium', 'high', or 'none'.`);
  }

  // Step 1: Compress the payload
  let payload;
  const originalSize = Buffer.byteLength(message, 'utf8');

  switch (compression) {
    case 'smaz':
      payload = compress(message);
      break;
    case 'codebook':
      if (!template) throw new Error("Codebook compression requires 'template' option");
      payload = codebook.encode(template, params);
      break;
    case 'none':
      payload = Buffer.from(message, 'utf8');
      break;
  }

  // Step 2: Apply FEC
  let fecData;
  let fecBytes = 0;

  if (fecLevel !== 'none') {
    fecData = fec.encode(payload, fecLevel);
    fecBytes = fecData.length - payload.length;
  } else {
    fecData = payload;
  }

  // Step 3: Build header
  const header = encodeHeader(
    PACKET_VERSION,
    COMP_MAP[compression],
    FEC_MAP[fecLevel],
    flags & 0xF
  );

  // Step 4: Assemble packet
  const packet = Buffer.concat([header, fecData]);

  // Validate size
  if (packet.length > MAX_PACKET_SIZE) {
    throw new Error(
      `Packet too large: ${packet.length} bytes (max ${MAX_PACKET_SIZE}). ` +
      `Try shorter message, stronger compression, or lower FEC.`
    );
  }

  return {
    packet,
    stats: {
      originalSize,
      compressedSize: payload.length,
      fecBytes,
      headerBytes: HEADER_SIZE,
      totalSize: packet.length,
      compressionRatio: originalSize > 0 ? payload.length / originalSize : 0,
      overhead: packet.length - originalSize,
    },
  };
}

// ---------------------------------------------------------------------------
// parsePacket
// ---------------------------------------------------------------------------

/**
 * Parse a MeshXT packet back to a message.
 *
 * @param {Buffer|Uint8Array} packet - The raw packet bytes
 * @returns {{ message: string, header: Object, stats: Object }}
 */
function parsePacket(packet) {
  if (!packet || packet.length < HEADER_SIZE) {
    throw new Error('Packet too small');
  }

  // Step 1: Parse header
  const header = decodeHeader(packet);

  if (header.version !== PACKET_VERSION) {
    throw new Error(`Unsupported packet version: ${header.version} (expected ${PACKET_VERSION})`);
  }

  const compression = COMP_REVERSE[header.compType];
  const fecLevel = FEC_REVERSE[header.fecLevel];

  if (!compression) throw new Error(`Unknown compression type: ${header.compType}`);
  if (fecLevel === undefined) throw new Error(`Unknown FEC level: ${header.fecLevel}`);

  // Step 2: Extract data after header
  let data = Buffer.from(packet.slice(HEADER_SIZE));

  // Step 3: FEC decode (correct errors and strip parity)
  let fecBytes = 0;
  if (fecLevel !== 'none') {
    fecBytes = fec.parityBytes(fecLevel);
    data = fec.decode(data, fecLevel);
  }

  // Step 4: Decompress
  let message;
  switch (compression) {
    case 'smaz':
      message = decompress(data);
      break;
    case 'codebook': {
      const decoded = codebook.decode(data);
      message = decoded.text;
      break;
    }
    case 'none':
      message = data.toString('utf8');
      break;
  }

  return {
    message,
    header: {
      version: header.version,
      compression,
      fec: fecLevel,
      flags: header.flags,
    },
    stats: {
      packetSize: packet.length,
      payloadSize: data.length,
      fecBytes,
      headerBytes: HEADER_SIZE,
    },
  };
}

module.exports = {
  createPacket,
  parsePacket,
  PACKET_VERSION,
  MAX_PACKET_SIZE,
  HEADER_SIZE,
  COMP_MAP,
  FEC_MAP,
};
