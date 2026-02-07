'use strict';

/**
 * MeshXT Codebook — Predefined Message Templates
 *
 * Ultra-compact encoding for common Meshtastic messages.
 * A single byte (template ID) optionally followed by parameter bytes.
 *
 * Format:  <template_id> [<param_bytes…>]
 *
 * Template IDs 0x00–0x3F: simple (no params, 1 byte total)
 * Template IDs 0x40–0x7F: parameterised (variable length)
 */

const { floatToBytes, bytesToFloat } = require('./utils');

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Template
 * @property {number} id - Template byte ID
 * @property {string} name - Human-readable template name / key
 * @property {string} text - Full text representation
 * @property {boolean} hasParams - Whether this template takes parameters
 * @property {string[]} [paramNames] - Names of parameters
 * @property {Function} [encodeParams] - (params) → Buffer of param bytes
 * @property {Function} [decodeParams] - (buf, offset) → { params, bytesRead }
 * @property {Function} [format] - (params) → full text string
 */

const TEMPLATES = [];
const BY_NAME = {};
const BY_ID = {};

function defineSimple(id, name, text) {
  const tmpl = { id, name, text, hasParams: false };
  TEMPLATES.push(tmpl);
  BY_NAME[name] = tmpl;
  BY_ID[id] = tmpl;
}

function defineParam(id, name, opts) {
  const tmpl = {
    id,
    name,
    hasParams: true,
    paramNames: opts.paramNames,
    encodeParams: opts.encodeParams,
    decodeParams: opts.decodeParams,
    format: opts.format,
    text: opts.text || name,
  };
  TEMPLATES.push(tmpl);
  BY_NAME[name] = tmpl;
  BY_ID[id] = tmpl;
}

// ----- Simple templates (1 byte each) -----

defineSimple(0x00, 'ok',            "I'm OK");
defineSimple(0x01, 'need_help',     'Need help');
defineSimple(0x02, 'emergency',     'Emergency!');
defineSimple(0x03, 'yes',           'Yes');
defineSimple(0x04, 'no',            'No');
defineSimple(0x05, 'maybe',         'Maybe');
defineSimple(0x06, 'on_my_way',     'On my way');
defineSimple(0x07, 'call_me',       'Call me');
defineSimple(0x08, 'copy',          'Copy');
defineSimple(0x09, 'roger',         'Roger');
defineSimple(0x0A, 'thanks',        'Thanks');
defineSimple(0x0B, 'please',        'Please');
defineSimple(0x0C, 'sorry',         'Sorry');
defineSimple(0x0D, 'hello',         'Hello');
defineSimple(0x0E, 'goodbye',       'Goodbye');
defineSimple(0x0F, 'good_morning',  'Good morning');
defineSimple(0x10, 'good_night',    'Good night');
defineSimple(0x11, 'safe',          "I'm safe");
defineSimple(0x12, 'help_coming',   'Help is coming');
defineSimple(0x13, 'stay_put',      'Stay put');
defineSimple(0x14, 'move_out',      'Move out');
defineSimple(0x15, 'all_clear',     'All clear');
defineSimple(0x16, 'danger',        'Danger');
defineSimple(0x17, 'stop',          'Stop');
defineSimple(0x18, 'go',            'Go');
defineSimple(0x19, 'wait',          'Wait');
defineSimple(0x1A, 'affirmative',   'Affirmative');
defineSimple(0x1B, 'negative',      'Negative');
defineSimple(0x1C, 'check_in',      'Checking in');
defineSimple(0x1D, 'heading_home',  'Heading home');
defineSimple(0x1E, 'arrived',       'Arrived');
defineSimple(0x1F, 'leaving_now',   'Leaving now');
defineSimple(0x20, 'be_right_back', 'Be right back');
defineSimple(0x21, 'brb',           'BRB');
defineSimple(0x22, 'sos',           'SOS');
defineSimple(0x23, 'mayday',        'Mayday');
defineSimple(0x24, 'send_help',     'Send help');
defineSimple(0x25, 'lost',          "I'm lost");
defineSimple(0x26, 'found_it',      'Found it');
defineSimple(0x27, 'send_coords',   'Send coordinates');
defineSimple(0x28, 'low_battery',   'Low battery');
defineSimple(0x29, 'charging',      'Charging');
defineSimple(0x2A, 'no_signal',     'No signal');
defineSimple(0x2B, 'weak_signal',   'Weak signal');
defineSimple(0x2C, 'strong_signal', 'Strong signal');
defineSimple(0x2D, 'rain',          'Rain');
defineSimple(0x2E, 'clear_sky',     'Clear sky');
defineSimple(0x2F, 'overcast',      'Overcast');
defineSimple(0x30, 'windy',         'Windy');
defineSimple(0x31, 'fog',           'Fog');
defineSimple(0x32, 'snow',          'Snow');
defineSimple(0x33, 'storm',         'Storm');
defineSimple(0x34, 'understood',    'Understood');
defineSimple(0x35, 'repeat',        'Say again');
defineSimple(0x36, 'over_out',      'Over and out');
defineSimple(0x37, 'standing_by',   'Standing by');
defineSimple(0x38, 'busy',          'Busy');
defineSimple(0x39, 'free',          'Free');
defineSimple(0x3A, 'meet_up',       'Meet up?');
defineSimple(0x3B, 'come_here',     'Come here');
defineSimple(0x3C, 'run',           'Run!');
defineSimple(0x3D, 'hide',          'Hide');
defineSimple(0x3E, 'quiet',         'Be quiet');
defineSimple(0x3F, 'listen',        'Listen');

