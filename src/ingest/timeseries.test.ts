import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { describe, expect, it } from "vitest"
import { deriveTimeSeriesActivity } from "./timeseries"
import { getStorageRoots } from "./session"

function mkStorageRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omo-storage-"))
  fs.mkdirSync(path.join(root, "session"), { recursive: true })
  fs.mkdirSync(path.join(root, "message"), { recursive: true })
  fs.mkdirSync(path.join(root, "part"), { recursive: true })
  return root
}

function writeMessageMeta(opts: {
  messageDir: string
  messageId: string
  meta: Record<string, unknown>
}): void {
  fs.mkdirSync(opts.messageDir, { recursive: true })
  fs.writeFileSync(
    path.join(opts.messageDir, `${opts.messageId}.json`),
    JSON.stringify({ id: opts.messageId, sessionID: "", role: "assistant", ...opts.meta }),
    "utf8"
  )
}

function writePartJson(opts: { partDir: string; fileName: string; value: unknown }): void {
  fs.mkdirSync(opts.partDir, { recursive: true })
  fs.writeFileSync(path.join(opts.partDir, opts.fileName), JSON.stringify(opts.value), "utf8")
}

function writeMalformedPart(opts: { partDir: string; fileName: string; value: string }): void {
  fs.mkdirSync(opts.partDir, { recursive: true })
  fs.writeFileSync(path.join(opts.partDir, opts.fileName), opts.value, "utf8")
}

function getSeries(result: ReturnType<typeof deriveTimeSeriesActivity>, id: string) {
  const match = result.series.find((series) => series.id === id)
  expect(match).toBeDefined()
  return match!
}

