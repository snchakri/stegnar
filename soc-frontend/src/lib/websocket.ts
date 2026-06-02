// src/lib/websocket.ts

import { WS_URL } from './config'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(img: any) => void>()

function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  reconnectTimer = setTimeout(() => connect(), 3000)
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[WS] Connected to SOC event stream')
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'new_image') {
          listeners.forEach((listener) => listener(msg.payload))
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      ws = null
      if (listeners.size > 0) {
        console.log('[WS] Disconnected — reconnecting in 3s')
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      ws?.close()
    }
  } catch {
    scheduleReconnect()
  }
}

export function initWebSocket(onNewImage: (img: any) => void) {
  listeners.add(onNewImage)
  connect()

  return () => {
    listeners.delete(onNewImage)
    if (listeners.size === 0) {
      closeWebSocket()
    }
  }
}

export function closeWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close()
  ws = null
}