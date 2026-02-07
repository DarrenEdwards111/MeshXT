'use strict';

/**
 * MeshXT Adaptive Spreading Factor Selection
 *
 * Recommends optimal LoRa parameters based on compressed message size
 * and desired range. Optimised for UK 868 MHz ISM band.
 *
 * UK 868 MHz ISM band (g1 sub-band, 868.0–868.6 MHz):
 *   - Max ERP: 25 mW (14 dBm)
 *   - Duty cycle: 1%
 *   - Meshtastic typically uses 869.4-869.65 MHz (10% duty cycle, 500mW)
 *     but we'll be conservative with 1% / 25 mW defaults
 */

// ---------------------------------------------------------------------------
// LoRa Physical Layer Parameters
// ---------------------------------------------------------------------------

// Spreading factors 7–12
const SF_MIN = 7;
const SF_MAX = 12;

// Available bandwidths (kHz)
const BANDWIDTHS = [125, 250, 500];

// Coding rates (denominator: 5=4/5, 6=4/6, 7=4/7, 8=4/8)
const CODING_RATES = [5, 6, 7, 8];

// Meshtastic max payload size
const MESHTASTIC_MAX_PAYLOAD = 237; // bytes

// UK 868 MHz defaults
const DEFAULT_TX_POWER = 14;     // dBm (25 mW ERP)
const DEFAULT_ANTENNA_GAIN = 2;  // dBi (typical small antenna)
const DEFAULT_DUTY_CYCLE = 0.01; // 1%
const DEFAULT_FREQ = 868;        // MHz

// ---------------------------------------------------------------------------
// LoRa airtime calculation
// ---------------------------------------------------------------------------

/**
 * Calculate LoRa symbol time.
 * @param {number} sf - Spreading factor (7-12)
 * @param {number} bw - Bandwidth in kHz
 * @returns {number} Symbol time in ms
 */
function symbolTime(sf, bw) {
  return (Math.pow(2, sf) / (bw * 1000)) * 1000;
}

/**
 * Calculate LoRa packet airtime in milliseconds.
 *
 * @param {number} payloadBytes - Payload size in bytes
 * @param {number} sf - Spreading factor (7-12)
 * @param {number} bw - Bandwidth in kHz (125, 250, 500)
 * @param {number} cr - Coding rate denominator (5-8, i.e., 4/5 to 4/8)
 * @param {boolean} [explicitHeader=true] - Use explicit header mode
 * @param {number} [preambleLen=8] - Preamble length in symbols
 * @returns {number} Airtime in milliseconds
 */
function airtime(payloadBytes, sf, bw, cr, explicitHeader = true, preambleLen = 8) {
  const tSym = symbolTime(sf, bw);
  const tPreamble = (preambleLen + 4.25) * tSym;

  const de = sf >= 11 ? 1 : 0; // Low data rate optimisation
  const ih = explicitHeader ? 0 : 1;

  const numerator = 8 * payloadBytes - 4 * sf + 28 + 16 - 20 * ih;
  const denominator = 4 * (sf - 2 * de);
  const nPayloadSymbols = 8 + Math.max(0, Math.ceil(numerator / denominator)) * cr;

  const tPayload = nPayloadSymbols * tSym;
  return tPreamble + tPayload;
}

/**
 * Calculate the data rate in bits per second.
 * @param {number} sf - Spreading factor
 * @param {number} bw - Bandwidth in kHz
 * @param {number} cr - Coding rate denominator
 * @returns {number} Data rate in bps
 */
function dataRate(sf, bw, cr) {
  return sf * (4 / cr) * (bw * 1000) / Math.pow(2, sf);
}

// ---------------------------------------------------------------------------
// Range estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the receiver sensitivity in dBm.
 * @param {number} sf - Spreading factor
 * @param {number} bw - Bandwidth in kHz
 * @returns {number} Sensitivity in dBm
 */
