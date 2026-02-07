#pragma once

#include <stdint.h>
#include <stddef.h>

/**
 * MeshXT Packet Framing
 *
 * Header (2 bytes):
 *   Byte 0: [VVVV CCCC] Version (4 bits) | Compression type (4 bits)
 *   Byte 1: [FFFF xxxx] FEC level (4 bits) | Flags (4 bits)
 *
 * Compression types: 0=none, 1=smaz, 2=codebook
 * FEC levels: 0=none, 1=low(16), 2=medium(32), 3=high(64)
 */

#define MESHXT_PACKET_VERSION  1
#define MESHXT_MAX_PACKET_SIZE 237
#define MESHXT_HEADER_SIZE     2

#define MESHXT_COMP_NONE     0
#define MESHXT_COMP_SMAZ     1
#define MESHXT_COMP_CODEBOOK 2

#define MESHXT_FEC_NONE_CODE   0
#define MESHXT_FEC_LOW_CODE    1
#define MESHXT_FEC_MEDIUM_CODE 2
#define MESHXT_FEC_HIGH_CODE   3

/**
 * Parsed packet header.
 */
typedef struct {
    uint8_t version;
    uint8_t compType;
    uint8_t fecLevel;
    uint8_t flags;
} MeshXTHeader;

/**
 * Result of parsing a packet.
 */
typedef struct {
    char message[256];     // Decoded message text
    int messageLen;        // Length of decoded message
    MeshXTHeader header;   // Parsed header
    int packetSize;        // Total packet size
    int payloadSize;       // Compressed payload size
    bool valid;            // Whether parsing succeeded
} MeshXTParseResult;

/**
 * Create a MeshXT packet from a text message.
 *
 * @param message    Input text (null-terminated)
 * @param output     Output buffer (at least MESHXT_MAX_PACKET_SIZE bytes)
 * @param compType   Compression type (MESHXT_COMP_*)
 * @param fecCode    FEC level code (MESHXT_FEC_*_CODE)
 * @return           Packet size in bytes, or -1 on error
 */
int meshxt_create_packet(const char *message, uint8_t *output, uint8_t compType, uint8_t fecCode);

/**
 * Parse a MeshXT packet back to a text message.
 *
 * @param packet     Input packet bytes
 * @param packetLen  Length of packet
 * @param result     Output parse result
 * @return           0 on success, -1 on error
 */
int meshxt_parse_packet(const uint8_t *packet, size_t packetLen, MeshXTParseResult *result);

/**
 * Get the number of FEC parity bytes for a given level code.
 */
uint8_t meshxt_fec_nsym_from_code(uint8_t fecCode);
