# MeshXT Firmware Module

C/C++ port of MeshXT for running directly on Meshtastic devices (ESP32, nRF52).

**No computer needed after flashing** — compression and FEC run on the chip itself.

## Files

```
firmware/src/
├── MeshXTCompress.h/cpp   — Smaz-style text compression
├── MeshXTFEC.h/cpp        — Reed-Solomon FEC over GF(2^8)
├── MeshXTPacket.h/cpp     — Packet framing (header + payload + FEC)
└── MeshXTModule.h/cpp     — Meshtastic firmware module wrapper
```

## Prerequisites

Before you start, you'll need:

1. **A Meshtastic-compatible device** — T-Beam, Heltec V3, RAK4631, or similar
2. **A USB cable** — to connect your device to your computer
3. **VS Code** — download from https://code.visualstudio.com/
4. **PlatformIO extension** — install from the VS Code extensions marketplace
   - Open VS Code → Extensions (Ctrl+Shift+X) → Search "PlatformIO" → Install
   - Wait for it to finish installing (may take a few minutes)
5. **Git** — download from https://git-scm.com/downloads

## Installation — Step by Step

### Step 1: Clone the Meshtastic firmware

Open a terminal (or VS Code terminal) and run:

```bash
git clone https://github.com/meshtastic/firmware.git
cd firmware
git submodule update --init --recursive
```

This downloads the full Meshtastic source code. It may take a few minutes.

### Step 2: Clone MeshXT

In a separate folder:

```bash
git clone https://github.com/DarrenEdwards111/MeshXT.git
```

### Step 3: Copy MeshXT files into Meshtastic

Copy all the MeshXT firmware files into the Meshtastic modules folder:

**Linux/Mac:**
```bash
cp MeshXT/firmware/src/MeshXTCompress.h firmware/src/modules/
cp MeshXT/firmware/src/MeshXTCompress.cpp firmware/src/modules/
cp MeshXT/firmware/src/MeshXTFEC.h firmware/src/modules/
cp MeshXT/firmware/src/MeshXTFEC.cpp firmware/src/modules/
cp MeshXT/firmware/src/MeshXTPacket.h firmware/src/modules/
cp MeshXT/firmware/src/MeshXTPacket.cpp firmware/src/modules/
cp MeshXT/firmware/src/MeshXTModule.h firmware/src/modules/
cp MeshXT/firmware/src/MeshXTModule.cpp firmware/src/modules/
```

**Windows (Command Prompt):**
```cmd
copy MeshXT\firmware\src\MeshXTCompress.h firmware\src\modules\
copy MeshXT\firmware\src\MeshXTCompress.cpp firmware\src\modules\
copy MeshXT\firmware\src\MeshXTFEC.h firmware\src\modules\
copy MeshXT\firmware\src\MeshXTFEC.cpp firmware\src\modules\
copy MeshXT\firmware\src\MeshXTPacket.h firmware\src\modules\
copy MeshXT\firmware\src\MeshXTPacket.cpp firmware\src\modules\
copy MeshXT\firmware\src\MeshXTModule.h firmware\src\modules\
copy MeshXT\firmware\src\MeshXTModule.cpp firmware\src\modules\
```

### Step 4: Register the module

Open the file `firmware/src/modules/Modules.cpp` in VS Code.

**At the top** of the file, with the other `#include` lines, add:

```cpp
#include "MeshXTModule.h"
```

**Inside the `setupModules()` function**, add this line alongside the other module initialisations:

```cpp
meshXTModule = new MeshXTModule();
```

Save the file.

### Step 5: Open the project in VS Code

1. Open VS Code
2. File → Open Folder → select the `firmware` folder
3. Wait for PlatformIO to initialise (bottom status bar will show progress)

### Step 6: Select your board

Click the PlatformIO icon in the left sidebar, then choose your device:

| Device | PlatformIO Environment |
|--------|----------------------|
| LILYGO T-Beam | `tbeam` |
| LILYGO T-Beam S3 | `tbeam-s3-core` |
| Heltec V3 | `heltec-v3` |
| Heltec Wireless Tracker | `heltec-wireless-tracker` |
| RAK WisBlock (RAK4631) | `rak4631` |
| Station G2 | `station-g2` |

### Step 7: Build the firmware

**Option A — VS Code:**
- Click the ✓ (checkmark) button in the bottom PlatformIO toolbar to build
- Or press `Ctrl+Shift+P` → "PlatformIO: Build"

**Option B — Terminal:**
```bash
cd firmware

# Replace 'tbeam' with your board from the table above
pio run -e tbeam
```

If the build succeeds, you'll see `SUCCESS` in green.

**Common build errors:**
- "No such file" → Check you copied all 8 MeshXT files to the right folder
- "Undefined reference to meshXTModule" → Check you added the `#include` and `new MeshXTModule()` lines
- PlatformIO not found → Make sure the PlatformIO extension is installed and VS Code was restarted

### Step 8: Connect your device

1. Plug your Meshtastic device into your computer via USB
2. Wait for the driver to install (Windows may need CH340 or CP2102 drivers)
3. Check it appears as a COM port (Windows) or `/dev/ttyUSB0` (Linux) or `/dev/cu.usbserial` (Mac)

