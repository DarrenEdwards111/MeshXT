#include "MeshXTCompress.h"
#include <string.h>

/**
 * Codebook — 254 most common English short-message substrings.
 * Index in this array IS the encoded byte value.
 * Sorted roughly by frequency in short conversational English.
 */
static const char *CODEBOOK[MESHXT_CODEBOOK_SIZE] = {
    /* 0x00 */ " ",
    /* 0x01 */ "e",
    /* 0x02 */ "t",
    /* 0x03 */ "a",
    /* 0x04 */ "o",
    /* 0x05 */ "i",
    /* 0x06 */ "n",
    /* 0x07 */ "s",
    /* 0x08 */ "r",
    /* 0x09 */ "h",
    /* 0x0A */ "l",
    /* 0x0B */ "d",
    /* 0x0C */ "the",
    /* 0x0D */ " the",
    /* 0x0E */ "th",
    /* 0x0F */ "he",
    /* 0x10 */ "in",
    /* 0x11 */ "er",
    /* 0x12 */ "an",
    /* 0x13 */ "on",
    /* 0x14 */ " a",
    /* 0x15 */ "re",
    /* 0x16 */ "nd",
    /* 0x17 */ "en",
    /* 0x18 */ "at",
    /* 0x19 */ "ed",
    /* 0x1A */ "or",
    /* 0x1B */ "es",
    /* 0x1C */ "is",
    /* 0x1D */ "it",
    /* 0x1E */ "ou",
    /* 0x1F */ "to",
    /* 0x20 */ "ing",
    /* 0x21 */ " to",
    /* 0x22 */ " is",
    /* 0x23 */ " in",
    /* 0x24 */ " it",
    /* 0x25 */ " an",
    /* 0x26 */ " on",
    /* 0x27 */ "tion",
    /* 0x28 */ "er ",
    /* 0x29 */ "ed ",
    /* 0x2A */ "es ",
    /* 0x2B */ " of",
    /* 0x2C */ "of ",
    /* 0x2D */ "and",
    /* 0x2E */ " and",
    /* 0x2F */ "for",
    /* 0x30 */ " for",
    /* 0x31 */ "you",
    /* 0x32 */ " you",
    /* 0x33 */ "tha",
    /* 0x34 */ "that",
    /* 0x35 */ " tha",
    /* 0x36 */ "hat",
    /* 0x37 */ "all",
    /* 0x38 */ "are",
    /* 0x39 */ " are",
    /* 0x3A */ "not",
    /* 0x3B */ " not",
    /* 0x3C */ "have",
    /* 0x3D */ " hav",
    /* 0x3E */ "with",
    /* 0x3F */ " wit",
    /* 0x40 */ "was",
    /* 0x41 */ " was",
    /* 0x42 */ "can",
    /* 0x43 */ " can",
    /* 0x44 */ "but",
    /* 0x45 */ " but",
    /* 0x46 */ "ght",
    /* 0x47 */ "igh",
    /* 0x48 */ "ing ",
    /* 0x49 */ "ent",
    /* 0x4A */ "ion",
    /* 0x4B */ "her",
    /* 0x4C */ " her",
    /* 0x4D */ "his",
    /* 0x4E */ " his",
    /* 0x4F */ "ould",
    /* 0x50 */ "ome",
    /* 0x51 */ "out",
    /* 0x52 */ " out",
    /* 0x53 */ "thi",
    /* 0x54 */ "this",
    /* 0x55 */ " thi",
    /* 0x56 */ "ver",
    /* 0x57 */ "ever",
    /* 0x58 */ "ust",
    /* 0x59 */ "just",
    /* 0x5A */ " jus",
    /* 0x5B */ "abo",
    /* 0x5C */ "abou",
    /* 0x5D */ "get",
    /* 0x5E */ " get",
    /* 0x5F */ "whe",
    /* 0x60 */ "when",
    /* 0x61 */ " whe",
    /* 0x62 */ " wh",
    /* 0x63 */ "ome ",
    /* 0x64 */ "here",
    /* 0x65 */ " her",
    /* 0x66 */ "ther",
    /* 0x67 */ "from",
    /* 0x68 */ " fro",
    /* 0x69 */ "ght ",
    /* 0x6A */ "rig",
    /* 0x6B */ "righ",
    /* 0x6C */ "ow",
    /* 0x6D */ "now",
    /* 0x6E */ " now",
    /* 0x6F */ "how",
    /* 0x70 */ " how",
    /* 0x71 */ "kno",
    /* 0x72 */ "know",
    /* 0x73 */ " kno",
    /* 0x74 */ "will",
    /* 0x75 */ " wil",
    /* 0x76 */ "ould ",
    /* 0x77 */ "hey",
    /* 0x78 */ "they",
    /* 0x79 */ " the ",
    /* 0x7A */ "like",
    /* 0x7B */ " lik",
    /* 0x7C */ "goin",
    /* 0x7D */ "going",
    /* 0x7E */ " goi",
    /* 0x7F */ "com",
    /* 0x80 */ "come",
    /* 0x81 */ " com",
    /* 0x82 */ "look",
    /* 0x83 */ " loo",
    /* 0x84 */ "wha",
    /* 0x85 */ "what",
    /* 0x86 */ " wha",
    /* 0x87 */ "back",
    /* 0x88 */ " bac",
    /* 0x89 */ "been",
    /* 0x8A */ " bee",
    /* 0x8B */ "good",
    /* 0x8C */ " goo",
    /* 0x8D */ "need",
    /* 0x8E */ " nee",
    /* 0x8F */ "help",
    /* 0x90 */ " hel",
    /* 0x91 */ "way",
    /* 0x92 */ " way",
    /* 0x93 */ "ple",
    /* 0x94 */ "leas",
    /* 0x95 */ "ease",
    /* 0x96 */ "than",
    /* 0x97 */ "hank",
    /* 0x98 */ "ank",
    /* 0x99 */ "here ",
    /* 0x9A */ "wor",
    /* 0x9B */ "work",
    /* 0x9C */ " wor",
    /* 0x9D */ "yeah",
    /* 0x9E */ " yea",
    /* 0x9F */ "sor",
    /* 0xA0 */ "sorry",
    /* 0xA1 */ " sor",
    /* 0xA2 */ "ple",
    /* 0xA3 */ "pleas",
    /* 0xA4 */ "lease",
    /* 0xA5 */ "okay",
    /* 0xA6 */ " oka",
    /* 0xA7 */ "may",
    /* 0xA8 */ "maybe",
    /* 0xA9 */ " may",
    /* 0xAA */ "sure",
    /* 0xAB */ " sur",
    /* 0xAC */ "min",
    /* 0xAD */ "minu",
    /* 0xAE */ "minut",
    /* 0xAF */ "think",
    /* 0xB0 */ " thin",
    /* 0xB1 */ " th",
    /* 0xB2 */ "don",
    /* 0xB3 */ "don'",
    /* 0xB4 */ "don't",
    /* 0xB5 */ " do",
    /* 0xB6 */ "ight",
    /* 0xB7 */ "night",
    /* 0xB8 */ " nig",
    /* 0xB9 */ "cal",
    /* 0xBA */ "call",
    /* 0xBB */ " cal",
    /* 0xBC */ "morn",
    /* 0xBD */ "morni",
    /* 0xBE */ " mor",
    /* 0xBF */ "see",
    /* 0xC0 */ " see",
    /* 0xC1 */ "day",
    /* 0xC2 */ " day",
    /* 0xC3 */ "today",
    /* 0xC4 */ " tod",
    /* 0xC5 */ "tomor",
    /* 0xC6 */ " tom",
    /* 0xC7 */ "free",
    /* 0xC8 */ " fre",
    /* 0xC9 */ "din",
    /* 0xCA */ "dinn",
    /* 0xCB */ "dinne",
    /* 0xCC */ " din",
    /* 0xCD */ "lunch",
    /* 0xCE */ " lun",
    /* 0xCF */ "meet",
    /* 0xD0 */ " mee",
    /* 0xD1 */ "time",
    /* 0xD2 */ " tim",
    /* 0xD3 */ "loc",
    /* 0xD4 */ "locat",
    /* 0xD5 */ " loc",
    /* 0xD6 */ "head",
    /* 0xD7 */ " hea",
    /* 0xD8 */ "wait",
    /* 0xD9 */ " wai",
    /* 0xDA */ "safe",
    /* 0xDB */ " saf",
    /* 0xDC */ "leav",
    /* 0xDD */ "leave",
    /* 0xDE */ " lea",
    /* 0xDF */ "around",
    /* 0xE0 */ " aro",
    /* 0xE1 */ "stay",
    /* 0xE2 */ " sta",
    /* 0xE3 */ "emer",
    /* 0xE4 */ "emerg",
    /* 0xE5 */ " eme",
    /* 0xE6 */ "copy",
    /* 0xE7 */ " cop",
    /* 0xE8 */ "rog",
    /* 0xE9 */ "roger",
    /* 0xEA */ " rog",
    /* 0xEB */ "over",
    /* 0xEC */ " ove",
    /* 0xED */ "ack",
    /* 0xEE */ " ack",
    /* 0xEF */ "'s",
    /* 0xF0 */ "n't",
    /* 0xF1 */ "'m",
    /* 0xF2 */ "'re",
    /* 0xF3 */ "'ll",
    /* 0xF4 */ "'ve",
    /* 0xF5 */ "ly ",
    /* 0xF6 */ "ment",
    /* 0xF7 */ "ness",
    /* 0xF8 */ "able",
    /* 0xF9 */ "ful",
    /* 0xFA */ "tion ",
    /* 0xFB */ ". ",
    /* 0xFC */ ", ",
    /* 0xFD */ "? ",
};

