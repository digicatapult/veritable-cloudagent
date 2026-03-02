/* eslint-disable no-console, @typescript-eslint/no-require-imports */
const fs = require('fs')

function patchFirstOccurrence(filePath, searchTerm, replacement, label) {
  if (!fs.existsSync(filePath)) {
    return { skipped: true, reason: 'missing-file' }
  }

  const content = fs.readFileSync(filePath, 'utf8')

  if (content.includes(replacement)) {
    return { skipped: true, reason: 'already-patched' }
  }

  if (!content.includes(searchTerm)) {
    return { skipped: true, reason: 'search-not-found' }
  }

  const newContent = content.replace(searchTerm, replacement)

  if (newContent === content) {
    return { skipped: true, reason: 'no-change' }
  }

  fs.writeFileSync(filePath, newContent, 'utf8')
  console.log(`[Patch] Applied: ${label} -> ${filePath}`)
  return { patched: true }
}

function tryPatchAny(label, candidates, searchTerm, replacement) {
  for (const filePath of candidates) {
    const result = patchFirstOccurrence(filePath, searchTerm, replacement, label)

    if (result.patched) return result
    if (result.reason === 'already-patched') {
      console.log(`[Patch] Already applied: ${label} -> ${filePath}`)
      return result
    }
  }

  console.warn(`[Patch] Skipped: ${label} (target not found in candidates)`)
  return { skipped: true }
}

try {
  // 1) PEX proofType selection fix
  tryPatchAny(
    'PEX proofType selection',
    [
      'node_modules/@credo-ts/core/build/modules/dif-presentation-exchange/DifPresentationExchangeService.js',
      'node_modules/@credo-ts/core/build/modules/dif-presentation-exchange/DifPresentationExchangeService.mjs',
    ],
    'return supportedSignatureSuites[0].proofType',
    'return foundSignatureSuite.proofType'
  )

  // 2) JSON-LD deep imports require explicit extensions for strict ESM resolution
  tryPatchAny(
    'JSON-LD node loader extension',
    [
      'node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.mjs',
      'node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.js',
    ],
    'import("@digitalcredentials/jsonld/lib/documentLoaders/node")',
    'import("@digitalcredentials/jsonld/lib/documentLoaders/node.js")'
  )

  tryPatchAny(
    'JSON-LD node loader extension (CJS require)',
    ['node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.js'],
    "require('@digitalcredentials/jsonld/lib/documentLoaders/node')",
    "require('@digitalcredentials/jsonld/lib/documentLoaders/node.js')"
  )

  tryPatchAny(
    'JSON-LD xhr loader extension',
    [
      'node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.native.mjs',
      'node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.native.js',
    ],
    'import("@digitalcredentials/jsonld/lib/documentLoaders/xhr")',
    'import("@digitalcredentials/jsonld/lib/documentLoaders/xhr.js")'
  )

  tryPatchAny(
    'JSON-LD xhr loader extension (CJS require)',
    ['node_modules/@credo-ts/core/build/modules/vc/data-integrity/libraries/nativeDocumentLoader.native.js'],
    "require('@digitalcredentials/jsonld/lib/documentLoaders/xhr')",
    "require('@digitalcredentials/jsonld/lib/documentLoaders/xhr.js')"
  )

  console.log('[Patch] Completed Credo dependency patch pass.')
} catch (err) {
  console.error('[Patch] Failed to patch Credo dependencies:', err)
  process.exit(1)
}
