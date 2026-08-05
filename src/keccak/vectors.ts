/**
 * Known-answer test vectors, transcribed from the specs.
 *
 * Sources:
 *   - FIPS 202 / NIST CAVP "SHA-3 and SHAKE" example values
 *     (https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)
 *   - NIST SP 800-185 sample values, Appendix A (cSHAKE) and Appendix A (KMAC)
 *
 * These are test data only — nothing here is imported by the app bundle.
 */

/** SP 800-185 sample key: the 32 bytes 0x40…0x5F. */
export const SAMPLE_KEY_HEX = '404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f'

/** SP 800-185 sample data #1: the 4 bytes 00 01 02 03. */
export const SAMPLE_DATA_4_HEX = '00010203'

/** SP 800-185 sample data #2: the 200 bytes 0x00…0xC7. */
export const SAMPLE_DATA_200_HEX = Array.from({ length: 200 }, (_, i) =>
  i.toString(16).padStart(2, '0'),
).join('')

export interface Sha3Vector {
  message: string
  digest: string
}

/** FIPS 202 SHA3-256 known answers (message given as an ASCII string). */
export const SHA3_256_VECTORS: Sha3Vector[] = [
  {
    message: '',
    digest: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
  },
  {
    message: 'abc',
    digest: '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
  },
  {
    message: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    digest: '41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376',
  },
  {
    message:
      'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
    digest: '916f6061fe879741ca6469b43971dfdb28b1a32dc36cb3254e812be27aad1d18',
  },
]

export interface ShakeVector {
  strength: 128 | 256
  message: string
  outputBytes: number
  output: string
}

/** FIPS 202 SHAKE known answers. */
export const SHAKE_VECTORS: ShakeVector[] = [
  {
    strength: 128,
    message: '',
    outputBytes: 32,
    output: '7f9c2ba4e88f827d616045507605853ed73b8093f6efbc88eb1a6eacfa66ef26',
  },
  {
    strength: 256,
    message: '',
    outputBytes: 32,
    output: '46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762f',
  },
]

export interface CshakeVector {
  name: string
  strength: 128 | 256
  dataHex: string
  functionName: string
  customization: string
  outputBytes: number
  output: string
}

/** SP 800-185 cSHAKE sample values (Appendix A). */
export const CSHAKE_VECTORS: CshakeVector[] = [
  {
    name: 'cSHAKE128 sample #1',
    strength: 128,
    dataHex: SAMPLE_DATA_4_HEX,
    functionName: '',
    customization: 'Email Signature',
    outputBytes: 32,
    output: 'c1c36925b6409a04f1b504fcbca9d82b4017277cb5ed2b2065fc1d3814d5aaf5',
  },
  {
    name: 'cSHAKE128 sample #2',
    strength: 128,
    dataHex: SAMPLE_DATA_200_HEX,
    functionName: '',
    customization: 'Email Signature',
    outputBytes: 32,
    output: 'c5221d50e4f822d96a2e8881a961420f294b7b24fe3d2094baed2c6524cc166b',
  },
  {
    name: 'cSHAKE256 sample #3',
    strength: 256,
    dataHex: SAMPLE_DATA_4_HEX,
    functionName: '',
    customization: 'Email Signature',
    outputBytes: 64,
    output:
      'd008828e2b80ac9d2218ffee1d070c48b8e4c87bff32c9699d5b6896eee0edd164020e2be0560858d9c00c037e34a96937c561a74c412bb4c746469527281c8c',
  },
  {
    name: 'cSHAKE256 sample #4',
    strength: 256,
    dataHex: SAMPLE_DATA_200_HEX,
    functionName: '',
    customization: 'Email Signature',
    outputBytes: 64,
    output:
      '07dc27b11e51fbac75bc7b3c1d983e8b4b85fb1defaf218912ac86430273091727f42b17ed1df63e8ec118f04b23633c1dfb1574c8fb55cb45da8e25afb092bb',
  },
]

export interface KmacVector {
  name: string
  strength: 128 | 256
  xof: boolean
  keyHex: string
  dataHex: string
  customization: string
  outputBits: number
  output: string
}

