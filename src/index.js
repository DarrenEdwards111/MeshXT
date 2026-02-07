'use strict';

/**
 * MeshXT — Compression & Error Correction for Meshtastic
 *
 * Extend your Meshtastic range by 2-2.5x through intelligent
 * message compression, forward error correction, and adaptive
 * spreading factor selection.
 *
 * @module longshot
 */

const compress = require('./compress');
const codebook = require('./codebook');
const fec = require('./fec');
const adaptive = require('./adaptive');
const packet = require('./packet');
const utils = require('./utils');

module.exports = {
  // Compression
  compress: compress.compress,
  decompress: compress.decompress,

  // Codebook templates
  codebook: {
    encode: codebook.encode,
    decode: codebook.decode,
    listTemplates: codebook.listTemplates,
  },

  // Forward error correction
  fec: {
    encode: fec.encode,
    decode: fec.decode,
    parityBytes: fec.parityBytes,
    maxCorrectableErrors: fec.maxCorrectableErrors,
  },

  // Adaptive LoRa parameter selection
  adaptive: {
    recommend: adaptive.recommend,
    allConfigs: adaptive.allConfigs,
    airtime: adaptive.airtime,
    rangeEstimate: adaptive.rangeEstimate,
    dataRate: adaptive.dataRate,
  },

  // Packet framing
  createPacket: packet.createPacket,
  parsePacket: packet.parsePacket,

  // Utilities
  utils,

  // Constants
  MAX_PACKET_SIZE: packet.MAX_PACKET_SIZE,
  PACKET_VERSION: packet.PACKET_VERSION,
};
