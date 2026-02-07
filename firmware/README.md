# MeshXT Firmware Module

C/C++ port of MeshXT for running directly on Meshtastic devices (ESP32, nRF52).

**No computer needed** — compression and FEC run on the device itself.

## Files

```
firmware/src/
├── MeshXTCompress.h/cpp   — Smaz-style text compression
├── MeshXTFEC.h/cpp        — Reed-Solomon FEC over GF(2^8)
├── MeshXTPacket.h/cpp     — Packet framing (header + payload + FEC)
└── MeshXTModule.h/cpp     — Meshtastic firmware module wrapper
```

## Installation

### 1. Clone the Meshtastic firmware

```bash
git clone https://github.com/meshtastic/firmware.git
cd firmware
git submodule update --init
```

### 2. Copy MeshXT files

```bash
cp /path/to/MeshXT/firmware/src/MeshXT*.h firmware/src/modules/
cp /path/to/MeshXT/firmware/src/MeshXT*.cpp firmware/src/modules/
```

### 3. Register the module

Edit `src/modules/Modules.cpp` and add:

```cpp
#include "MeshXTModule.h"

// In the setupModules() function, add:
meshXTModule = new MeshXTModule();
```

### 4. Build with PlatformIO

```bash
# For T-Beam
pio run -e tbeam

# For Heltec V3
pio run -e heltec-v3

# For RAK4631
pio run -e rak4631
```

### 5. Flash your device

```bash
pio run -e tbeam --target upload
```

## How It Works

- MeshXT uses `PRIVATE_APP` portnum (256) for its packets
- Standard text messages are unaffected
- Both sender and receiver must have MeshXT installed
- Non-MeshXT nodes will simply ignore MeshXT packets

### Sending (automatic)

```
Text → Smaz compress → Reed-Solomon FEC → Packet frame → LoRa TX
```

### Receiving (automatic)

```
LoRa RX → Packet parse → FEC decode → Decompress → Display as text
```

## Memory Usage

| Component | Flash | RAM |
|-----------|-------|-----|
| Compression codebook | ~3 KB | ~254 bytes (length cache) |
| FEC tables | ~1 KB | ~768 bytes (exp + log tables) |
| Packet framing | ~1 KB | ~320 bytes (working buffers) |
| **Total** | **~5 KB** | **~1.3 KB** |

Well within ESP32 (4MB flash, 520KB RAM) and nRF52840 (1MB flash, 256KB RAM) limits.

## Standalone Usage (without Meshtastic)

The compression, FEC, and packet modules work standalone — no Meshtastic dependencies.

Compile without `-DMESHTASTIC_FIRMWARE` and use the C API directly:

```c
#include "MeshXTCompress.h"
#include "MeshXTFEC.h"
#include "MeshXTPacket.h"

// Compress a message
uint8_t compressed[256];
int compLen = meshxt_compress("Need help at bridge", compressed, sizeof(compressed));

// Add FEC
uint8_t protected[320];
int protLen = meshxt_fec_encode(compressed, compLen, protected, MESHXT_FEC_LOW);

// Or use the full packet API
uint8_t packet[237];
int pktLen = meshxt_create_packet("Hello MeshXT!", packet, MESHXT_COMP_SMAZ, MESHXT_FEC_LOW_CODE);

// Parse received packet
MeshXTParseResult result;
meshxt_parse_packet(packet, pktLen, &result);
printf("Message: %s\n", result.message);
```

## Current Limitations

- **v0.1**: FEC error *detection* works, but error *correction* returns failure (packets flagged for retransmit). Full Berlekamp-Massey correction coming in v0.2.
- Codebook templates not yet ported to C (coming in v0.2)
- Only Smaz compression available in firmware (codebook requires template matching)

## Compatibility

| Platform | Status |
|----------|--------|
| ESP32 (T-Beam, Heltec) | ✅ Supported |
| nRF52840 (RAK4631) | ✅ Supported |
| ESP32-S3 | ✅ Supported |
| RP2040 | ⚠️ Untested |

## License

Apache 2.0 — Copyright 2026 Darren Edwards