/** SP 800-185 KMAC and KMACXOF sample values (Appendix A). */
export const KMAC_VECTORS: KmacVector[] = [
  {
    name: 'KMAC128 sample #1',
    strength: 128,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: '',
    outputBits: 256,
    output: 'e5780b0d3ea6f7d3a429c5706aa43a00fadbd7d49628839e3187243f456ee14e',
  },
  {
    name: 'KMAC128 sample #2',
    strength: 128,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: 'My Tagged Application',
    outputBits: 256,
    output: '3b1fba963cd8b0b59e8c1a6d71888b7143651af8ba0a7070c0979e2811324aa5',
  },
  {
    name: 'KMAC128 sample #3',
    strength: 128,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_200_HEX,
    customization: 'My Tagged Application',
    outputBits: 256,
    output: '1f5b4e6cca02209e0dcb5ca635b89a15e271ecc760071dfd805faa38f9729230',
  },
  {
    name: 'KMAC256 sample #4',
    strength: 256,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: 'My Tagged Application',
    outputBits: 512,
    output:
      '20c570c31346f703c9ac36c61c03cb64c3970d0cfc787e9b79599d273a68d2f7f69d4cc3de9d104a351689f27cf6f5951f0103f33f4f24871024d9c27773a8dd',
  },
  {
    name: 'KMAC256 sample #5',
    strength: 256,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_200_HEX,
    customization: '',
    outputBits: 512,
    output:
      '75358cf39e41494e949707927cee0af20a3ff553904c86b08f21cc414bcfd691589d27cf5e15369cbbff8b9a4c2eb17800855d0235ff635da82533ec6b759b69',
  },
  {
    name: 'KMAC256 sample #6',
    strength: 256,
    xof: false,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_200_HEX,
    customization: 'My Tagged Application',
    outputBits: 512,
    output:
      'b58618f71f92e1d56c1b8c55ddd7cd188b97b4ca4d99831eb2699a837da2e4d970fbacfde50033aea585f1a2708510c32d07880801bd182898fe476876fc8965',
  },
  {
    name: 'KMACXOF128 sample #4',
    strength: 128,
    xof: true,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: '',
    outputBits: 256,
    output: 'cd83740bbd92ccc8cf032b1481a0f4460e7ca9dd12b08a0c4031178bacd6ec35',
  },
  {
    name: 'KMACXOF128 sample #5',
    strength: 128,
    xof: true,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: 'My Tagged Application',
    outputBits: 256,
    output: '31a44527b4ed9f5c6101d11de6d26f0620aa5c341def41299657fe9df1a3b16c',
  },
  {
    name: 'KMACXOF128 sample #6',
    strength: 128,
    xof: true,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_200_HEX,
    customization: 'My Tagged Application',
    outputBits: 256,
    output: '47026c7cd793084aa0283c253ef658490c0db61438b8326fe9bddf281b83ae0f',
  },
  {
    name: 'KMACXOF256 sample #7',
    strength: 256,
    xof: true,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_4_HEX,
    customization: 'My Tagged Application',
    outputBits: 512,
    output:
      '1755133f1534752aad0748f2c706fb5c784512cab835cd15676b16c0c6647fa96faa7af634a0bf8ff6df39374fa00fad9a39e322a7c92065a64eb1fb0801eb2b',
  },
  {
    name: 'KMACXOF256 sample #9',
    strength: 256,
    xof: true,
    keyHex: SAMPLE_KEY_HEX,
    dataHex: SAMPLE_DATA_200_HEX,
    customization: 'My Tagged Application',
    outputBits: 512,
    output:
      'd5be731c954ed7732846bb59dbe3a8e30f83e77a4bff4459f2f1c2b4ecebb8ce67ba01c62e8ab8578d2d499bd1bb276768781190020a306a97de281dcc30305d',
  },
]

/** FIPS 202 published ι round constants, to check the derived table against. */
export const PUBLISHED_ROUND_CONSTANTS: bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
]

/**
 * FIPS 202 published ρ offsets, laid out as the spec's table (rows y = 0…4,
 * columns x = 0…4), flattened to the `x + 5y` lane index used in the code.
 */
export const PUBLISHED_RHO_OFFSETS: number[] = [
  // y = 0:  x=0   x=1   x=2   x=3   x=4
  0, 1, 62, 28, 27,
  // y = 1
  36, 44, 6, 55, 20,
  // y = 2
  3, 10, 43, 25, 39,
  // y = 3
  41, 45, 15, 21, 8,
  // y = 4
  18, 2, 61, 56, 14,
]
