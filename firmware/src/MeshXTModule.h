#pragma once

#include "MeshXTPacket.h"

#if defined(MESHTASTIC_FIRMWARE)
#include "MeshModule.h"
#include "Router.h"

/**
 * MeshXTModule — Meshtastic firmware module for MeshXT compression + FEC
 *
 * Hooks into the Meshtastic message pipeline:
 * - On send: compresses and FEC-encodes text messages
 * - On receive: FEC-decodes and decompresses incoming MeshXT packets
 *
 * MeshXT packets are identified by portnum PRIVATE_APP (256)
 * to avoid conflicting with standard TEXT_MESSAGE_APP packets.
 *
 * Both sender and receiver must have MeshXT installed.
 * Non-MeshXT nodes will see the raw binary data.
 *
 * To install:
 * 1. Copy firmware/src/*.cpp and *.h into meshtastic/firmware/src/modules/
 * 2. Add MeshXTModule to the module init list in modules/Modules.cpp
 * 3. Build with PlatformIO
 */
class MeshXTModule : public MeshModule
{
  public:
    MeshXTModule();

    /**
     * Compress and send a text message via MeshXT encoding.
     *
     * @param text     Message text
     * @param dest     Destination node ID (NODENUM_BROADCAST for broadcast)
     * @param channel  Channel index
     * @return         true if sent successfully
     */
    bool sendCompressed(const char *text, uint32_t dest, uint8_t channel = 0);

  protected:
    virtual ProcessMessage handleReceived(const meshtastic_MeshPacket &mp) override;
    virtual bool wantPacket(const meshtastic_MeshPacket *p) override;

  private:
    uint8_t compType;
    uint8_t fecLevel;
};

extern MeshXTModule *meshXTModule;

#endif // MESHTASTIC_FIRMWARE