describe("deriveTimeSeriesActivity", () => {
  it("returns fixed series metadata and zero-filled arrays when no session exists", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)

    // #given
    const nowMs = 173_456

    // #when
    const result = deriveTimeSeriesActivity({ storage, mainSessionId: null, nowMs })

    // #then
    expect(result.windowMs).toBe(300_000)
    expect(result.bucketMs).toBe(2_000)
    expect(result.buckets).toBe(150)
    expect(result.serverNowMs).toBe(nowMs)
    expect(result.anchorMs).toBe(Math.floor(nowMs / 2_000) * 2_000)

    expect(result.series.map((series) => series.id)).toEqual([
      "overall-main",
      "agent:sisyphus",
      "agent:prometheus",
      "agent:atlas",
      "background-total",
    ])
    expect(result.series.map((series) => series.label)).toEqual([
      "Overall",
      "Sisyphus",
      "Prometheus",
      "Atlas",
      "Background tasks (total)",
    ])
    expect(result.series.map((series) => series.tone)).toEqual([
      "muted",
      "teal",
      "red",
      "green",
      "muted",
    ])

    for (const series of result.series) {
      expect(series.values.length).toBe(result.buckets)
      expect(series.values.every((value) => value === 0)).toBe(true)
    }
  })

  it("buckets tool parts by message time and canonical agent mapping", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)
    const mainSessionId = "ses_main"
    const messageDir = path.join(storage.message, mainSessionId)

    // #given
    writeMessageMeta({
      messageDir,
      messageId: "msg_a",
      meta: { sessionID: mainSessionId, agent: "Sisyphus v2", time: { created: 0 } },
    })
    const partDirA = path.join(storage.part, "msg_a")
    writePartJson({
      partDir: partDirA,
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: partDirA,
      fileName: "part_2.json",
      value: { type: "tool", tool: "grep", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: partDirA,
      fileName: "part_3.json",
      value: { type: "text" },
    })
    writeMalformedPart({ partDir: partDirA, fileName: "part_4.json", value: "{not json" })

    writeMessageMeta({
      messageDir,
      messageId: "msg_b",
      meta: { sessionID: mainSessionId, agent: "PROMETHEUS", time: { created: 1_999 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_b"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_c",
      meta: { sessionID: mainSessionId, agent: "Atlas", time: { created: 2_000 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_c"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_d",
      meta: { sessionID: mainSessionId, agent: "unknown", time: { created: 8_000 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_d"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_e",
      meta: { sessionID: mainSessionId, agent: "Sisyphus", time: { created: 9_999 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_e"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_f",
      meta: { sessionID: mainSessionId, agent: "Sisyphus", time: { created: 10_000 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_f"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_g",
      meta: { sessionID: mainSessionId, agent: "Sisyphus", time: { created: -1 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_g"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    writeMessageMeta({
      messageDir,
      messageId: "msg_invalid",
      meta: { sessionID: mainSessionId, agent: "Sisyphus", time: { created: "bad" } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_invalid"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    // #when
    const result = deriveTimeSeriesActivity({
      storage,
      mainSessionId,
      nowMs: 10_000,
      windowMs: 10_000,
      bucketMs: 2_000,
    })

    // #then
    expect(result.anchorMs).toBe(10_000)
    expect(result.buckets).toBe(5)

    const overall = getSeries(result, "overall-main")
    const sisyphus = getSeries(result, "agent:sisyphus")
    const prometheus = getSeries(result, "agent:prometheus")
    const atlas = getSeries(result, "agent:atlas")
    const background = getSeries(result, "background-total")

    expect(overall.values).toEqual([3, 1, 0, 0, 2])
    expect(sisyphus.values).toEqual([2, 0, 0, 0, 1])
    expect(prometheus.values).toEqual([1, 0, 0, 0, 0])
    expect(atlas.values).toEqual([0, 1, 0, 0, 0])
    expect(background.values).toEqual([0, 0, 0, 0, 0])
  })

  it("counts background task tool parts across child sessions", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)
    const mainSessionId = "ses_main"
    const projectID = "proj"
    const sessionDir = path.join(storage.session, projectID)
    fs.mkdirSync(sessionDir, { recursive: true })

    // #given
    fs.writeFileSync(
      path.join(sessionDir, "ses_child_a.json"),
      JSON.stringify({
        id: "ses_child_a",
        projectID,
        directory: "/tmp/project",
        title: "Background: A",
        parentID: mainSessionId,
        time: { created: 1000, updated: 1000 },
      }),
      "utf8"
    )
    fs.writeFileSync(
      path.join(sessionDir, "ses_child_b.json"),
      JSON.stringify({
        id: "ses_child_b",
        projectID,
        directory: "/tmp/project",
        title: "Background: B",
        parentID: mainSessionId,
        time: { created: 2000, updated: 2000 },
      }),
      "utf8"
    )

    const childADir = path.join(storage.message, "ses_child_a")
    writeMessageMeta({
      messageDir: childADir,
      messageId: "msg_child_a",
      meta: { sessionID: "ses_child_a", time: { created: 4_000 } },
    })
    const childAParts = path.join(storage.part, "msg_child_a")
    writePartJson({
      partDir: childAParts,
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: childAParts,
      fileName: "part_2.json",
      value: { type: "tool", tool: "grep", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: childAParts,
      fileName: "part_3.json",
      value: { type: "text" },
    })

    const childBDir = path.join(storage.message, "ses_child_b")
    writeMessageMeta({
      messageDir: childBDir,
      messageId: "msg_child_b",
      meta: { sessionID: "ses_child_b", time: { created: 9_999 } },
    })
    const childBParts = path.join(storage.part, "msg_child_b")
    writePartJson({
      partDir: childBParts,
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })
    writeMalformedPart({ partDir: childBParts, fileName: "part_2.json", value: "{bad json" })

    // #when
    const result = deriveTimeSeriesActivity({
      storage,
      mainSessionId,
      nowMs: 10_000,
      windowMs: 10_000,
      bucketMs: 2_000,
    })

    // #then
    const background = getSeries(result, "background-total")
    expect(background.values).toEqual([0, 0, 2, 0, 1])
  })

  it("attributes child session tool parts to overall and background series", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)
    const mainSessionId = "ses_main"
    const projectID = "proj"
    const sessionDir = path.join(storage.session, projectID)
    fs.mkdirSync(sessionDir, { recursive: true })

    // #given
    writeMessageMeta({
      messageDir: path.join(storage.message, mainSessionId),
      messageId: "msg_main",
      meta: { sessionID: mainSessionId, agent: "Atlas", time: { created: 1_000 } },
    })
    writePartJson({
      partDir: path.join(storage.part, "msg_main"),
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })

    fs.writeFileSync(
      path.join(sessionDir, "ses_child_a.json"),
      JSON.stringify({
        id: "ses_child_a",
        projectID,
        directory: "/tmp/project",
        title: "Background: A",
        parentID: mainSessionId,
        time: { created: 1000, updated: 1000 },
      }),
      "utf8"
    )

    const childDir = path.join(storage.message, "ses_child_a")
    writeMessageMeta({
      messageDir: childDir,
      messageId: "msg_child_a",
      meta: { sessionID: "ses_child_a", agent: "sisyphus-junior", time: { created: 4_000 } },
    })
    const childParts = path.join(storage.part, "msg_child_a")
    writePartJson({
      partDir: childParts,
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: childParts,
      fileName: "part_2.json",
      value: { type: "tool", tool: "grep", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: childParts,
      fileName: "part_3.json",
      value: { type: "text" },
    })

    // #when
    const result = deriveTimeSeriesActivity({
      storage,
      mainSessionId,
      nowMs: 10_000,
      windowMs: 10_000,
      bucketMs: 2_000,
    })

    // #then
    const overall = getSeries(result, "overall-main")
    const sisyphus = getSeries(result, "agent:sisyphus")
    const atlas = getSeries(result, "agent:atlas")
    const background = getSeries(result, "background-total")

    expect(overall.values).toEqual([1, 0, 2, 0, 0])
    expect(sisyphus.values).toEqual([0, 0, 0, 0, 0])
    expect(atlas.values).toEqual([1, 0, 0, 0, 0])
    expect(background.values).toEqual([0, 0, 2, 0, 0])
  })

  it("does not attribute child session tool parts to the Sisyphus series", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)
    const mainSessionId = "ses_main"
    const projectID = "proj"
    const sessionDir = path.join(storage.session, projectID)
    fs.mkdirSync(sessionDir, { recursive: true })

    // #given
    fs.writeFileSync(
      path.join(sessionDir, "ses_child_a.json"),
      JSON.stringify({
        id: "ses_child_a",
        projectID,
        directory: "/tmp/project",
        title: "Background: A",
        parentID: mainSessionId,
        time: { created: 1000, updated: 1000 },
      }),
      "utf8"
    )

    const childDir = path.join(storage.message, "ses_child_a")
    writeMessageMeta({
      messageDir: childDir,
      messageId: "msg_child_a",
      meta: { sessionID: "ses_child_a", agent: "sisyphus-junior", time: { created: 4_000 } },
    })
    const childParts = path.join(storage.part, "msg_child_a")
    writePartJson({
      partDir: childParts,
      fileName: "part_1.json",
      value: { type: "tool", tool: "read", state: { status: "completed", input: {} } },
    })
    writePartJson({
      partDir: childParts,
      fileName: "part_2.json",
      value: { type: "tool", tool: "grep", state: { status: "completed", input: {} } },
    })

    // #when
    const result = deriveTimeSeriesActivity({
      storage,
      mainSessionId,
      nowMs: 10_000,
      windowMs: 10_000,
      bucketMs: 2_000,
    })

    // #then
    const sisyphus = getSeries(result, "agent:sisyphus")
    expect(sisyphus.values).toEqual([0, 0, 0, 0, 0])
  })

  it("does not attribute child session activity to Prometheus/Atlas series", () => {
    const storageRoot = mkStorageRoot()
    const storage = getStorageRoots(storageRoot)
    const mainSessionId = "ses_main"
    const childSessionId = "ses_child_a"

    // #given
    const projectID = "proj"
    const sessionDir = path.join(storage.session, projectID)
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(
      path.join(sessionDir, `${childSessionId}.json`),
      JSON.stringify({
        id: childSessionId,
        projectID,
        directory: "/tmp/project",
        title: "Background: A",
        parentID: mainSessionId,
        time: { created: 1000, updated: 9000 },
      }),
      "utf8"
    )

    const childMessageDir = path.join(storage.message, childSessionId)
    writeMessageMeta({
      messageDir: childMessageDir,
      messageId: "msg_child_a",
      meta: { sessionID: childSessionId, agent: "Atlas", time: { created: 4_000 } },
    })
    const childParts = path.join(storage.part, "msg_child_a")
    writePartJson({
      partDir: childParts,
      fileName: "part_1.json",
      value: { type: "tool", tool: "grep", state: { status: "completed", input: {} } },
    })

    // #when
    const result = deriveTimeSeriesActivity({
      storage,
      mainSessionId,
      nowMs: 10_000,
      windowMs: 10_000,
      bucketMs: 1_000,
    })

    // #then
    const prometheus = getSeries(result, "agent:prometheus")
    const atlas = getSeries(result, "agent:atlas")
    expect(prometheus.values.every((v) => v === 0)).toBe(true)
    expect(atlas.values.every((v) => v === 0)).toBe(true)
  })
})
