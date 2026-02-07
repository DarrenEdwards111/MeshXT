'use strict';

/**
 * MeshXT Utilities
 * Helper functions used across modules.
 */

/**
 * Convert a Buffer or Uint8Array to a hex string.
 * @param {Buffer|Uint8Array} buf
 * @returns {string}
 */
function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

/**
 * Convert a hex string to a Buffer.
 * @param {string} hex
 * @returns {Buffer}
 */
function fromHex(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Calculate CRC-8 for a buffer (polynomial 0x07, init 0x00).
 * Used for lightweight integrity checks in packet headers.
 * @param {Buffer|Uint8Array} data
 * @returns {number} CRC-8 value (0-255)
 */
function crc8(data) {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xFF;
      } else {
        crc = (crc << 1) & 0xFF;
      }
    }
  }
  return crc;
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Encode a 32-bit float as 4 bytes (big-endian).
 * @param {number} value
 * @returns {Buffer}
 */
function floatToBytes(value) {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(value, 0);
  return buf;
}

/**
 * Decode 4 bytes (big-endian) to a 32-bit float.
 * @param {Buffer} buf
 * @param {number} [offset=0]
 * @returns {number}
 */
function bytesToFloat(buf, offset = 0) {
  return buf.readFloatBE(offset);
}

/**
 * Encode a uint16 as 2 bytes (big-endian).
 * @param {number} value
 * @returns {Buffer}
 */
function uint16ToBytes(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(value & 0xFFFF, 0);
  return buf;
}

/**
 * Decode 2 bytes (big-endian) to a uint16.
 * @param {Buffer} buf
 * @param {number} [offset=0]
 * @returns {number}
 */
function bytesToUint16(buf, offset = 0) {
  return buf.readUInt16BE(offset);
}

/**
 * Pretty-print a byte count with units.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 1) return '1 byte';
  return `${bytes} bytes`;
}

/**
 * Pretty-print a duration in milliseconds.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Format a percentage.
 * @param {number} ratio - 0 to 1
 * @returns {string}
 */
function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

module.exports = {
  toHex,
  fromHex,
  crc8,
  clamp,
  floatToBytes,
  bytesToFloat,
  uint16ToBytes,
  bytesToUint16,
  formatBytes,
  formatDuration,
  formatPercent,
};
