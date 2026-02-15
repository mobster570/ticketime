import { Card } from "@/components/ui/Card";
import type { LatencyProfile } from "@/types/server";

interface RttBoxPlotProps {
  latencyProfile?: LatencyProfile;
}

const SVG_WIDTH = 500;
const SVG_HEIGHT = 140;
const MARGIN = { top: 30, right: 40, bottom: 35, left: 40 };
const PLOT_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const CENTER_Y = MARGIN.top + 35;
const BOX_HALF = 22;

/** Map a data value to an x-coordinate inside the plot area. */
function toX(value: number, dMin: number, dMax: number): number {
  if (dMax === dMin) return MARGIN.left + PLOT_WIDTH / 2;
  return MARGIN.left + ((value - dMin) / (dMax - dMin)) * PLOT_WIDTH;
}

/** Generate "nice" evenly-spaced tick values that cover the data range. */
function niceAxisTicks(dMin: number, dMax: number, count = 6): number[] {
  const rawStep = (dMax - dMin) / (count - 1);
  // Round step to a "nice" number (0.5, 1, 2, 5, …)
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  const niceStep =
    residual <= 1.5 ? mag : residual <= 3 ? 2 * mag : residual <= 7 ? 5 * mag : 10 * mag;

  const start = Math.floor(dMin / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= dMax + niceStep * 0.01; v += niceStep) {
    ticks.push(parseFloat(v.toFixed(6)));
  }
  return ticks;
}

export function RttBoxPlot({ latencyProfile }: RttBoxPlotProps) {
  if (!latencyProfile) {
    return (
      <Card className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            RTT Distribution (ms)
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[180px] rounded-xl border-2 border-dashed border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Sync to see RTT distribution
          </span>
        </div>
      </Card>
    );
  }

  // Backend stores RTT in seconds — convert to milliseconds for display
  const min = latencyProfile.min * 1000;
  const q1 = latencyProfile.q1 * 1000;
  const median = latencyProfile.median * 1000;
  const q3 = latencyProfile.q3 * 1000;
  const max = latencyProfile.max * 1000;

  // Add 10 % breathing room so whisker ends don't touch the edges
  const range = max - min || 1;
  const displayMin = min - range * 0.1;
  const displayMax = max + range * 0.1;

  const xMin = toX(min, displayMin, displayMax);
  const xQ1 = toX(q1, displayMin, displayMax);
  const xMedian = toX(median, displayMin, displayMax);
  const xQ3 = toX(q3, displayMin, displayMax);
  const xMax = toX(max, displayMin, displayMax);

  const ticks = niceAxisTicks(displayMin, displayMax);
  const axisY = CENTER_Y + BOX_HALF + 20;

  return (
    <Card className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
          RTT Distribution (ms)
        </h3>
      </div>

      {/* ── Box-plot SVG ───────────────────────────────── */}
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="overflow-visible"
      >
        {/* Subtle horizontal baseline */}
        <line
          x1={MARGIN.left}
          y1={CENTER_Y}
          x2={SVG_WIDTH - MARGIN.right}
          y2={CENTER_Y}
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.5}
        />

        {/* ── Left whisker ── */}
        <line
          x1={xMin} y1={CENTER_Y}
          x2={xQ1} y2={CENTER_Y}
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
        />
        {/* Min cap */}
        <line
          x1={xMin} y1={CENTER_Y - 10}
          x2={xMin} y2={CENTER_Y + 10}
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
        />

        {/* ── Right whisker ── */}
        <line
          x1={xQ3} y1={CENTER_Y}
          x2={xMax} y2={CENTER_Y}
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
        />
        {/* Max cap */}
        <line
          x1={xMax} y1={CENTER_Y - 10}
          x2={xMax} y2={CENTER_Y + 10}
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
        />

        {/* ── IQR box ── */}
        <rect
          x={xQ1}
          y={CENTER_Y - BOX_HALF}
          width={Math.max(xQ3 - xQ1, 4)}
          height={BOX_HALF * 2}
          rx={3}
          fill="var(--color-accent)"
          fillOpacity={0.2}
          stroke="var(--color-accent)"
          strokeWidth={2}
        />

        {/* ── Median line ── */}
        <line
          x1={xMedian} y1={CENTER_Y - BOX_HALF}
          x2={xMedian} y2={CENTER_Y + BOX_HALF}
          stroke="var(--color-accent)"
          strokeWidth={2}
        />

        {/* ── Median label ── */}
        <text
          x={xMedian}
          y={CENTER_Y - BOX_HALF - 10}
          textAnchor="middle"
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={600}
          fill="var(--color-text-primary)"
        >
          {median.toFixed(1)}ms (Median)
        </text>

        {/* ── Axis ticks & labels ── */}
        {ticks.map((tick, i) => {
          const x = toX(tick, displayMin, displayMax);
          return (
            <g key={i}>
              <line
                x1={x} y1={axisY - 4}
                x2={x} y2={axisY}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={axisY + 12}
                textAnchor="middle"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fill="var(--color-text-secondary)"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Footer ─────────────────────────────────────── */}
      <p className="text-xs text-[var(--color-text-secondary)] mt-4 text-center italic">
        Network round-trip latency used to compensate delay during time synchronization.
      </p>
    </Card>
  );
}