// Length cache for codebook entries
static uint8_t codebook_lens[MESHXT_CODEBOOK_SIZE];
static bool codebook_init = false;

static void init_codebook_lens() {
    if (codebook_init) return;
    for (int i = 0; i < MESHXT_CODEBOOK_SIZE; i++) {
        codebook_lens[i] = (uint8_t)strlen(CODEBOOK[i]);
    }
    codebook_init = true;
}

int meshxt_compress(const char *input, uint8_t *output, size_t outSize) {
    init_codebook_lens();

    size_t inLen = strlen(input);
    size_t pos = 0;
    size_t outPos = 0;

    // Literal accumulation buffer
    uint8_t litBuf[256];
    size_t litLen = 0;

    // Flush literals helper (inline)
    #define FLUSH_LITERALS() do { \
        while (litLen > 0) { \
            size_t chunk = litLen > 255 ? 255 : litLen; \
            if (outPos + 2 + chunk > outSize) return -1; \
            output[outPos++] = MESHXT_LITERAL_MARKER; \
            output[outPos++] = (uint8_t)chunk; \
            memcpy(&output[outPos], litBuf, chunk); \
            outPos += chunk; \
            if (chunk < litLen) memmove(litBuf, litBuf + chunk, litLen - chunk); \
            litLen -= chunk; \
        } \
    } while(0)

    while (pos < inLen) {
        // Greedy longest match
        int bestIdx = -1;
        uint8_t bestLen = 0;

        for (int i = 0; i < MESHXT_CODEBOOK_SIZE; i++) {
            uint8_t cLen = codebook_lens[i];
            if (cLen > bestLen && pos + cLen <= inLen) {
                if (memcmp(&input[pos], CODEBOOK[i], cLen) == 0) {
                    bestIdx = i;
                    bestLen = cLen;
                }
            }
        }

        if (bestLen >= 2 || (bestLen == 1 && bestIdx >= 0)) {
            FLUSH_LITERALS();
            if (outPos + 1 > outSize) return -1;
            output[outPos++] = (uint8_t)bestIdx;
            pos += bestLen;
        } else {
            if (litLen >= 255) {
                FLUSH_LITERALS();
            }
            litBuf[litLen++] = (uint8_t)input[pos];
            pos++;
        }
    }

    FLUSH_LITERALS();
    #undef FLUSH_LITERALS

    return (int)outPos;
}

int meshxt_decompress(const uint8_t *input, size_t inLen, char *output, size_t outSize) {
    init_codebook_lens();

    size_t pos = 0;
    size_t outPos = 0;

    while (pos < inLen) {
        uint8_t byte = input[pos];

        if (byte == MESHXT_LITERAL_MARKER) {
            pos++;
            if (pos >= inLen) return -1;
            uint8_t len = input[pos];
            pos++;
            if (pos + len > inLen) return -1;
            if (outPos + len >= outSize) return -1;
            memcpy(&output[outPos], &input[pos], len);
            outPos += len;
            pos += len;
        } else if (byte == 0xFF) {
            return -1; // Reserved
        } else {
            if (byte >= MESHXT_CODEBOOK_SIZE) return -1;
            uint8_t cLen = codebook_lens[byte];
            if (outPos + cLen >= outSize) return -1;
            memcpy(&output[outPos], CODEBOOK[byte], cLen);
            outPos += cLen;
            pos++;
        }
    }

    output[outPos] = '\0';
    return (int)outPos;
}
