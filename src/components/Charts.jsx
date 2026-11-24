import React, { useState, useRef, useEffect } from "react";
import { money } from "../lib";
export function RevenueChart({ data }) {
  const [hover, setHover] = useState(null);
  const chartRef = useRef(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const node = chartRef.current;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(node);
      setWidth(
        Math.max(
          260,
          node.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
        ),
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const labelSize = Math.max(12, Math.min(16, width * 0.005 + 10));
  const labelStep = Math.ceil(
    data.length / Math.max(2, Math.floor((width - 80) / 65)),
  );
  const height = width > 950 ? 300 : 240,
    left = 58,
    right = 15,
    top = 20,
    bottom = 35;
  const max = Math.max(...data.map((d) => d.value), 1000000) * 1.18;
  const x = (i) =>
    left + (i * (width - left - right)) / Math.max(1, data.length - 1);
  const y = (v) => height - bottom - (v / max) * (height - top - bottom);
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `M ${x(0)} ${height - bottom} L ${data.map((d, i) => `${x(i)} ${y(d.value)}`).join(" L ")} L ${x(data.length - 1)} ${height - bottom} Z`;
  return (
    <div className="revenue-chart" ref={chartRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ doanh thu theo ngày"
      >
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#698e61" stopOpacity=".28" />
            <stop offset="100%" stopColor="#698e61" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1={left}
              x2={width - right}
              y1={y((max * i) / 4)}
              y2={y((max * i) / 4)}
              stroke="#e8eae5"
              strokeDasharray="4 5"
            />
            <text
              x={left - 12}
              y={y((max * i) / 4) + 4}
              textAnchor="end"
              fill="#66705e"
              fontSize={labelSize}
            >
              {((max * i) / 4 / 1e6).toFixed(1)}tr
            </text>
          </g>
        ))}
        <path d={area} fill="url(#revenueFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#48764c"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <g key={d.date}>
            <text
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fill="#66705e"
              fontSize={labelSize}
            >
              {i % labelStep === 0 ? d.label : ""}
            </text>
            <rect
              x={x(i) - 22}
              y={top}
              width="44"
              height={height - top - bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {(hover === i || i === data.length - 1) && (
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r="5"
                stroke="white"
                strokeWidth="3"
                fill="#48764c"
              />
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip">
          {data[hover].label} · <strong>{money(data[hover].value)}</strong> ·{" "}
          {data[hover].orders} đơn
        </div>
      )}
    </div>
  );
}
export function Donut({ values, total }) {
  let start = 0;
  const colors = ["#315944", "#b5cd91", "#e8c680", "#cfd6ca"];
  const sum = values.reduce((s, v) => s + v.value, 0) || 1;
  return (
    <div className="donut-layout">
      <div className="donut">
        <svg viewBox="0 0 160 160" role="img" aria-label="Cơ cấu doanh thu">
          <circle
            cx="80"
            cy="80"
            r="61"
            fill="none"
            stroke="#f0f1ec"
            strokeWidth="20"
          />
          {values.map((v, i) => {
            const portion = (v.value / sum) * 383.27;
            const offset = -start;
            start += portion;
            return (
              <circle
                key={v.label}
                cx="80"
                cy="80"
                r="61"
                fill="none"
                stroke={colors[i % 4]}
                strokeWidth="20"
                strokeDasharray={`${Math.max(0, portion - 3)} ${383.27 - Math.max(0, portion - 3)}`}
                strokeDashoffset={offset}
                transform="rotate(-90 80 80)"
              />
            );
          })}
        </svg>
        <div>
          <strong>{total}</strong>
          <span>đơn hàng</span>
        </div>
      </div>
      <div className="donut-legend">
        {values.map((v, i) => (
          <div key={v.label}>
            <i style={{ background: colors[i % 4] }} />
            <span>{v.label}</span>
            <strong>{Math.round((v.value / sum) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
