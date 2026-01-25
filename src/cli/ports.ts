import net from "node:net"

export interface FindAvailablePortOptions {
  host: string
  preferredPort: number
  maxTries?: number
}

export async function findAvailablePort({
  host,
  preferredPort,
  maxTries = 20,
}: FindAvailablePortOptions): Promise<number> {
  if (!Number.isInteger(preferredPort) || preferredPort <= 0) {
    throw new Error("preferredPort must be a positive integer")
  }

  for (let offset = 0; offset < maxTries; offset++) {
    const port = preferredPort + offset
    const ok = await canListen({ host, port })
    if (ok) return port
  }

  throw new Error(
    `No available port found starting at ${preferredPort} after ${maxTries} attempts`,
  )
}

function canListen({ host, port }: { host: string; port: number }): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once("error", () => {
      resolve(false)
    })

    server.once("listening", () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}