// ----- Parameterised templates -----

// Location: 1 byte ID + 4 bytes lat + 4 bytes lon = 9 bytes
defineParam(0x40, 'location', {
  text: 'At location',
  paramNames: ['lat', 'lon'],
  encodeParams(params) {
    const buf = Buffer.alloc(8);
    buf.writeFloatBE(params.lat, 0);
    buf.writeFloatBE(params.lon, 4);
    return buf;
  },
  decodeParams(buf, offset) {
    if (offset + 8 > buf.length) throw new Error('Truncated location params');
    const lat = buf.readFloatBE(offset);
    const lon = buf.readFloatBE(offset + 4);
    return { params: { lat, lon }, bytesRead: 8 };
  },
  format(params) {
    return `At location [${params.lat.toFixed(6)}, ${params.lon.toFixed(6)}]`;
  },
});

// ETA in minutes: 1 byte ID + 1 byte minutes (0-255) = 2 bytes
defineParam(0x41, 'eta', {
  text: 'ETA',
  paramNames: ['minutes'],
  encodeParams(params) {
    return Buffer.from([Math.min(255, Math.max(0, Math.round(params.minutes)))]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated ETA params');
    return { params: { minutes: buf[offset] }, bytesRead: 1 };
  },
  format(params) {
    return `ETA ${params.minutes} minutes`;
  },
});

// Weather type: 1 byte ID + 1 byte weather code = 2 bytes
const WEATHER_CODES = [
  'clear', 'cloudy', 'rain', 'heavy rain', 'drizzle', 'snow',
  'sleet', 'hail', 'fog', 'mist', 'wind', 'storm', 'thunder',
  'tornado', 'hurricane', 'hot', 'cold', 'freezing', 'mild', 'warm',
];

defineParam(0x42, 'weather', {
  text: 'Weather',
  paramNames: ['type'],
  encodeParams(params) {
    const idx = WEATHER_CODES.indexOf(params.type);
    if (idx < 0) throw new Error(`Unknown weather type: ${params.type}`);
    return Buffer.from([idx]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated weather params');
    const idx = buf[offset];
    if (idx >= WEATHER_CODES.length) throw new Error(`Invalid weather code: ${idx}`);
    return { params: { type: WEATHER_CODES[idx] }, bytesRead: 1 };
  },
  format(params) {
    return `Weather: ${params.type}`;
  },
});

// Channel number: 1 byte ID + 1 byte channel = 2 bytes
defineParam(0x43, 'switch_channel', {
  text: 'Switch channel',
  paramNames: ['channel'],
  encodeParams(params) {
    return Buffer.from([params.channel & 0xFF]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated channel params');
    return { params: { channel: buf[offset] }, bytesRead: 1 };
  },
  format(params) {
    return `Switch to channel ${params.channel}`;
  },
});

// Heading (compass bearing): 1 byte ID + 2 bytes bearing (0-359) = 3 bytes
defineParam(0x44, 'heading', {
  text: 'Heading',
  paramNames: ['bearing'],
  encodeParams(params) {
    const b = Math.round(params.bearing) & 0x1FF;
    return Buffer.from([(b >> 8) & 0xFF, b & 0xFF]);
  },
  decodeParams(buf, offset) {
    if (offset + 2 > buf.length) throw new Error('Truncated heading params');
    const bearing = ((buf[offset] & 0x01) << 8) | buf[offset + 1];
    return { params: { bearing }, bytesRead: 2 };
  },
  format(params) {
    return `Heading ${params.bearing}°`;
  },
});

// Altitude in metres: 1 byte ID + 2 bytes altitude (signed, -32768 to 32767) = 3 bytes
defineParam(0x45, 'altitude', {
  text: 'Altitude',
  paramNames: ['metres'],
  encodeParams(params) {
    const buf = Buffer.alloc(2);
    buf.writeInt16BE(Math.round(params.metres), 0);
    return buf;
  },
  decodeParams(buf, offset) {
    if (offset + 2 > buf.length) throw new Error('Truncated altitude params');
    const metres = buf.readInt16BE(offset);
    return { params: { metres }, bytesRead: 2 };
  },
  format(params) {
    return `Altitude ${params.metres}m`;
  },
});

// Speed in km/h: 1 byte ID + 1 byte speed = 2 bytes
defineParam(0x46, 'speed', {
  text: 'Speed',
  paramNames: ['kmh'],
  encodeParams(params) {
    return Buffer.from([Math.min(255, Math.max(0, Math.round(params.kmh)))]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated speed params');
    return { params: { kmh: buf[offset] }, bytesRead: 1 };
  },
  format(params) {
    return `Speed ${params.kmh} km/h`;
  },
});

// Battery percentage: 1 byte ID + 1 byte percent = 2 bytes
defineParam(0x47, 'battery', {
  text: 'Battery',
  paramNames: ['percent'],
  encodeParams(params) {
    return Buffer.from([Math.min(100, Math.max(0, Math.round(params.percent)))]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated battery params');
    return { params: { percent: buf[offset] }, bytesRead: 1 };
  },
  format(params) {
    return `Battery ${params.percent}%`;
  },
});

// Number of people: 1 byte ID + 1 byte count = 2 bytes
defineParam(0x48, 'headcount', {
  text: 'Headcount',
  paramNames: ['count'],
  encodeParams(params) {
    return Buffer.from([Math.min(255, Math.max(0, params.count))]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated headcount params');
    return { params: { count: buf[offset] }, bytesRead: 1 };
  },
  format(params) {
    return `${params.count} people`;
  },
});

// Custom short text (up to 32 chars): 1 byte ID + 1 byte len + text bytes
defineParam(0x49, 'short_text', {
  text: 'Short text',
  paramNames: ['text'],
  encodeParams(params) {
    const textBuf = Buffer.from(params.text, 'utf8');
    if (textBuf.length > 32) throw new Error('Short text max 32 bytes');
    return Buffer.concat([Buffer.from([textBuf.length]), textBuf]);
  },
  decodeParams(buf, offset) {
    if (offset + 1 > buf.length) throw new Error('Truncated short_text params');
    const len = buf[offset];
    if (offset + 1 + len > buf.length) throw new Error('Truncated short_text data');
    const text = buf.slice(offset + 1, offset + 1 + len).toString('utf8');
    return { params: { text }, bytesRead: 1 + len };
  },
  format(params) {
    return params.text;
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode a codebook message.
 * @param {string} templateName - Template name (e.g. 'ok', 'location', 'eta')
 * @param {Object} [params] - Parameters for parameterised templates
 * @returns {Buffer} Encoded bytes
 */
function encode(templateName, params) {
  const tmpl = BY_NAME[templateName];
  if (!tmpl) throw new Error(`Unknown template: ${templateName}`);

  if (tmpl.hasParams) {
    if (!params) throw new Error(`Template '${templateName}' requires params: ${tmpl.paramNames.join(', ')}`);
    const paramBuf = tmpl.encodeParams(params);
    return Buffer.concat([Buffer.from([tmpl.id]), paramBuf]);
  }

  return Buffer.from([tmpl.id]);
}

/**
 * Decode a codebook message.
 * @param {Buffer|Uint8Array} buf - Encoded bytes
 * @returns {{ template: string, text: string, params: Object|null }}
 */
function decode(buf) {
  if (!buf || buf.length === 0) throw new Error('Empty codebook buffer');

  const id = buf[0];
  const tmpl = BY_ID[id];
  if (!tmpl) throw new Error(`Unknown template ID: 0x${id.toString(16).padStart(2, '0')}`);

  if (tmpl.hasParams) {
    const { params, bytesRead } = tmpl.decodeParams(buf, 1);
    return {
      template: tmpl.name,
      text: tmpl.format(params),
      params,
    };
  }

  return {
    template: tmpl.name,
    text: tmpl.text,
    params: null,
  };
}

/**
 * List all available templates.
 * @returns {Array<{ name: string, text: string, hasParams: boolean, paramNames: string[] }>}
 */
function listTemplates() {
  return TEMPLATES.map(t => ({
    name: t.name,
    text: t.text,
    hasParams: t.hasParams,
    paramNames: t.paramNames || [],
  }));
}

module.exports = {
  encode,
  decode,
  listTemplates,
  TEMPLATES,
  BY_NAME,
  BY_ID,
  WEATHER_CODES,
};
