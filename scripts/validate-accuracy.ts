/**
 * AuthVerify — Accuracy Validation Script
 *
 * Runs a batch of labeled product images through the full verification
 * pipeline (Quick Scan + Deep Compare) and measures:
 *   - Precision (of the "high_risk_counterfeit" verdicts, how many were actually fake?)
 *   - Recall (of the actual fakes, how many did we catch?)
 *   - F1 score
 *   - Per-mode accuracy (Quick vs Deep)
 *   - Confusion matrix
 *
 * Usage:
 *   bun run scripts/validate-accuracy.ts <genuine-dir> <fake-dir>
 *
 * Directory structure expected:
 *   genuine/
 *     panadol_1.jpg
 *     panadol_2.jpg
 *     ...
 *   fake/
 *     panadol_fake_1.jpg
 *     ...
 *
 * Output: prints a report to stdout + writes accuracy-report.json
 */

import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { runQuickScan, runDeepCompare, runImageSearch, toReferenceImages, extractProductInfo } from '../src/lib/scan/ai'
import type { ProductCategory } from '../src/lib/scan/types'

interface TestCase {
  imagePath: string
  expectedVerdict: 'genuine' | 'fake'
  fileName: string
}

interface TestResult extends TestCase {
  mode: 'quick' | 'deep'
  actualVerdict: string
  confidenceScore: number
  correct: boolean
  error?: string
}

function loadTestCases(dir: string, expected: 'genuine' | 'fake'): TestCase[] {
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    return []
  }
  return readdirSync(dir)
    .filter((f) => /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f))
    .map((f) => ({
      imagePath: join(dir, f),
      expectedVerdict: expected,
      fileName: f,
    }))
}

function imageToBase64(path: string): { base64: string; mimeType: string } {
  const buffer = readFileSync(path)
  const ext = path.toLowerCase().split('.').pop()
  const mimeType =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif' ? 'image/gif' :
    ext === 'bmp' ? 'image/bmp' :
    'image/jpeg'
  return { base64: buffer.toString('base64'), mimeType }
}

