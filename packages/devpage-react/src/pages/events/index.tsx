import { useCallback, useRef, useState } from "react"
import { useForesight, useForesightEvent } from "@foresightjs/react"
import type {
  ForesightEvent,
  ForesightEventMap,
  CallbackHitType,
  ForesightElementState,
} from "@foresightjs/react"

type EventLogEntry = {
  id: number
  type: ForesightEvent
  timestamp: number
  summary: string
}

const MAX_LOG_ENTRIES = 200

const ELEMENT_EVENTS = [
  "elementRegistered",
  "elementReactivated",
  "elementUnregistered",
  "callbackInvoked",
  "callbackCompleted",
] as const

const MANAGER_EVENTS = ["managerSettingsChanged", "deviceStrategyChanged"] as const

const ALL_EVENTS: ForesightEvent[] = [...ELEMENT_EVENTS, ...MANAGER_EVENTS]

const formatHitType = (hitType: CallbackHitType): string => {
  return hitType.subType ? `${hitType.kind}:${hitType.subType}` : hitType.kind
}

const formatElementName = (state: ForesightElementState): string => {
  return state.name || state.id.slice(0, 8)
}

const summarizeEvent = <K extends ForesightEvent>(type: K, event: ForesightEventMap[K]): string => {
  switch (type) {
    case "elementRegistered": {
      const e = event as ForesightEventMap["elementRegistered"]
      return `"${formatElementName(e.state)}" registered`
    }
    case "elementReactivated": {
      const e = event as ForesightEventMap["elementReactivated"]
      return `"${formatElementName(e.state)}" reactivated`
    }
    case "elementUnregistered": {
      const e = event as ForesightEventMap["elementUnregistered"]
      return `"${formatElementName(e.state)}" unregistered (${e.unregisterReason})`
    }
    case "callbackInvoked": {
      const e = event as ForesightEventMap["callbackInvoked"]
      return `"${formatElementName(e.state)}" callback invoked [${formatHitType(e.hitType)}]`
    }
    case "callbackCompleted": {
      const e = event as ForesightEventMap["callbackCompleted"]
      return `"${formatElementName(e.state)}" callback ${e.status ?? "done"} (${e.elapsed.toFixed(1)}ms) [${formatHitType(e.hitType)}]`
    }
    case "managerSettingsChanged": {
      const e = event as ForesightEventMap["managerSettingsChanged"]
      const changes = e.updatedSettings.map(s => s.setting).join(", ")
      return `settings changed: ${changes}`
    }
    case "deviceStrategyChanged": {
      const e = event as ForesightEventMap["deviceStrategyChanged"]
      return `device strategy: ${e.oldStrategy} -> ${e.newStrategy}`
    }
    default:
      return type
  }
}

const EVENT_COLORS: Record<ForesightEvent, string> = {
  elementRegistered: "text-green-700",
  elementReactivated: "text-blue-700",
  elementUnregistered: "text-red-700",
  elementDataUpdated: "text-gray-600",
  callbackInvoked: "text-amber-700",
  callbackCompleted: "text-purple-700",
  managerSettingsChanged: "text-cyan-700",
  deviceStrategyChanged: "text-teal-700",
}

type EnabledEvents = Record<ForesightEvent, boolean>

const DEFAULT_ENABLED: EnabledEvents = ALL_EVENTS.reduce((acc, e) => {
  acc[e] = true
  return acc
}, {} as EnabledEvents)

const DEMO_ELEMENTS = [
  { name: "fast-callback", label: "Fast callback", color: "bg-green-200", delayMs: 50 },
  { name: "slow-callback", label: "Slow callback", color: "bg-amber-200", delayMs: 1500 },
  { name: "error-callback", label: "Error callback", color: "bg-red-200", delayMs: 0 },
] as const

const DemoElement = ({
  name,
  label,
  color,
  delayMs,
  reactivateAfter,
}: {
  name: string
  label: string
  color: string
  delayMs: number
  reactivateAfter: number
}) => {
  const { elementRef, isPredicted, hitCount, isCallbackRunning, status } =
    useForesight<HTMLDivElement>({
      callback: async () => {
        if (name === "error-callback") {
          throw new Error("Intentional error for demo")
        }
        await new Promise(resolve => setTimeout(resolve, delayMs))
      },
      name,
      hitSlop: 20,
      reactivateAfter,
    })

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={elementRef}
        className={`w-28 h-28 flex items-center justify-center text-xs font-medium text-gray-800 border border-gray-300 cursor-default select-none ${color} ${
          isPredicted ? "outline outline-1 outline-amber-500" : ""
        }`}
      >
        {label}
      </div>
      <div className="font-mono text-[10px] text-gray-500 text-center space-y-0.5">
        <div>
          hits: {hitCount} | {status ?? "idle"}
        </div>
        <div>{isCallbackRunning ? "running..." : isPredicted ? "predicted" : "waiting"}</div>
      </div>
    </div>
  )
}

