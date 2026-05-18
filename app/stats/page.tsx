"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Round {
  id: string;
  date: string;       // ISO string
  course: string;
  score: number;
  par: number;
  putts: number;
  handicap: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_ROUNDS: Round[] = [
  { id: "1",  date: "2026-03-02", course: "Whitnall Park",      score: 94, par: 72, putts: 36, handicap: 22.4 },
  { id: "2",  date: "2026-03-15", course: "Brown Deer Park",    score: 91, par: 71, putts: 34, handicap: 21.8 },
  { id: "3",  date: "2026-04-01", course: "Oakwood Park",       score: 96, par: 72, putts: 37, handicap: 22.1 },
  { id: "4",  date: "2026-04-18", course: "Dretzka Park",       score: 89, par: 72, putts: 33, handicap: 21.3 },
  { id: "5",  date: "2026-05-03", course: "Whitnall Park",      score: 92, par: 72, putts: 35, handicap: 21.0 },
  { id: "6",  date: "2026-05-20", course: "Brown Deer Park",    score: 88, par: 71, putts: 32, handicap: 20.4 },
  { id: "7",  date: "2026-06-05", course: "Tuckaway CC",        score: 90, par: 72, putts: 34, handicap: 20.1 },
  { id: "8",  date: "2026-06-22", course: "Oakwood Park",       score: 86, par: 72, putts: 31, handicap: 19.6 },
  { id: "9",  date: "2026-07-04", course: "Dretzka Park",       score: 87, par: 72, putts: 33, handicap: 19.2 },
  { id: "10", date: "2026-07-19", course: "Whitnall Park",      score: 85, par: 72, putts: 30, handicap: 18.8 },
  { id: "11", date: "2026-08-02", course: "Brown Deer Park",    score: 83, par: 71, putts: 29, handicap: 18.2 },
  { id: "12", date: "2026-08-17", course: "Tuckaway CC",        score: 88, par: 72, putts: 32, handicap: 18.0 },
  { id: "13", date: "2026-09-01", course: "Oakwood Park",       score: 84, par: 72, putts: 30, handicap: 17.6 },
  { id: "14", date: "2026-09-14", course: "Dretzka Park",       score: 82, par: 72, putts: 29, handicap: 17.1 },
  { id: "15", date: "2026-10-01", course: "Whitnall Park",      score: 81, par: 72, putts: 28, handicap: 16.8 },
  { id: "16", date: "2026-10-18", course: "Brown Deer Park",    score: 85, par: 71, putts: 31, handicap: 16.5 },
  { id: "17", date: "2026-11-02", course: "Tuckaway CC",        score: 80, par: 72, putts: 27, handicap: 16.1 },
  { id: "18", date: "2025-03-22", course: "Whitnall Park",      score: 83, par: 72, putts: 30, handicap: 15.8 },
  { id: "19", date: "2025-04-05", course: "Oakwood Park",       score: 79, par: 72, putts: 28, handicap: 15.3 },
  { id: "20", date: "2025-04-20", course: "Brown Deer Park",    score: 78, par: 71, putts: 27, handicap: 14.9 },
];

// ─── Filter Config ────────────────────────────────────────────────────────────

type RoundFilter = "last5" | "last10" | "last20" | "30d" | "90d" | "thisYear";

const ROUND_FILTERS: { key: RoundFilter; label: string }[] = [
  { key: "last5",    label: "Last 5"    },
  { key: "last10",   label: "Last 10"   },
  { key: "last20",   label: "Last 20"   },
  { key: "30d",      label: "30 Days"   },
  { key: "90d",      label: "90 Days"   },
  { key: "thisYear", label: "This Year" },
];