async function runQuickScanCase(test: TestCase): Promise<TestResult> {
  try {
    const { base64, mimeType } = imageToBase64(test.imagePath)
    const result = await runQuickScan(base64, mimeType, null)
    const actual = result.verdict
    const expectedActual =
      test.expectedVerdict === 'genuine' ? 'likely_authentic' : 'high_risk_counterfeit'
    const correct = actual === expectedActual ||
      (test.expectedVerdict === 'genuine' && actual === 'inconclusive')
    return {
      ...test,
      mode: 'quick',
      actualVerdict: actual,
      confidenceScore: result.confidenceScore,
      correct,
    }
  } catch (err) {
    return {
      ...test,
      mode: 'quick',
      actualVerdict: 'error',
      confidenceScore: 0,
      correct: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function runDeepCompareCase(test: TestCase): Promise<TestResult> {
  try {
    const { base64, mimeType } = imageToBase64(test.imagePath)
    const info = await extractProductInfo(base64, mimeType)
    const query = [info.brand, info.productName].filter(Boolean).join(' ')
    const imgResult = await runImageSearch(`${query} original genuine packaging`, 5, 'us')
    const references = toReferenceImages(imgResult)
    if (references.length === 0) {
      const quick = await runQuickScan(base64, mimeType, info.category as ProductCategory | null)
      const expectedActual =
        test.expectedVerdict === 'genuine' ? 'likely_authentic' : 'high_risk_counterfeit'
      return {
        ...test,
        mode: 'deep',
        actualVerdict: quick.verdict + ' (fallback)',
        confidenceScore: quick.confidenceScore,
        correct: quick.verdict === expectedActual ||
          (test.expectedVerdict === 'genuine' && quick.verdict === 'inconclusive'),
      }
    }
    const result = await runDeepCompare(base64, mimeType, references, info.category as ProductCategory | null)
    const expectedActual =
      test.expectedVerdict === 'genuine' ? 'likely_authentic' : 'high_risk_counterfeit'
    return {
      ...test,
      mode: 'deep',
      actualVerdict: result.verdict,
      confidenceScore: result.confidenceScore,
      correct: result.verdict === expectedActual ||
        (test.expectedVerdict === 'genuine' && result.verdict === 'inconclusive'),
    }
  } catch (err) {
    return {
      ...test,
      mode: 'deep',
      actualVerdict: 'error',
      confidenceScore: 0,
      correct: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function computeMetrics(results: TestResult[]) {
  const total = results.length
  const correct = results.filter((r) => r.correct).length
  const accuracy = total > 0 ? correct / total : 0
  const predictedFake = results.filter((r) => r.actualVerdict === 'high_risk_counterfeit')
  const actualFakes = results.filter((r) => r.expectedVerdict === 'fake')
  const truePositives = predictedFake.filter((r) => r.expectedVerdict === 'fake').length
  const falsePositives = predictedFake.filter((r) => r.expectedVerdict === 'genuine').length
  const falseNegatives = actualFakes.filter(
    (r) => r.actualVerdict !== 'high_risk_counterfeit'
  ).length
  const precision = predictedFake.length > 0 ? truePositives / predictedFake.length : 0
  const recall = actualFakes.length > 0 ? truePositives / actualFakes.length : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  return {
    total,
    correct,
    accuracy: `${(accuracy * 100).toFixed(1)}%`,
    precision: `${(precision * 100).toFixed(1)}%`,
    recall: `${(recall * 100).toFixed(1)}%`,
    f1: f1.toFixed(3),
    confusionMatrix: {
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives: total - truePositives - falsePositives - falseNegatives,
    },
    errors: results.filter((r) => r.error).length,
  }
}

async function main() {
  const [, , genuineDir, fakeDir] = process.argv
  if (!genuineDir || !fakeDir) {
    console.error('Usage: bun run scripts/validate-accuracy.ts <genuine-dir> <fake-dir>')
    process.exit(1)
  }

  console.log('=== AuthVerify Accuracy Validation ===\n')
  console.log(`Loading genuine images from: ${genuineDir}`)
  console.log(`Loading fake images from: ${fakeDir}\n`)

  const genuineCases = loadTestCases(genuineDir, 'genuine')
  const fakeCases = loadTestCases(fakeDir, 'fake')
  const allCases = [...genuineCases, ...fakeCases]

  if (allCases.length === 0) {
    console.error('No test images found.')
    process.exit(1)
  }

  console.log(`Found ${genuineCases.length} genuine + ${fakeCases.length} fake = ${allCases.length} test cases\n`)
  console.log('Running Quick Scan on all cases...\n')

  const quickResults: TestResult[] = []
  for (let i = 0; i < allCases.length; i++) {
    const test = allCases[i]
    process.stdout.write(`  [${i + 1}/${allCases.length}] Quick: ${test.fileName}... `)
    const result = await runQuickScanCase(test)
    quickResults.push(result)
    console.log(`${result.actualVerdict} (${result.confidenceScore}%) ${result.correct ? 'PASS' : 'FAIL'}`)
  }

  console.log('\nRunning Deep Compare on all cases...\n')
  const deepResults: TestResult[] = []
  for (let i = 0; i < allCases.length; i++) {
    const test = allCases[i]
    process.stdout.write(`  [${i + 1}/${allCases.length}] Deep: ${test.fileName}... `)
    const result = await runDeepCompareCase(test)
    deepResults.push(result)
    console.log(`${result.actualVerdict} (${result.confidenceScore}%) ${result.correct ? 'PASS' : 'FAIL'}`)
  }

  const quickMetrics = computeMetrics(quickResults)
  const deepMetrics = computeMetrics(deepResults)
  const combinedMetrics = computeMetrics([...quickResults, ...deepResults])

  const report = {
    timestamp: new Date().toISOString(),
    genuineCount: genuineCases.length,
    fakeCount: fakeCases.length,
    quickScan: quickMetrics,
    deepCompare: deepMetrics,
    combined: combinedMetrics,
    details: { quickResults, deepResults },
  }

  writeFileSync('accuracy-report.json', JSON.stringify(report, null, 2))

  console.log('\n=== RESULTS ===\n')
  console.log('Quick Scan:')
  console.log(`  Accuracy:  ${quickMetrics.accuracy}`)
  console.log(`  Precision: ${quickMetrics.precision} (of "fake" verdicts, how many were really fake)`)
  console.log(`  Recall:    ${quickMetrics.recall} (of real fakes, how many we caught)`)
  console.log(`  F1:        ${quickMetrics.f1}`)
  console.log(`  Confusion: TP=${quickMetrics.confusionMatrix.truePositives} FP=${quickMetrics.confusionMatrix.falsePositives} FN=${quickMetrics.confusionMatrix.falseNegatives} TN=${quickMetrics.confusionMatrix.trueNegatives}`)
  console.log()
  console.log('Deep Compare:')
  console.log(`  Accuracy:  ${deepMetrics.accuracy}`)
  console.log(`  Precision: ${deepMetrics.precision}`)
  console.log(`  Recall:    ${deepMetrics.recall}`)
  console.log(`  F1:        ${deepMetrics.f1}`)
  console.log(`  Confusion: TP=${deepMetrics.confusionMatrix.truePositives} FP=${deepMetrics.confusionMatrix.falsePositives} FN=${deepMetrics.confusionMatrix.falseNegatives} TN=${deepMetrics.confusionMatrix.trueNegatives}`)
  console.log()
  console.log('Production readiness threshold: F1 >= 0.85')
  const ready = parseFloat(combinedMetrics.f1) >= 0.85
  console.log(`Combined F1: ${combinedMetrics.f1} -- ${ready ? 'READY' : 'NOT READY (needs tuning)'}`)
  console.log(`\nFull report written to accuracy-report.json`)
}

main().catch((err) => {
  console.error('Validation failed:', err)
  process.exit(1)
})