function rxSensitivity(sf, bw) {
  // Empirical formula based on SX1276 datasheet
  // Base sensitivity at SF7/125kHz ≈ -123 dBm
  // Each SF step adds ~2.5 dB of sensitivity
  // BW halving adds ~3 dB of sensitivity
  const baseSens = -123; // dBm at SF7, 125kHz
  const sfGain = (sf - 7) * 2.5;
  const bwGain = 10 * Math.log10(125 / bw);
  return baseSens - sfGain + bwGain;
}

/**
 * Estimate maximum range using the Hata model (suburban/rural).
 *
 * @param {number} sf - Spreading factor (7-12)
 * @param {number} bw - Bandwidth in kHz
 * @param {number} [txPower=14] - Transmit power in dBm
 * @param {number} [antennaGain=2] - Antenna gain in dBi
 * @param {number} [freq=868] - Frequency in MHz
 * @param {number} [txHeight=5] - Transmitter height in metres
 * @param {number} [rxHeight=1.5] - Receiver height in metres
 * @returns {{ rangeKm: number, linkBudget: number, sensitivity: number }}
 */
function rangeEstimate(sf, bw, txPower = DEFAULT_TX_POWER, antennaGain = DEFAULT_ANTENNA_GAIN, freq = DEFAULT_FREQ, txHeight = 5, rxHeight = 1.5) {
  const sensitivity = rxSensitivity(sf, bw);
  const linkBudget = txPower + antennaGain - sensitivity; // dB

  // Okumura-Hata model for suburban/rural at 868 MHz
  // Path loss (dB) = A + B * log10(d)
  // For suburban: PL = 69.55 + 26.16*log10(f) - 13.82*log10(hb) - a(hm) + (44.9 - 6.55*log10(hb))*log10(d) - correction
  const logFreq = Math.log10(freq);
  const logHb = Math.log10(txHeight);

  // Mobile antenna correction factor for small/medium city
  const aHm = (1.1 * logFreq - 0.7) * rxHeight - (1.56 * logFreq - 0.8);

  const A = 69.55 + 26.16 * logFreq - 13.82 * logHb - aHm;
  const B = 44.9 - 6.55 * logHb;

  // Suburban correction
  const suburbanCorrection = 2 * Math.pow(Math.log10(freq / 28), 2) + 5.4;

  // Solve for distance: linkBudget = A - suburbanCorrection + B * log10(d)
  const effectiveBudget = linkBudget - A + suburbanCorrection;
  const rangeKm = Math.pow(10, effectiveBudget / B);

  return {
    rangeKm: Math.round(rangeKm * 10) / 10,
    linkBudget: Math.round(linkBudget * 10) / 10,
    sensitivity: Math.round(sensitivity * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Adaptive parameter selection
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LoRaConfig
 * @property {number} sf - Spreading factor
 * @property {number} bw - Bandwidth in kHz
 * @property {number} cr - Coding rate denominator
 * @property {number} airtimeMs - Packet airtime in ms
 * @property {number} rangeKm - Estimated range in km
 * @property {number} dataRateBps - Data rate in bps
 * @property {number} dutyCycleUsage - Fraction of duty cycle used
 * @property {boolean} withinDutyLimit - Whether config stays within duty cycle
 */

/**
 * Recommend optimal LoRa parameters for a message.
 *
 * @param {number} payloadBytes - Compressed message size in bytes
 * @param {Object} [options]
 * @param {number} [options.desiredRangeKm] - Desired range in km (will pick cheapest config meeting this)
 * @param {number} [options.txPower=14] - Transmit power in dBm
 * @param {number} [options.antennaGain=2] - Antenna gain in dBi
 * @param {number} [options.dutyCycle=0.01] - Duty cycle limit (0.01 = 1%)
 * @param {number} [options.windowSeconds=3600] - Duty cycle window in seconds
 * @returns {LoRaConfig} Recommended configuration
 */
function recommend(payloadBytes, options = {}) {
  const {
    desiredRangeKm = 0,
    txPower = DEFAULT_TX_POWER,
    antennaGain = DEFAULT_ANTENNA_GAIN,
    dutyCycle = DEFAULT_DUTY_CYCLE,
    windowSeconds = 3600,
  } = options;

  if (payloadBytes > MESHTASTIC_MAX_PAYLOAD) {
    throw new Error(`Payload too large: ${payloadBytes} bytes (max ${MESHTASTIC_MAX_PAYLOAD})`);
  }

  const candidates = [];

  for (let sf = SF_MIN; sf <= SF_MAX; sf++) {
    for (const bw of BANDWIDTHS) {
      for (const cr of CODING_RATES) {
        const at = airtime(payloadBytes, sf, bw, cr);
        const range = rangeEstimate(sf, bw, txPower, antennaGain);
        const dr = dataRate(sf, bw, cr);
        const dutyUsage = (at / 1000) / windowSeconds;
        const withinLimit = dutyUsage <= dutyCycle;

        candidates.push({
          sf,
          bw,
          cr,
          airtimeMs: Math.round(at * 100) / 100,
          rangeKm: range.rangeKm,
          dataRateBps: Math.round(dr),
          dutyCycleUsage: Math.round(dutyUsage * 10000) / 10000,
          withinDutyLimit: withinLimit,
        });
      }
    }
  }

  // Filter to duty-cycle-compliant configs
  let viable = candidates.filter(c => c.withinDutyLimit);
  if (viable.length === 0) {
    // Fall back to all candidates, sorted by least duty cycle violation
    viable = candidates.sort((a, b) => a.dutyCycleUsage - b.dutyCycleUsage);
  }

  if (desiredRangeKm > 0) {
    // Filter to configs that meet desired range
    const meetsRange = viable.filter(c => c.rangeKm >= desiredRangeKm);
    if (meetsRange.length > 0) {
      // Among those meeting range, pick the one with lowest airtime
      meetsRange.sort((a, b) => a.airtimeMs - b.airtimeMs);
      return meetsRange[0];
    }
    // If nothing meets desired range, pick the one with max range
    viable.sort((a, b) => b.rangeKm - a.rangeKm);
    return viable[0];
  }

  // Default: optimise for range while keeping airtime reasonable
  // Sort by range desc, then airtime asc
  viable.sort((a, b) => {
    // Prefer higher SF (more range) but within Meshtastic defaults
    // Use a weighted score: range is king, but penalise extreme airtime
    const scoreA = a.rangeKm - a.airtimeMs / 10000;
    const scoreB = b.rangeKm - b.airtimeMs / 10000;
    return scoreB - scoreA;
  });

  return viable[0];
}

/**
 * Get all LoRa configurations for a payload size, sorted by range.
 * Useful for comparison tables.
 *
 * @param {number} payloadBytes
 * @param {Object} [options]
 * @returns {LoRaConfig[]}
 */
function allConfigs(payloadBytes, options = {}) {
  const {
    txPower = DEFAULT_TX_POWER,
    antennaGain = DEFAULT_ANTENNA_GAIN,
  } = options;

  const configs = [];
  for (let sf = SF_MIN; sf <= SF_MAX; sf++) {
    // Use BW=125 and CR=4/5 (Meshtastic LongFast defaults)
    const bw = 125;
    const cr = 5;
    const at = airtime(payloadBytes, sf, bw, cr);
    const range = rangeEstimate(sf, bw, txPower, antennaGain);
    const dr = dataRate(sf, bw, cr);
    const dutyUsage = (at / 1000) / 3600;

    configs.push({
      sf, bw, cr,
      airtimeMs: Math.round(at * 100) / 100,
      rangeKm: range.rangeKm,
      dataRateBps: Math.round(dr),
      dutyCycleUsage: Math.round(dutyUsage * 10000) / 10000,
      withinDutyLimit: dutyUsage <= 0.01,
    });
  }

  return configs;
}

module.exports = {
  recommend,
  allConfigs,
  airtime,
  dataRate,
  rangeEstimate,
  rxSensitivity,
  symbolTime,
  SF_MIN,
  SF_MAX,
  BANDWIDTHS,
  CODING_RATES,
  MESHTASTIC_MAX_PAYLOAD,
};