const ToggleElement = () => {
  const [mounted, setMounted] = useState(true)
  const { elementRef, isPredicted } = useForesight<HTMLDivElement>({
    callback: () => {},
    name: "toggleable",
    hitSlop: 20,
  })

  return (
    <div className="flex flex-col items-center gap-2">
      {mounted && (
        <div
          ref={elementRef}
          className={`w-28 h-28 flex items-center justify-center text-xs font-medium text-gray-800 border border-gray-300 bg-blue-200 cursor-default select-none ${
            isPredicted ? "outline outline-1 outline-amber-500" : ""
          }`}
        >
          Toggleable
        </div>
      )}
      {!mounted && (
        <div className="w-28 h-28 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-300">
          unmounted
        </div>
      )}
      <button
        onClick={() => setMounted(m => !m)}
        className="px-2 py-1 text-[10px] border border-gray-400 text-gray-700 hover:bg-gray-100"
      >
        {mounted ? "Unmount" : "Mount"}
      </button>
    </div>
  )
}

const EventFilterGroup = ({
  label,
  events,
  enabled,
  onToggle,
}: {
  label: string
  events: readonly ForesightEvent[]
  enabled: EnabledEvents
  onToggle: (event: ForesightEvent) => void
}) => (
  <div>
    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {events.map(event => (
        <label key={event} className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled[event]}
            onChange={() => onToggle(event)}
            className="accent-gray-900"
          />
          {event}
        </label>
      ))}
    </div>
  </div>
)

const EventLog = ({ entries }: { entries: EventLogEntry[] }) => {
  const logRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={logRef}
      className="h-[500px] overflow-y-auto font-mono text-[11px] border border-gray-300 bg-white"
    >
      {entries.length === 0 ? (
        <p className="p-4 text-gray-400 text-xs">
          No events yet. Interact with elements on other pages to see events appear here.
        </p>
      ) : (
        entries.map(entry => (
          <div
            key={entry.id}
            className="flex gap-3 px-3 py-1 border-b border-gray-100 hover:bg-gray-50"
          >
            <span className="text-gray-400 shrink-0 w-20 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 w-48 ${EVENT_COLORS[entry.type]}`}>{entry.type}</span>
            <span className="text-gray-700 truncate">{entry.summary}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function Events() {
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [enabled, setEnabled] = useState<EnabledEvents>(DEFAULT_ENABLED)
  const [isPaused, setIsPaused] = useState(false)
  const nextId = useRef(0)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const pushEntry = useCallback((type: ForesightEvent, summary: string, timestamp: number) => {
    if (isPausedRef.current) return
    if (!enabledRef.current[type]) return

    setEntries(prev => {
      const entry: EventLogEntry = { id: nextId.current++, type, timestamp, summary }
      const next = [entry, ...prev]
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next
    })
  }, [])

  // Subscribe to all event types - the filter is applied inside pushEntry
  useForesightEvent("elementRegistered", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("elementReactivated", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("elementUnregistered", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("elementDataUpdated", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), Date.now())
  })
  useForesightEvent("callbackInvoked", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("callbackCompleted", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("managerSettingsChanged", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })
  useForesightEvent("deviceStrategyChanged", e => {
    pushEntry(e.type, summarizeEvent(e.type, e), e.timestamp)
  })

  const toggleEvent = useCallback((event: ForesightEvent) => {
    setEnabled(prev => ({ ...prev, [event]: !prev[event] }))
  }, [])

  const eventCounts = entries.reduce(
    (acc, entry) => {
      acc[entry.type] = (acc[entry.type] ?? 0) + 1
      return acc
    },
    {} as Partial<Record<ForesightEvent, number>>
  )

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPaused(p => !p)}
            className="px-2 py-1 text-xs border border-gray-400 text-gray-800 hover:bg-gray-100"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => setEntries([])}
            className="px-2 py-1 text-xs border border-gray-400 text-gray-800 hover:bg-gray-100"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Live event stream from{" "}
        <code className="text-xs bg-gray-100 px-1 py-0.5">useForesightEvent</code>. Each event type
        below is a separate hook subscription. Hover over the elements below to generate events.
      </p>

      {/* Demo elements */}
      <div className="border border-gray-300 bg-white p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Interactive elements</h2>
        <div className="flex flex-wrap gap-6">
          {DEMO_ELEMENTS.map(el => (
            <DemoElement key={el.name} {...el} reactivateAfter={2000} />
          ))}
          <ToggleElement />
        </div>
      </div>

      {/* Filters */}
      <div className="border border-gray-300 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Filters</h2>
          <span className="text-xs text-gray-400">{entries.length} events logged</span>
        </div>
        <EventFilterGroup
          label="Element"
          events={ELEMENT_EVENTS}
          enabled={enabled}
          onToggle={toggleEvent}
        />
        <EventFilterGroup
          label="Manager"
          events={MANAGER_EVENTS}
          enabled={enabled}
          onToggle={toggleEvent}
        />
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ALL_EVENTS.filter(e => enabled[e]).map(event => (
          <div key={event} className="border border-gray-300 bg-white px-3 py-2">
            <div className="text-[10px] text-gray-500 truncate">{event}</div>
            <div className={`text-lg font-semibold tabular-nums ${EVENT_COLORS[event]}`}>
              {eventCounts[event] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <EventLog entries={entries} />
    </main>
  )
}
