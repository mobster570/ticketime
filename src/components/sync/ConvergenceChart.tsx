import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown } from "lucide-react";

interface DataPoint {
  iteration: number;
  width: number;
}

interface ConvergenceChartProps {
  data: DataPoint[];
}

export function ConvergenceChart({ data }: ConvergenceChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="bg-[var(--color-bg-deep)] p-6 rounded-xl border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
          <TrendingDown className="h-4 w-4 text-[var(--color-accent)]" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Convergence
        </h3>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="iteration"
              tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
              stroke="var(--color-border)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
              stroke="var(--color-border)"
              label={{
                value: "ms",
                angle: -90,
                position: "insideLeft",
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
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-text-primary)",
              }}
              formatter={(value) => [`${Number(value).toFixed(2)} ms`, "Width"]}
            />
            <Line
              type="monotone"
              dataKey="width"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
