'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getPendingQueuedScans, updateQueuedScan, removeQueuedScan, requestBackgroundSync } from '@/lib/scan/offline-queue'
import { quickScan, deepCompare } from '@/lib/scan/api-client'
import type { QueuedScan } from '@/lib/scan/offline-queue'
import type { ScanRecord } from '@/lib/scan/types'

/**
 * Tracks online/offline status and automatically processes the offline
 * scan queue when connectivity returns.
 *
 * Returns:
 * - online: current connectivity status
 * - queuedCount: number of pending offline scans
 * - processing: whether the queue is currently being processed
 * - lastProcessedScan: the most recent scan result (for toast notifications)
 */
export function useConnectivity(
  onScanProcessed?: (scan: ScanRecord, queuedScan: QueuedScan) => void
) {
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [lastProcessedScan, setLastProcessedScan] = useState<{ record: ScanRecord; queuedScan: QueuedScan } | null>(null)
  const processingRef = useRef(false)

  const refreshQueueCount = useCallback(() => {
    setQueuedCount(getPendingQueuedScans().length)
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    if (!navigator.onLine) return
    const pending = getPendingQueuedScans()
    if (pending.length === 0) return

    processingRef.current = true
    setProcessing(true)

    for (const queuedScan of pending) {
      if (!navigator.onLine) break
      updateQueuedScan(queuedScan.id, { status: 'processing', attempts: queuedScan.attempts + 1 })

      try {
        let result
        if (queuedScan.mode === 'quick') {
          const res = await quickScan({
            image: queuedScan.image,
            category: queuedScan.category,
            deviceFingerprint: queuedScan.deviceFingerprint,
            region: queuedScan.region,
          })
          result = res.scan
        } else {
          const res = await deepCompare({
            image: queuedScan.image,
            category: queuedScan.category,
            deviceFingerprint: queuedScan.deviceFingerprint,
            region: queuedScan.region,
            onProgress: () => {},
          })
          result = res.scan
        }

        updateQueuedScan(queuedScan.id, { status: 'done', result })
        setLastProcessedScan({ record: result, queuedScan })
        onScanProcessed?.(result, queuedScan)
        setTimeout(() => removeQueuedScan(queuedScan.id), 5000)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed'
        updateQueuedScan(queuedScan.id, { status: 'failed', error: message })
      }
      refreshQueueCount()
    }

    processingRef.current = false
    setProcessing(false)
  }, [onScanProcessed, refreshQueueCount])

  useEffect(() => {
    // Online/offline status sync is a legitimate external-system check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine)
    refreshQueueCount()

    const handleOnline = () => {
      setOnline(true)
      setTimeout(() => processQueue(), 1000)
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const interval = setInterval(refreshQueueCount, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [refreshQueueCount, processQueue])

  // Auto-process on mount if online and there are pending scans.
  useEffect(() => {
    if (navigator.onLine && getPendingQueuedScans().length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      processQueue()
    }
  }, [processQueue])

  return {
    online,
    queuedCount,
    processing,
    lastProcessedScan,
    processQueue,
    refreshQueueCount,
    requestBackgroundSync,
  }
}