function applyFilter(rounds: Round[], filter: RoundFilter): Round[] {
  const sorted = [...rounds].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const now = new Date();

  switch (filter) {
    case "last5":    return sorted.slice(-5);
    case "last10":   return sorted.slice(-10);
    case "last20":   return sorted.slice(-20);
    case "30d":      return sorted.filter(r => (now.getTime() - new Date(r.date).getTime()) <= 30 * 86400000);
    case "90d":      return sorted.filter(r => (now.getTime() - new Date(r.date).getTime()) <= 90 * 86400000);
    case "thisYear": return sorted.filter(r => new Date(r.date).getFullYear() === now.getFullYear());
    default:         return sorted;
  }
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  delay = 0,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delay?: number;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-2xl border p-5 flex flex-col gap-1 ${
        highlight
          ? "border-[#c9a84c]/40 bg-[#c9a84c]/5"
          : "border-white/8 bg-white/3"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${highlight ? "text-[#c9a84c]" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  prefix = "",
}: {
  active?: boolean;
  payload?: { value: number; color: string }[];
  label?: string;
  unit?: string;
  prefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#111] px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-bold" style={{ color: payload[0].color }}>
        {prefix}{payload[0].value}{unit}
      </p>
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-white/8 bg-white/3 p-6"
    >
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#c9a84c] font-semibold mb-0.5">
          {subtitle}
        </p>
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [filter, setFilter] = useState<RoundFilter>("last10");

  const filtered = useMemo(() => applyFilter(SEED_ROUNDS, filter), [filter]);

  // ── Derived stats ──
  const scores      = filtered.map((r) => r.score);
  const putts       = filtered.map((r) => r.putts);
  const toPars      = filtered.map((r) => r.score - r.par);
  const avgScore    = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "--";
  const bestScore   = scores.length ? Math.min(...scores) : "--";
  const avgPutts    = putts.length  ? (putts.reduce((a, b) => a + b, 0)  / putts.length).toFixed(1)  : "--";
  const bestPutts   = putts.length  ? Math.min(...putts) : "--";
  const latestHcp   = filtered.length ? filtered[filtered.length - 1].handicap.toFixed(1) : "--";
  const hcpChange   = filtered.length >= 2
    ? (filtered[filtered.length - 1].handicap - filtered[0].handicap).toFixed(1)
    : null;

  // ── Chart data ──
  const chartData = filtered.map((r) => ({
    date:      fmt(r.date),
    score:     r.score,
    toPar:     r.score - r.par,
    putts:     r.putts,
    handicap:  r.handicap,
  }));

  const avgScoreNum = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-28 pb-24">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">
            Performance
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Stats</h1>
          <p className="text-sm text-white/30 mt-1.5">
            {filtered.length} rounds in view
          </p>
        </motion.div>

        {/* Filter pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {ROUND_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                filter === f.key
                  ? "bg-[#c9a84c] text-black"
                  : "border border-white/10 text-white/40 hover:text-white hover:border-white/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard
            label="Avg Score"
            value={avgScore}
            sub="strokes per round"
            delay={0.1}
          />
          <StatCard
            label="Best Round"
            value={bestScore}
            sub="lowest score"
            delay={0.15}
            highlight
          />
          <StatCard
            label="Handicap"
            value={latestHcp}
            sub={
              hcpChange !== null
                ? Number(hcpChange) < 0
                  ? `↓ ${Math.abs(Number(hcpChange))} this period`
                  : Number(hcpChange) > 0
                  ? `↑ ${hcpChange} this period`
                  : "No change"
                : undefined
            }
            delay={0.2}
          />
          <StatCard
            label="Avg Putts"
            value={avgPutts}
            sub="per round"
            delay={0.25}
          />
          <StatCard
            label="Best Putts"
            value={bestPutts}
            sub="fewest in a round"
            delay={0.3}
          />
          <StatCard
            label="Rounds"
            value={filtered.length}
            sub="in selected period"
            delay={0.35}
          />
        </div>

        {/* Score trend chart */}
        <div className="flex flex-col gap-5">
          <ChartCard
            title="Score Trend"
            subtitle="Scoring"
            delay={0.2}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                {avgScoreNum && (
                  <ReferenceLine
                    y={avgScoreNum}
                    stroke="rgba(201,168,76,0.3)"
                    strokeDasharray="4 4"
                    label={{
                      value: "avg",
                      fill: "rgba(201,168,76,0.5)",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                <Tooltip content={<ChartTooltip unit=" strokes" />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#c9a84c", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#c9a84c", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Score to par chart */}
          <ChartCard
            title="Score vs Par"
            subtitle="Scoring"
            delay={0.25}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={0}
                  stroke="rgba(255,255,255,0.15)"
                  label={{
                    value: "E",
                    fill: "rgba(255,255,255,0.2)",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Tooltip content={<ChartTooltip prefix="+" unit=" vs par" />} />
                <Line
                  type="monotone"
                  dataKey="toPar"
                  stroke="#7dd3a8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7dd3a8", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#7dd3a8", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Putts chart */}
          <ChartCard
            title="Putts Per Round"
            subtitle="Putting"
            delay={0.3}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={30}
                  stroke="rgba(201,168,76,0.25)"
                  strokeDasharray="4 4"
                  label={{
                    value: "30 putts",
                    fill: "rgba(201,168,76,0.4)",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Tooltip content={<ChartTooltip unit=" putts" />} />
                <Line
                  type="monotone"
                  dataKey="putts"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Handicap chart */}
          <ChartCard
            title="Handicap Trend"
            subtitle="Index"
            delay={0.35}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="handicap"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#c9a84c", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#c9a84c", strokeWidth: 0 }}
                  strokeDasharray="0"
                />
              </LineChart>
            </ResponsiveContainer>
            {hcpChange !== null && (
              <p className={`text-xs mt-3 font-semibold ${Number(hcpChange) < 0 ? "text-emerald-400" : "text-red-400"}`}>
                {Number(hcpChange) < 0
                  ? `↓ Improved by ${Math.abs(Number(hcpChange))} strokes this period`
                  : `↑ Up ${hcpChange} strokes this period`}
              </p>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}