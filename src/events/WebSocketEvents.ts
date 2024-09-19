import WebSocket from 'ws'

export const sendWebSocketEvent = async (server: WebSocket.Server, data: unknown) => {
  server.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const stringData = typeof data === 'string' ? data : JSON.stringify(data)
      client.send(stringData)
    }
  })
}
