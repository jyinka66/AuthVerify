'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface CommunityAlert {
  id: string
  brand: string
  productName?: string
  region?: string
  details?: string
  createdAt: string
}

/**
 * Connects to the community-alert mini-service (socket.io on port 3003 via
 * the gateway) and listens for counterfeit alerts in the user's region.
 *
 * Returns the connection status, a list of recent alerts, and a function
 * to dismiss alerts. Alerts are capped at 20 in memory.
 */
export function useCommunityAlerts(region?: string) {
  const [connected, setConnected] = useState(false)
  const [alerts, setAlerts] = useState<CommunityAlert[]>([])
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Connect via the gateway with the XTransformPort query.
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      if (region) socket.emit('join-region', region)
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('counterfeit-alert', (alert: CommunityAlert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 20))
    })

    socket.on('connect_error', () => setConnected(false))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [region])

  // Re-join the region room when the region changes.
  useEffect(() => {
    if (socketRef.current?.connected && region) {
      socketRef.current.emit('join-region', region)
    }
  }, [region])

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearAlerts = useCallback(() => setAlerts([]), [])

  return { connected, alerts, dismissAlert, clearAlerts }
}
