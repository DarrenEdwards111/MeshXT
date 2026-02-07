#pragma once

#include <stdint.h>
#include <stddef.h>

/**
 * MeshXT Reed-Solomon Forward Error Correction over GF(2^8)
 *
 * Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
 *
 * Correction levels:
 *   MESHXT_FEC_LOW    — 16 parity symbols, corrects up to  8 errors
 *   MESHXT_FEC_MEDIUM — 32 parity symbols, corrects up to 16 errors
 *   MESHXT_FEC_HIGH   — 64 parity symbols, corrects up to 32 errors
 */

#define MESHXT_FEC_LOW    16
#define MESHXT_FEC_MEDIUM 32
#define MESHXT_FEC_HIGH   64

/**
 * Initialise GF(2^8) lookup tables. Call once at startup.
 * Safe to call multiple times (idempotent).
 */
void meshxt_fec_init(void);

/**
 * Encode data with Reed-Solomon parity.
 *
 * @param data     Input data
 * @param dataLen  Length of input data
 * @param output   Output buffer (must be at least dataLen + nsym bytes)
 * @param nsym     Number of parity symbols (16, 32, or 64)
 * @return         Total output length (dataLen + nsym), or -1 on error
 */
int meshxt_fec_encode(const uint8_t *data, size_t dataLen, uint8_t *output, uint8_t nsym);

/**
 * Decode and error-correct Reed-Solomon encoded data.
 *
 * @param data     Input data with parity appended
 * @param dataLen  Total length (message + parity)
 * @param output   Output buffer for corrected message (parity stripped)
 * @param nsym     Number of parity symbols used during encoding
 * @return         Message length (dataLen - nsym), or -1 if uncorrectable
 */
int meshxt_fec_decode(const uint8_t *data, size_t dataLen, uint8_t *output, uint8_t nsym);
