'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'wss://psxterminal.com/'

export interface PsxTick {
  symbol: string
  last: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  timestamp: number
  status?: string
}

function parseTick(symbol: string, tick: Record<string, unknown>): PsxTick {
  const c = Number(tick.c ?? tick.price ?? tick.p ?? 0)
  const ch = Number(tick.ch ?? tick.change ?? 0)
  const pch = Number(tick.pch ?? tick.changePercent ?? 0)
  return {
    symbol,
    last: c,
    change: ch,
    changePercent: pch,
    volume: Number(tick.v ?? tick.volume ?? 0),
    high: Number(tick.h ?? tick.high ?? c),
    low: Number(tick.l ?? tick.low ?? c),
    timestamp: Number(tick.t ?? tick.timestamp ?? 0),
    status: tick.st as string | undefined,
  }
}

export function usePsxWebSocket(symbols: string[]) {
  const [ticks, setTicks] = useState<Record<string, PsxTick>>({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const symbolsKey = symbols.slice().sort().join(',')

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            subscriptionType: 'marketData',
            params: symbols.length ? { symbols } : {},
            requestId: `req-${Date.now()}`,
          })
        )
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'tickUpdate' && msg.symbol && msg.tick) {
            const tick = parseTick(msg.symbol, msg.tick)
            setTicks((prev) => ({ ...prev, [msg.symbol]: tick }))
          }
          if (msg.type === 'ping' && msg.timestamp != null) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }))
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 3000)
    }
  }, [symbolsKey])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [connect])

  return { ticks, connected }
}
