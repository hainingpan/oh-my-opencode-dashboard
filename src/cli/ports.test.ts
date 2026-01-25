import net from "node:net"
import { describe, expect, it } from "vitest"

import { findAvailablePort } from "./ports"

describe("findAvailablePort", () => {
  it("returns a bindable port", async () => {
    const port = await findAvailablePort({ host: "127.0.0.1", preferredPort: 51234 })

    const server = net.createServer()
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(port, "127.0.0.1", () => resolve())
    })

    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(port).toBeGreaterThan(0)
  })

  it("skips a port that is already in use", async () => {
    const blocker = net.createServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject)
      blocker.listen(0, "127.0.0.1", () => resolve())
    })

    const address = blocker.address()
    if (!address || typeof address === "string") throw new Error("Unexpected address")
    const usedPort = address.port

    const port = await findAvailablePort({
      host: "127.0.0.1",
      preferredPort: usedPort,
      maxTries: 50,
    })

    expect(port).not.toBe(usedPort)
    await new Promise<void>((resolve) => blocker.close(() => resolve()))
  })
})
