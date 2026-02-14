#include "MeshXTModule.h"

#if defined(MESHTASTIC_FIRMWARE)

#include "MeshService.h"
#include "NodeDB.h"
#include "PowerFSM.h"
#include "Router.h"
#include "configuration.h"
#include "main.h"

MeshXTModule *meshXTModule;

/**
 * MeshXT uses PRIVATE_APP portnum (256) to identify its packets.
 * This avoids conflicting with standard TEXT_MESSAGE_APP.
 * Non-MeshXT nodes will ignore these packets.
 */
#define MESHXT_PORTNUM meshtastic_PortNum_PRIVATE_APP

MeshXTModule::MeshXTModule()
    : MeshModule("MeshXT", MESHXT_PORTNUM, MeshModule::SECURITY_PKI)
{
    // Default settings
    compType = MESHXT_COMP_SMAZ;
    fecLevel = MESHXT_FEC_LOW_CODE;
    enabled = true;

    // Initialise FEC tables
    meshxt_fec_init();
}

bool MeshXTModule::sendCompressed(const char *text, uint32_t dest, uint8_t channel)
{
    uint8_t packetBuf[MESHXT_MAX_PACKET_SIZE];

    int packetLen = meshxt_create_packet(text, packetBuf, compType, fecLevel);
    if (packetLen < 0) {
        LOG_ERROR("MeshXT: Failed to create packet for message");
        return false;
    }

    // Allocate a MeshPacket
    meshtastic_MeshPacket *mp = router->allocForSending();
    if (!mp) {
        LOG_ERROR("MeshXT: Failed to allocate packet");
        return false;
    }

    mp->to = dest;
    mp->channel = channel;
    mp->decoded.portnum = MESHXT_PORTNUM;
    mp->decoded.payload.size = packetLen;
    memcpy(mp->decoded.payload.bytes, packetBuf, packetLen);

    // Log compression stats
    size_t originalLen = strlen(text);
    LOG_INFO("MeshXT: TX %d bytes → %d bytes (%.0f%% saved)",
             originalLen, packetLen,
             100.0 * (1.0 - (double)packetLen / originalLen));

    service->sendToMesh(mp);
    return true;
}

bool MeshXTModule::interceptTextMessage(meshtastic_MeshPacket *mp)
{
    // Called from Router before sending — intercepts outgoing TEXT_MESSAGE_APP
    // packets from the phone/app and re-encodes them as MeshXT packets.
    //
    // Returns true if the packet was intercepted (caller should NOT send original).
    // Returns false if MeshXT is disabled or compression failed (send as normal).

    if (!enabled) return false;
    if (!mp) return false;
    if (mp->decoded.portnum != meshtastic_PortNum_TEXT_MESSAGE_APP) return false;

    // Only intercept locally-originated packets (from phone/CLI, not relayed)
    if (mp->from != 0 && mp->from != nodeDB->getNodeNum()) return false;

    // Extract the text
    const char *text = (const char *)mp->decoded.payload.bytes;
    size_t textLen = mp->decoded.payload.size;

    if (textLen == 0 || textLen > 237) return false; // Too short or too long

    // Compress and FEC-encode
    uint8_t packetBuf[MESHXT_MAX_PACKET_SIZE];
    int packetLen = meshxt_create_packet(text, packetBuf, compType, fecLevel);

    if (packetLen < 0) {
        LOG_WARN("MeshXT: Compression failed, sending as plain text");
        return false; // Fall back to normal send
    }

    // Only use MeshXT if we actually saved space (or if FEC is worth the overhead)
    if (packetLen >= (int)textLen && fecLevel == MESHXT_FEC_NONE_CODE) {
        LOG_INFO("MeshXT: No size benefit, sending as plain text");
        return false;
    }

    LOG_INFO("MeshXT: TX intercepted %d bytes → %d bytes (%.0f%% saved)",
             textLen, packetLen,
             100.0 * (1.0 - (double)packetLen / textLen));

    // Rewrite the packet in-place: change portnum and payload
    mp->decoded.portnum = MESHXT_PORTNUM;
    mp->decoded.payload.size = packetLen;
    memcpy(mp->decoded.payload.bytes, packetBuf, packetLen);

    return true; // Packet modified — send the MeshXT version
}

ProcessMessage MeshXTModule::handleReceived(const meshtastic_MeshPacket &mp)
{
    auto &p = mp.decoded;

    MeshXTParseResult result;
    int rc = meshxt_parse_packet(p.payload.bytes, p.payload.size, &result);

    if (rc < 0 || !result.valid) {
        LOG_WARN("MeshXT: Failed to decode packet from 0x%0x", mp.from);
        return ProcessMessage::CONTINUE;
    }

    LOG_INFO("MeshXT: RX from=0x%0x, %d bytes → \"%s\" (%d chars)",
             mp.from, p.payload.size, result.message, result.messageLen);

    // Re-inject as a standard TEXT_MESSAGE_APP packet so it:
    // 1. Shows on the device screen
    // 2. Gets sent to the Meshtastic app via BLE/serial
    // 3. Appears in message history
    meshtastic_MeshPacket *textMp = router->allocForSending();
    if (textMp) {
        *textMp = mp; // Copy original metadata (from, to, channel, hop count, etc.)
        textMp->decoded.portnum = meshtastic_PortNum_TEXT_MESSAGE_APP;
        textMp->decoded.payload.size = result.messageLen;
        memcpy(textMp->decoded.payload.bytes, result.message, result.messageLen);

        // Notify the phone/app via BLE/serial
        service->handleFromRadio(textMp);
    }

    // Also store for on-device screen display
    devicestate.rx_text_message = mp;
    devicestate.rx_text_message.decoded.portnum = meshtastic_PortNum_TEXT_MESSAGE_APP;
    devicestate.rx_text_message.decoded.payload.size = result.messageLen;
    memcpy(devicestate.rx_text_message.decoded.payload.bytes, result.message, result.messageLen);
    devicestate.has_rx_text_message = true;

    powerFSM.trigger(EVENT_RECEIVED_MSG);

    return ProcessMessage::STOP;
}

bool MeshXTModule::wantPacket(const meshtastic_MeshPacket *p)
{
    return p->decoded.portnum == MESHXT_PORTNUM;
}

#endif // MESHTASTIC_FIRMWARE
