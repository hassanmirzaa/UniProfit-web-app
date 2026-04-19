'use client'

import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'

export interface CandlePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

const UP_COLOR = '#22c55e'
const DOWN_COLOR = '#ef4444'
const UP_BORDER = '#16a34a'
const DOWN_BORDER = '#dc2626'
const VOLUME_UP = 'rgba(34, 197, 94, 0.4)'
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.4)'

interface CandlestickChartProps {
  data: CandlePoint[]
  height?: number
  className?: string
}

export function CandlestickChart({ data, height = 360, className = '' }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: 'hsl(var(--foreground))',
      },
      grid: {
        vertLines: { color: 'hsl(var(--border) / 0.3)' },
        horzLines: { color: 'hsl(var(--border) / 0.3)' },
      },
      width: containerRef.current.clientWidth,
      height,
      rightPriceScale: {
        borderColor: 'hsl(var(--border))',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'hsl(var(--border))',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_BORDER,
      borderDownColor: DOWN_BORDER,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    })

    const candleData = data.map((d) => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))
    candleSeries.setData(candleData)

    const volumeData = data
      .filter((d) => d.volume != null)
      .map((d) => ({
        time: d.date,
        value: d.volume!,
        color: d.close >= d.open ? VOLUME_UP : VOLUME_DOWN,
      }))
    if (volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: VOLUME_UP,
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        borderVisible: false,
      })
      volumeSeries.setData(volumeData)
      volumeRef.current = volumeSeries
    }

    chartRef.current = chart
    candleRef.current = candleSeries

    chart.timeScale().fitContent()

    const ro = new ResizeObserver((entries) => {
      const el = entries[0]?.target as HTMLElement
      if (el && chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth })
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [data, height])

  return <div ref={containerRef} className={className} style={{ height }} />
}
