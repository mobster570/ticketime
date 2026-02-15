import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { SyncResult } from "@/types/server";
import { getSyncHistory } from "@/lib/commands";

type TimeRange = "1h" | "24h" | "7d" | "all";

interface OffsetTrendChartProps {
  syncHistory: SyncResult[];
  serverId: number;
}

function computeSinceISO(range: TimeRange): string | undefined {
  if (range === "all") return undefined;
  const now = Date.now();
  const ms: Record<Exclude<TimeRange, "all">, number> = {
    "1h": 3600000,
    "24h": 86400000,
    "7d": 604800000,
  };
  return new Date(now - ms[range]).toISOString();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All" },
];

export function OffsetTrendChart({
  syncHistory: initialHistory,
  serverId,
}: OffsetTrendChartProps) {
  const [range, setRange] = useState<TimeRange>("24h");
  const [filteredHistory, setFilteredHistory] =
    useState<SyncResult[]>(initialHistory);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const since = computeSinceISO(range);
    if (!since && range === "all") {
      setFilteredHistory(initialHistory);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getSyncHistory(serverId, { since })
      .then((results) => {
        if (!cancelled) setFilteredHistory(results);
      })
      .catch(() => {
        if (!cancelled) setFilteredHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, serverId, initialHistory]);

  const chartData = useMemo(
    () =>
      filteredHistory.map((r) => ({
        time: new Date(r.synced_at).getTime(),
        offset: r.total_offset_ms,
      })),
    [filteredHistory],
  );

  const xTickFormatter = (ts: number) =>
    range === "7d" || range === "all" ? formatDate(ts) : formatTime(ts);

  if (filteredHistory.length === 0 && !loading) {
    return (
      <Card className="h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            Offset Trend
          </h3>
          <RangeSelector range={range} onChange={setRange} />
        </div>
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Sync history will appear here
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
          Offset Trend
        </h3>
        <RangeSelector range={range} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Loading...
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <defs>
              <linearGradient id="offsetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-accent)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-accent)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="time"
              tickFormatter={xTickFormatter}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
              stroke="var(--color-border)"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
              stroke="var(--color-border)"
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
              label={{
                value: "ms",
                position: "insideTopLeft",
                offset: -4,
                style: {
                  fontSize: 10,
                  fill: "var(--color-text-secondary)",
                },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(ts) => {
                const d = new Date(Number(ts));
                return d.toLocaleString();
              }}
              formatter={(value: number | undefined) => [
                `${Number(value).toFixed(3)} ms`,
                "Offset",
              ]}
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-border)"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="offset"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-accent)" }}
              activeDot={{ r: 5, fill: "var(--color-accent)" }}
              fill="url(#offsetGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      )}

    </Card>
  );
}

function RangeSelector({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--color-bg-primary)] p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
            range === opt.value
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
