import type { NextFunction, Request, Response } from 'express'

/** Gates the shared public protocol app: returns 503 for every request until bootstrap completes. */
export class ReadinessGate {
  private ready = false

  public readonly middleware = (_req: Request, res: Response, next: NextFunction) => {
    if (!this.ready) {
      res.status(503).json({ error: 'service_unavailable', message: 'Server is still starting up' })
      return
    }

    next()
  }

  public markReady(): void {
    this.ready = true
  }

  public isReady(): boolean {
    return this.ready
  }
}
