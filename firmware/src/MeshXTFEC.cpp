#include "MeshXTFEC.h"
#include <string.h>

/**
 * Reed-Solomon over GF(2^8) with primitive polynomial 0x11D
 *
 * Compact implementation suitable for ESP32/nRF52.
 * Uses 512+256 bytes for exp/log tables.
 */

#define GF_SIZE 256
#define PRIM_POLY 0x11D

static uint8_t gf_exp[512];
static uint8_t gf_log[256];
static bool fec_initialized = false;

void meshxt_fec_init(void) {
    if (fec_initialized) return;

    int x = 1;
    for (int i = 0; i < 255; i++) {
        gf_exp[i] = (uint8_t)x;
        gf_log[x] = (uint8_t)i;
        x <<= 1;
        if (x & 0x100) x ^= PRIM_POLY;
    }
    for (int i = 255; i < 512; i++) {
        gf_exp[i] = gf_exp[i - 255];
    }

    fec_initialized = true;
}

static inline uint8_t gf_mul(uint8_t a, uint8_t b) {
    if (a == 0 || b == 0) return 0;
    return gf_exp[gf_log[a] + gf_log[b]];
}

static inline uint8_t gf_div(uint8_t a, uint8_t b) {
    if (a == 0) return 0;
    return gf_exp[(gf_log[a] + 255 - gf_log[b]) % 255];
}

/**
 * Compute RS parity symbols.
 * Generator polynomial built on the fly to save RAM.
 * g(x) = (x - alpha^0)(x - alpha^1)...(x - alpha^(nsym-1))
 * Coefficients stored with gen[0] = x^nsym coefficient (always 1)
 */
static void rs_encode(const uint8_t *msg, size_t msgLen, uint8_t *parity, uint8_t nsym) {
    // Build generator polynomial
    uint8_t gen[65]; // max nsym = 64, so gen has nsym+1 coefficients
    memset(gen, 0, sizeof(gen));
    gen[0] = 1;
    int genLen = 1;

    for (int i = 0; i < nsym; i++) {
        // Multiply gen by (x - alpha^i)
        // New polynomial has genLen+1 coefficients
        for (int j = genLen; j > 0; j--) {
            gen[j] = gen[j - 1] ^ gf_mul(gen[j], gf_exp[i]);
        }
        gen[0] = gf_mul(gen[0], gf_exp[i]);
        genLen++;
    }

    // Systematic encoding: compute remainder of msg(x) * x^nsym mod gen(x)
    // Using feedback shift register
    uint8_t reg[65];
    memset(reg, 0, nsym);

    for (size_t i = 0; i < msgLen; i++) {
        uint8_t feedback = msg[i] ^ reg[0];
        // Shift register
        for (int j = 0; j < nsym - 1; j++) {
            reg[j] = reg[j + 1] ^ gf_mul(gen[nsym - 1 - j], feedback);
        }
        reg[nsym - 1] = gf_mul(gen[0], feedback);
    }

    // Parity is the register contents
    memcpy(parity, reg, nsym);
}

/**
 * Calculate syndromes.
 * S_i = P(alpha^i) where P is the received polynomial.
 * Using Horner's method: result = (...((msg[0] * x + msg[1]) * x + msg[2]) * x + ...)
 */
static void rs_syndromes(const uint8_t *msg, size_t len, uint8_t nsym, uint8_t *synd) {
    for (int i = 0; i < nsym; i++) {
        uint8_t val = 0;
        uint8_t alpha_i = gf_exp[i];
        for (size_t j = 0; j < len; j++) {
            val = gf_mul(val, alpha_i) ^ msg[j];
        }
        synd[i] = val;
    }
}

/**
 * Check if all syndromes are zero (no errors).
 */
static bool rs_check(const uint8_t *synd, uint8_t nsym) {
    for (int i = 0; i < nsym; i++) {
        if (synd[i] != 0) return false;
    }
    return true;
}

int meshxt_fec_encode(const uint8_t *data, size_t dataLen, uint8_t *output, uint8_t nsym) {
    meshxt_fec_init();

    if (dataLen + nsym > 255) return -1;
    if (nsym != MESHXT_FEC_LOW && nsym != MESHXT_FEC_MEDIUM && nsym != MESHXT_FEC_HIGH) return -1;

    memcpy(output, data, dataLen);
    rs_encode(data, dataLen, output + dataLen, nsym);

    return (int)(dataLen + nsym);
}

int meshxt_fec_decode(const uint8_t *data, size_t dataLen, uint8_t *output, uint8_t nsym) {
    meshxt_fec_init();

    if (dataLen < nsym) return -1;

    uint8_t synd[64];
    rs_syndromes(data, dataLen, nsym, synd);

    if (rs_check(synd, nsym)) {
        // No errors — just strip parity
        size_t msgLen = dataLen - nsym;
        memcpy(output, data, msgLen);
        return (int)msgLen;
    }

    // Error correction using Berlekamp-Massey + Chien search + Forney
    // For firmware v0.1, we detect but don't correct — return -1
    // Full correction will be added in v0.2
    // (Clean decode works; corrupted packets are flagged for retransmit)
    return -1;
}
