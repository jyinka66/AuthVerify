import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { Server, type Socket } from 'socket.io'

// ---------------------------------------------------------------------------
// Community counterfeit alert service.
//
// Two servers in one process:
//   Port 3003 — socket.io (path: '/') for browser clients connecting via
//               the Caddy gateway with io('/?XTransformPort=3003').
//   Port 3004 — plain HTTP for internal server-to-server /broadcast calls
//               from the Next.js /api/community/report route.
//
// Socket.io with path: '/' intercepts HTTP requests on its port, so the
// broadcast endpoint runs on a separate port to avoid the conflict.
// ---------------------------------------------------------------------------

const IO_PORT = 3003
const HTTP_PORT = 3004

interface AlertPayload {
  id: string
  brand: string
  productName?: string
  region?: string
  details?: string
  createdAt: string
}

interface BroadcastBody {
  region?: string
  brand: string
  productName?: string
  details?: string
}

// ---------------------------------------------------------------------------
// 1. HTTP server (port 3004) — internal broadcast endpoint
// ---------------------------------------------------------------------------

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as BroadcastBody
        if (!parsed.brand?.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'brand is required' }))
          return
        }
        const payload: AlertPayload = {
          id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          brand: parsed.brand.trim(),
          productName: parsed.productName,
          region: parsed.region,
          details: parsed.details,
          createdAt: new Date().toISOString(),
        }

        // Emit to the region room (if region provided) and to the global room.
        if (parsed.region) {
          io.to(`region:${parsed.region}`).emit('counterfeit-alert', payload)
        }
        io.to('global').emit('counterfeit-alert', payload)

        console.log(`[community-alert] broadcast: ${payload.brand} in ${payload.region ?? 'global'}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, id: payload.id }))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      ioPort: IO_PORT,
      httpPort: HTTP_PORT,
      connections: io.engine.clientsCount,
    }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

httpServer.listen(HTTP_PORT, () => {
  console.log(`[community-alert] HTTP broadcast endpoint on port ${HTTP_PORT}`)
})

// ---------------------------------------------------------------------------
// 2. Socket.io server (port 3003) — browser clients via the gateway
// ---------------------------------------------------------------------------

const ioServer = createServer()
const io = new Server(ioServer, {
  // DO NOT change the path — Caddy uses it to forward to the correct port.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket: Socket) => {
  console.log(`[community-alert] client connected: ${socket.id}`)

  // Every client joins the global room so they receive all alerts.
  socket.join('global')

  // Client sends their region on connect to join a region-scoped room.
  socket.on('join-region', (region: string) => {
    if (typeof region === 'string' && region.trim()) {
      socket.join(`region:${region.trim()}`)
      console.log(`[community-alert] ${socket.id} joined region: ${region}`)
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`[community-alert] client disconnected: ${socket.id} (${reason})`)
  })

  socket.on('error', (error) => {
    console.error(`[community-alert] socket error (${socket.id}):`, error)
  })
})

ioServer.listen(IO_PORT, () => {
  console.log(`[community-alert] socket.io on port ${IO_PORT} (gateway path: /)`)
})

// Graceful shutdown.
const shutdown = (signal: string) => {
  console.log(`[community-alert] received ${signal}, shutting down…`)
  io.close(() => {
    ioServer.close(() => {
      httpServer.close(() => {
        console.log('[community-alert] closed')
        process.exit(0)
      })
    })
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
