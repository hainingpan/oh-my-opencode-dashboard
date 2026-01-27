import { describe, it, expect } from "vitest"
import { formatBackgroundTaskTimelineCell } from "./App"

describe('formatBackgroundTaskTimelineCell', () => {
  it('should render "-" for queued regardless of timeline', () => {
    // #given: queued status
    const status = "queued"

    // #when/#then
    expect(formatBackgroundTaskTimelineCell(status, "")).toBe("-")
    expect(formatBackgroundTaskTimelineCell(status, "2026-01-01T00:00:00Z: 2m")).toBe("-")
  })

  it('should render blank for unknown regardless of timeline', () => {
    // #given: unknown status
    const status = "unknown"

    // #when/#then
    expect(formatBackgroundTaskTimelineCell(status, "")).toBe("")
    expect(formatBackgroundTaskTimelineCell(status, "2026-01-01T00:00:00Z: 2m")).toBe("")
  })

  it('should render timeline when present, otherwise "-" for other statuses', () => {
    // #given: a non-queued, non-unknown status
    const status = "running"

    // #when/#then
    expect(formatBackgroundTaskTimelineCell(status, "2026-01-01T00:00:00Z: 2m")).toBe("2026-01-01T00:00:00Z: 2m")
    expect(formatBackgroundTaskTimelineCell(status, "")).toBe("-")
    expect(formatBackgroundTaskTimelineCell(status, "   ")).toBe("-")
  })
})
