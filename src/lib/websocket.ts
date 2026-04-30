// src/lib/websocket.ts


let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function initWebSocket(onNewImage: (img: any) => void) {
  // Clear any existing reconnect timer
  if (reconnectTimer) clearTimeout(reconnectTimer)

  try {
    ws = new WebSocket('ws://localhost:3001/ws/events')

    ws.onopen = () => {
      console.log('[WS] Connected to SOC event stream')
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'new_image') {
          onNewImage(msg.payload)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected — reconnecting in 3s')
      reconnectTimer = setTimeout(() => initWebSocket(onNewImage), 3000)
    }

    ws.onerror = () => {
      ws?.close()
    }
  } catch {
    reconnectTimer = setTimeout(() => initWebSocket(onNewImage), 3000)
  }
}

export function closeWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  ws?.close()
}