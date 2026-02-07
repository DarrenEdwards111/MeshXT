#include "MeshXTPacket.h"
#include "MeshXTCompress.h"
#include "MeshXTFEC.h"
#include <string.h>

uint8_t meshxt_fec_nsym_from_code(uint8_t fecCode) {
    switch (fecCode) {
        case MESHXT_FEC_LOW_CODE:    return MESHXT_FEC_LOW;
        case MESHXT_FEC_MEDIUM_CODE: return MESHXT_FEC_MEDIUM;
        case MESHXT_FEC_HIGH_CODE:   return MESHXT_FEC_HIGH;
        default:                     return 0;
    }
}

static void encode_header(uint8_t *buf, uint8_t version, uint8_t compType, uint8_t fecCode, uint8_t flags) {
    buf[0] = ((version & 0x0F) << 4) | (compType & 0x0F);
    buf[1] = ((fecCode & 0x0F) << 4) | (flags & 0x0F);
}

static void decode_header(const uint8_t *buf, MeshXTHeader *hdr) {
    hdr->version  = (buf[0] >> 4) & 0x0F;
    hdr->compType = buf[0] & 0x0F;
    hdr->fecLevel = (buf[1] >> 4) & 0x0F;
    hdr->flags    = buf[1] & 0x0F;
}

int meshxt_create_packet(const char *message, uint8_t *output, uint8_t compType, uint8_t fecCode) {
    uint8_t payload[256];
    int payloadLen;

    // Step 1: Compress
    switch (compType) {
        case MESHXT_COMP_SMAZ:
            payloadLen = meshxt_compress(message, payload, sizeof(payload));
            if (payloadLen < 0) return -1;
            break;
        case MESHXT_COMP_NONE:
            payloadLen = (int)strlen(message);
            if (payloadLen > 237) return -1;
            memcpy(payload, message, payloadLen);
            break;
        default:
            return -1;
    }

    // Step 2: Apply FEC
    uint8_t nsym = meshxt_fec_nsym_from_code(fecCode);
    uint8_t fecData[320]; // payload + parity
    int fecLen;

    if (nsym > 0) {
        fecLen = meshxt_fec_encode(payload, payloadLen, fecData, nsym);
        if (fecLen < 0) return -1;
    } else {
        memcpy(fecData, payload, payloadLen);
        fecLen = payloadLen;
    }

    // Step 3: Build header
    encode_header(output, MESHXT_PACKET_VERSION, compType, fecCode, 0);

    // Step 4: Assemble
    int totalLen = MESHXT_HEADER_SIZE + fecLen;
    if (totalLen > MESHXT_MAX_PACKET_SIZE) return -1;

    memcpy(output + MESHXT_HEADER_SIZE, fecData, fecLen);

    return totalLen;
}

int meshxt_parse_packet(const uint8_t *packet, size_t packetLen, MeshXTParseResult *result) {
    memset(result, 0, sizeof(MeshXTParseResult));

    if (packetLen < MESHXT_HEADER_SIZE) {
        result->valid = false;
        return -1;
    }

    // Step 1: Parse header
    decode_header(packet, &result->header);

    if (result->header.version != MESHXT_PACKET_VERSION) {
        result->valid = false;
        return -1;
    }

    // Step 2: Extract data after header
    const uint8_t *data = packet + MESHXT_HEADER_SIZE;
    size_t dataLen = packetLen - MESHXT_HEADER_SIZE;

    // Step 3: FEC decode
    uint8_t nsym = meshxt_fec_nsym_from_code(result->header.fecLevel);
    uint8_t decoded[256];
    int decodedLen;

    if (nsym > 0) {
        decodedLen = meshxt_fec_decode(data, dataLen, decoded, nsym);
        if (decodedLen < 0) {
            result->valid = false;
            return -1;
        }
    } else {
        decodedLen = (int)dataLen;
        memcpy(decoded, data, dataLen);
    }

    result->payloadSize = decodedLen;

    // Step 4: Decompress
    switch (result->header.compType) {
        case MESHXT_COMP_SMAZ:
            result->messageLen = meshxt_decompress(decoded, decodedLen,
                                                    result->message, sizeof(result->message));
            if (result->messageLen < 0) {
                result->valid = false;
                return -1;
            }
            break;
        case MESHXT_COMP_NONE:
            if (decodedLen >= (int)sizeof(result->message)) {
                result->valid = false;
                return -1;
            }
            memcpy(result->message, decoded, decodedLen);
            result->message[decodedLen] = '\0';
            result->messageLen = decodedLen;
            break;
        default:
            result->valid = false;
            return -1;
    }

    result->packetSize = (int)packetLen;
    result->valid = true;
    return 0;
}
