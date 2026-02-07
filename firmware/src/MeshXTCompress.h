#pragma once

#include <stdint.h>
#include <stddef.h>

/**
 * MeshXT Smaz-style Short String Compression
 *
 * Optimised for short English text messages typical of Meshtastic.
 * Common substrings encoded as single bytes via a 254-entry codebook.
 *
 * Memory-efficient: uses a flat codebook with linear search
 * (fast enough for messages under 237 bytes on ESP32).
 */

#define MESHXT_LITERAL_MARKER 0xFE
#define MESHXT_CODEBOOK_SIZE 254
#define MESHXT_MAX_ENTRY_LEN 6

/**
 * Compress a UTF-8 text string.
 *
 * @param input    Input text (null-terminated)
 * @param output   Output buffer (must be at least inputLen + overhead)
 * @param outSize  Size of output buffer
 * @return         Number of bytes written to output, or -1 on error
 */
int meshxt_compress(const char *input, uint8_t *output, size_t outSize);

/**
 * Decompress a MeshXT-compressed buffer back to text.
 *
 * @param input    Compressed data
 * @param inLen    Length of compressed data
 * @param output   Output text buffer (null-terminated)
 * @param outSize  Size of output buffer
 * @return         Number of chars written (excluding null), or -1 on error
 */
int meshxt_decompress(const uint8_t *input, size_t inLen, char *output, size_t outSize);
