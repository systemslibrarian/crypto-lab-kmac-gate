/**
 * The demo's headline claim is architectural: "one sponge, four modes".
 *
 * A comment saying so is worth nothing. These tests make it a property of the
 * repo — checked two ways, because either one alone can be fooled:
 *
 *   1. BEHAVIOURAL: every mode moves the same shared permutation counter.
 *      (A second copy of the permutation would leave it unmoved.)
 *   2. STRUCTURAL: the source contains exactly one round function and exactly
 *      one sponge. (A counter can be incremented by a copy that also imports
 *      the real module; reading the source catches that.)
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { utf8 } from './bytes'
import { sha3_256, shake } from './fips202'
import { permutationCallCount, resetPermutationCallCount } from './keccak-f1600'
import { cshake, kmac } from './sp800-185'

const SRC = join(import.meta.dirname, '..')

function sourceFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out.push({ path: full, text: readFileSync(full, 'utf8') })
      }
    }
  }
  walk(SRC)
  return out
}

describe('one permutation, shared by every mode', () => {
  const modes: [string, () => void][] = [
    ['SHA3-256', () => void sha3_256(utf8('msg'))],
    ['SHAKE128', () => void shake(128, utf8('msg'), 32)],
    ['SHAKE256', () => void shake(256, utf8('msg'), 32)],
    ['cSHAKE128', () => void cshake(128, utf8('msg'), 32, utf8(''), utf8('S'))],
    ['cSHAKE256', () => void cshake(256, utf8('msg'), 32, utf8('N'), utf8('S'))],
    [
      'KMAC128',
      () =>
        void kmac({
          strength: 128,
          key: utf8('k'),
          message: utf8('msg'),
          outputBits: 256,
          customization: utf8(''),
          xof: false,
        }),
    ],
    [
      'KMACXOF256',
      () =>
        void kmac({
          strength: 256,
          key: utf8('k'),
          message: utf8('msg'),
          outputBits: 512,
          customization: utf8(''),
          xof: true,
        }),
    ],
  ]

  it.each(modes)('%s drives the shared Keccak-f[1600] counter', (_name, run) => {
    resetPermutationCallCount()
    run()
    expect(permutationCallCount()).toBeGreaterThan(0)
  })

  it('the counter accumulates across modes — they are not separate cores', () => {
    resetPermutationCallCount()
    let running = 0
    for (const [, run] of modes) {
      run()
      expect(permutationCallCount()).toBeGreaterThan(running)
      running = permutationCallCount()
    }
  })
})

describe('the source really does contain one core', () => {
  it('defines the Keccak round function exactly once, in the core module', () => {
    const definers = sourceFiles().filter((f) => /export function keccakRound\b/.test(f.text))
    expect(definers.map((f) => f.path.slice(SRC.length))).toEqual(['/keccak/keccak-f1600.ts'])
  })

  it('defines the permutation entry point exactly once', () => {
    const definers = sourceFiles().filter((f) => /export function keccakF1600\b/.test(f.text))
    expect(definers).toHaveLength(1)
  })

  it('defines the sponge exactly once', () => {
    const definers = sourceFiles().filter((f) => /export class Sponge\b/.test(f.text))
    expect(definers).toHaveLength(1)
  })

  it('no module outside the core reimplements the round constants or offsets', () => {
    const offenders = sourceFiles()
      .filter((f) => !f.path.endsWith('keccak-f1600.ts') && !f.path.endsWith('vectors.ts'))
      .filter((f) => /0x8000000080008008|deriveRoundConstants\s*\(\)\s*[:{]/.test(f.text))
    expect(offenders.map((f) => f.path)).toEqual([])
  })

  it('every mode module reaches the permutation only through the sponge', () => {
    for (const name of ['fips202.ts', 'sp800-185.ts']) {
      const file = sourceFiles().find((f) => f.path.endsWith(name))
      expect(file, `${name} should exist`).toBeDefined()
      expect(file!.text).not.toMatch(/\bkeccakF1600\s*\(/)
    }
  })
})
