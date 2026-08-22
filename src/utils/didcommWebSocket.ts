import type { Server } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer } from 'ws'
import { DIDCOMM_WS_PATH } from '../agent.js'
import type { ReadinessGate } from './readiness.js'

export function registerDidCommWebSocketUpgrade(
  httpServer: Server,
  wsServer: WebSocketServer,
  readinessGate?: ReadinessGate
): void {
  httpServer.on('upgrade', (request, socket, head) => {
    if (readinessGate && !readinessGate.isReady()) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname !== DIDCOMM_WS_PATH && pathname !== `${DIDCOMM_WS_PATH}/`) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    wsServer.handleUpgrade(request, socket as Socket, head, (ws) => wsServer.emit('connection', ws, request))
  })
}

export function terminateDidCommWebSocketClients(wsServer: WebSocketServer | undefined): void {
  wsServer?.clients.forEach((ws) => ws.terminate())
}