### Step 9: Flash the firmware

**Option A — VS Code:**
- Click the → (arrow) button in the bottom PlatformIO toolbar to upload
- Or press `Ctrl+Shift+P` → "PlatformIO: Upload"

**Option B — Terminal:**
```bash
# Replace 'tbeam' with your board
pio run -e tbeam --target upload
```

The device will reboot with MeshXT installed.

### Step 10: Verify

1. Open the Meshtastic app on your phone
2. Connect to your device via Bluetooth
3. Send a test message
4. Check the serial monitor (PlatformIO: Serial Monitor) for MeshXT log lines:

```
MeshXT: TX 33 bytes → 42 bytes (27% saved)
MeshXT: RX from=0x12ab, 42 bytes → "Hello from MeshXT!" (18 chars)
```

If you see these lines, MeshXT is working! 🎉

## Important Notes

- **Both devices need MeshXT** — sender AND receiver must have it flashed
- **Standard messages still work** — MeshXT uses a separate channel (PRIVATE_APP portnum 256), so normal Meshtastic messages are unaffected
- **Non-MeshXT nodes** will simply ignore MeshXT packets (they won't see garbage)
- **You can run mixed networks** — some nodes with MeshXT, some without. They'll communicate normally on standard channels, and MeshXT-enhanced on the MeshXT channel

## How It Works

### Sending (automatic)

```
You type message
  → Smaz compression (saves 15-50%)
  → Reed-Solomon FEC (adds error protection)
  → 2-byte header (version + settings)
  → Sent as binary packet over LoRa
```

### Receiving (automatic)

```
LoRa packet received
  → Header parsed (version + settings)
  → FEC decode (errors corrected)
  → Smaz decompression
  → Displayed as normal text message
```

## Memory Usage

| Component | Flash | RAM |
|-----------|-------|-----|
| Compression codebook | ~3 KB | ~254 bytes |
| FEC tables | ~1 KB | ~768 bytes |
| Packet framing | ~1 KB | ~320 bytes |
| **Total** | **~5 KB** | **~1.3 KB** |

Well within ESP32 (4MB flash, 520KB RAM) and nRF52840 (1MB flash, 256KB RAM) limits. MeshXT adds less than 0.2% overhead to your device's resources.

## Standalone Usage (without Meshtastic)

The compression, FEC, and packet modules work standalone on any C/C++ project — no Meshtastic dependencies required.

Compile without `-DMESHTASTIC_FIRMWARE` and use the C API directly:

```c
#include "MeshXTCompress.h"
#include "MeshXTFEC.h"
#include "MeshXTPacket.h"

// Compress a message
uint8_t compressed[256];
int compLen = meshxt_compress("Need help at bridge", compressed, sizeof(compressed));

// Add FEC
uint8_t fecData[320];
int protLen = meshxt_fec_encode(compressed, compLen, fecData, MESHXT_FEC_LOW);

// Or use the full packet API (compress + FEC + framing in one call)
uint8_t packet[237];
int pktLen = meshxt_create_packet("Hello MeshXT!", packet, MESHXT_COMP_SMAZ, MESHXT_FEC_LOW_CODE);

// Parse a received packet
MeshXTParseResult result;
meshxt_parse_packet(packet, pktLen, &result);
printf("Message: %s\n", result.message);  // "Hello MeshXT!"
```

## Updating MeshXT

When a new version of MeshXT is released:

1. `cd MeshXT && git pull`
2. Copy the updated firmware files again (Step 3)
3. Rebuild and reflash (Steps 7-9)

Your Meshtastic settings and channels are preserved — only the firmware is updated.

## Reverting to Standard Meshtastic

If you want to go back to stock Meshtastic:

1. Simply reflash using the official Meshtastic web flasher: https://flasher.meshtastic.org/
2. Or remove the MeshXT lines from `Modules.cpp` and rebuild

## Current Limitations

- **v0.1**: FEC error *detection* works, but error *correction* returns failure (corrupted packets are flagged for retransmit). Full Berlekamp-Massey correction coming in v0.2
- Codebook templates (74 predefined messages) not yet ported to C — coming in v0.2
- Only Smaz compression available in firmware

## Compatibility

| Platform | Status |
|----------|--------|
| ESP32 (T-Beam, Heltec) | ✅ Supported |
| nRF52840 (RAK4631) | ✅ Supported |
| ESP32-S3 (T-Beam S3, Heltec V3) | ✅ Supported |
| RP2040 | ⚠️ Untested |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails with "No such file" | Check all 8 MeshXT files are in `src/modules/` |
| Build fails with "undefined reference" | Check `Modules.cpp` has the include and new MeshXTModule() |
| Device not detected | Install CH340/CP2102 USB drivers |
| Upload fails | Hold BOOT button on device while uploading |
| No MeshXT log messages | Check serial monitor at 115200 baud |
| Other node can't read messages | Both nodes need MeshXT flashed |

## License

Apache 2.0 — Copyright 2026 Darren Edwards
