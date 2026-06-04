'use client';

// Plotly is heavy (~700KB minified for the basic bundle) but admin-only,
// so the cost is bounded to a single dashboard route. We import the basic
// distribution (no 3D, no geo) to keep the bundle reasonable.

import { useEffect, useMemo, useState } from 'react';

type PlotlyType = typeof import('react-plotly.js').default;

type Point = { date: string; count: number };

type Props = {
  label: string;
  series: Point[];
  color?: string;
  height?: number;
};

/**
 * Interactive line chart with zoom (drag-select on the plot), pan (shift+drag),
 * hover tooltips, and a download-as-PNG button. Falls back to a static
 * summary on the server / first paint.
 */
export function PlotlyLineChart({
  label,
  series,
  color = 'hsl(204, 56%, 31%)',
  height = 240,
}: Props) {
  const [Plot, setPlot] = useState<PlotlyType | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Plotly's basic dist is hand-loaded so its global Plotly object is
      // bound to react-plotly's createPlotlyComponent factory.
      const Plotly = (await import('plotly.js-basic-dist-min')).default;
      const factory = (await import('react-plotly.js/factory')).default;
      const Component = factory(Plotly);
      if (!cancelled) setPlot(() => Component);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const x = useMemo(() => series.map((p) => p.date), [series]);
  const y = useMemo(() => series.map((p) => p.count), [series]);
  const total = useMemo(() => y.reduce((a, b) => a + b, 0), [y]);

  if (!Plot) {
    // SSR / first-paint placeholder
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {label}
          </div>
          <div className="font-serif text-2xl font-medium leading-none">{total}</div>
        </div>
        <div
          className="mt-3 w-full animate-pulse rounded bg-[hsl(var(--muted))]"
          style={{ height }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}
        </div>
        <div className="font-serif text-2xl font-medium leading-none">{total}</div>
      </div>
      <div className="mt-2">
        <Plot
          data={[
            {
              x,
              y,
              type: 'scatter',
              mode: 'lines+markers',
              line: { color, width: 2, shape: 'spline', smoothing: 0.4 },
              marker: { color, size: 5 },
              hovertemplate: '<b>%{x}</b><br>%{y} ' + label.toLowerCase().split(' ')[0] + '<extra></extra>',
              fill: 'tozeroy',
              fillcolor: hexToRgba(color, 0.08),
            },
          ]}
          layout={{
            autosize: true,
            height,
            margin: { l: 40, r: 10, t: 10, b: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'inherit', size: 11 },
            xaxis: {
              showgrid: false,
              tickfont: { size: 10 },
              type: 'date',
            },
            yaxis: {
              gridcolor: 'rgba(127,127,127,0.15)',
              tickfont: { size: 10 },
              fixedrange: false,
              rangemode: 'tozero',
            },
            dragmode: 'zoom',
            showlegend: false,
          }}
          config={{
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            displaylogo: false,
            responsive: true,
          }}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
}

/** Convert hsl()/hex string to rgba() with given alpha. Best-effort: only
 *  handles our brand hsl(...) literal here; falls back to the input string. */
function hexToRgba(input: string, alpha: number): string {
  const m = input.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
  if (m) {
    const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m2 = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const R = Math.round((r + m2) * 255);
    const G = Math.round((g + m2) * 255);
    const B = Math.round((b + m2) * 255);
    return `rgba(${R},${G},${B},${alpha})`;
  }
  return input;
}
