/**
 * Stats page — performance summary cards and Recharts line charts.
 *
 * Fetches from `GET /api/stats` (Redis-cached, 24 h TTL). The user can filter
 * the dataset by a time/count window (`RoundFilter`) and by hole count (`HolesFilter`).
 * All derived values (averages, best scores, handicap change) are recomputed via
 * `useMemo` whenever the active filter changes.
 *
 * 9-hole normalization: score and putts for 9-hole rounds are doubled in `chartData`
 * so they appear at a comparable scale on 18-hole charts. A "(9H rounds ×2)" note
 * is shown when the filtered set contains any 9-hole rounds.
 *
 * All four charts (`Score Trend`, `Score vs Par`, `Putts Per Round`, `Handicap Trend`)
 * are wrapped in a single `<ErrorBoundary section="Charts">` so a Recharts render
 * crash does not destroy the stat cards above.
 */
"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { StatRound } from "@/app/api/stats/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Round = StatRound;

// ─── Filter Config ────────────────────────────────────────────────────────────

type RoundFilter = "last5" | "last10" | "last20" | "30d" | "90d" | "thisYear";
type HolesFilter = "all" | "9" | "18";

const ROUND_FILTERS: { key: RoundFilter; label: string }[] = [
  { key: "last5",    label: "Last 5"    },
  { key: "last10",   label: "Last 10"   },
  { key: "last20",   label: "Last 20"   },
  { key: "30d",      label: "30 Days"   },
  { key: "90d",      label: "90 Days"   },
  { key: "thisYear", label: "This Year" },
];

const HOLES_FILTERS: { key: HolesFilter; label: string }[] = [
  { key: "all", label: "All"  },
  { key: "18",  label: "18H"  },
  { key: "9",   label: "9H"   },
];

/**
 * Returns a chronologically-sorted subset of rounds matching the given filter.
 * Count-based filters (`last5`, `last10`, `last20`) slice from the end of the
 * sorted array. Date-based filters (`30d`, `90d`, `thisYear`) compare against
 * `Date.now()` at call time so the result is always relative to today.
 */
function applyFilter(rounds: Round[], filter: RoundFilter): Round[] {
  const sorted = [...rounds].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

function StatCard({ label, value, sub, delay = 0, highlight = false }: {
  label: string; value: string | number; sub?: string; delay?: number; highlight?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }}
      className={`rounded-2xl border p-5 flex flex-col gap-1 ${highlight ? "border-[#c9a84c]/40 bg-[#c9a84c]/5" : "border-white/8 bg-white/3"}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${highlight ? "text-[#c9a84c]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = "", prefix = "" }: {
  active?: boolean; payload?: { value: number; color: string }[]; label?: string; unit?: string; prefix?: string;
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

function ChartCard({ title, subtitle, note, children, delay = 0 }: {
  title: string; subtitle?: string; note?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-white/8 bg-white/3 p-6">
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#c9a84c] font-semibold mb-0.5">{subtitle}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-bold text-white">{title}</h3>
          {note && <span className="text-[10px] text-white/25">{note}</span>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [allRounds, setAllRounds]     = useState<Round[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [filter, setFilter]           = useState<RoundFilter>("last10");
  const [holesFilter, setHolesFilter] = useState<HolesFilter>("all");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(({ rounds }) => {
        setAllRounds(rounds);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Stats fetch failed:", err);
        setError(true);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const byTime = applyFilter(allRounds, filter);
    if (holesFilter === "all") return byTime;
    const h = Number(holesFilter) as 9 | 18;
    return byTime.filter((r) => (r.holes ?? 18) === h);
  }, [allRounds, filter, holesFilter]);

  const scores    = filtered.map((r) => r.score);
  const putts     = filtered.map((r) => r.putts);
  const avgScore  = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "--";
  const bestScore = scores.length ? Math.min(...scores) : "--";
  const avgPutts  = putts.length  ? (putts.reduce((a, b) => a + b, 0)  / putts.length).toFixed(1)  : "--";
  const bestPutts = putts.length  ? Math.min(...putts) : "--";
  const latestHcp = filtered.length ? filtered[filtered.length - 1].handicap.toFixed(1) : "--";
  const hcpChange = filtered.length >= 2
    ? (filtered[filtered.length - 1].handicap - filtered[0].handicap).toFixed(1)
    : null;

  const has9H = filtered.some((r) => (r.holes ?? 18) === 9);

  const chartData = filtered.map((r) => {
    const is9 = (r.holes ?? 18) === 9;
    return {
      date:     fmt(r.date),
      score:    is9 ? r.score * 2 : r.score,
      toPar:    r.score - r.par,
      putts:    is9 ? r.putts * 2 : r.putts,
      handicap: r.handicap,
      holes:    r.holes ?? 18,
    };
  });

  const puttRef = 30;

  const avgScoreNum = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-20 sm:pt-28 pb-24">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Performance</p>
          <h1 className="text-4xl font-bold tracking-tight">Stats</h1>
          <p className="text-sm text-white/30 mt-1.5">
            {loading ? "Loading…" : `${filtered.length} rounds in view`}
          </p>
        </motion.div>

        {/* Filter pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col gap-2 mb-8">
          <div className="flex flex-wrap gap-2">
            {ROUND_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  filter === f.key ? "bg-[#c9a84c] text-black" : "border border-white/10 text-white/40 hover:text-white hover:border-white/20"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {HOLES_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setHolesFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  holesFilter === f.key ? "bg-white/15 text-white border border-white/30" : "border border-white/10 text-white/40 hover:text-white hover:border-white/20"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="Avg Score"  value={avgScore}  sub="strokes per round"    delay={0.1} />
          <StatCard label="Best Round" value={bestScore} sub="lowest score"         delay={0.15} highlight />
          <StatCard label="Handicap"   value={latestHcp}
            sub={hcpChange !== null
              ? Number(hcpChange) < 0 ? `↓ ${Math.abs(Number(hcpChange))} this period`
              : Number(hcpChange) > 0 ? `↑ ${hcpChange} this period` : "No change"
              : undefined}
            delay={0.2} />
          <StatCard label="Avg Putts"  value={avgPutts}  sub="per round"            delay={0.25} />
          <StatCard label="Best Putts" value={bestPutts} sub="fewest in a round"    delay={0.3} />
          <StatCard label="Rounds"     value={filtered.length} sub="in selected period" delay={0.35} />
        </div>

        {/* Charts */}
        {error && (
          <p className="text-sm text-red-400/70 italic">
            Could not load stats. Check your connection and refresh.
          </p>
        )}
        {!loading && !error && (
          <ErrorBoundary section="Charts">
          <div className="flex flex-col gap-5">
            <ChartCard title="Score Trend" subtitle="Scoring" note={has9H ? "9H rounds ×2" : undefined} delay={0.2}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  {avgScoreNum && (
                    <ReferenceLine y={avgScoreNum} stroke="rgba(201,168,76,0.3)" strokeDasharray="4 4"
                      label={{ value: "avg", fill: "rgba(201,168,76,0.5)", fontSize: 10, position: "insideTopRight" }} />
                  )}
                  <Tooltip content={<ChartTooltip unit=" strokes" />} />
                  <Line type="monotone" dataKey="score" stroke="#c9a84c" strokeWidth={2}
                    dot={{ r: 3, fill: "#c9a84c", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#c9a84c", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Score vs Par" subtitle="Scoring" delay={0.25}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)"
                    label={{ value: "E", fill: "rgba(255,255,255,0.2)", fontSize: 10, position: "insideTopRight" }} />
                  <Tooltip content={<ChartTooltip prefix="+" unit=" vs par" />} />
                  <Line type="monotone" dataKey="toPar" stroke="#7dd3a8" strokeWidth={2}
                    dot={{ r: 3, fill: "#7dd3a8", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#7dd3a8", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Putts Per Round" subtitle="Putting" note={has9H ? "9H rounds ×2" : undefined} delay={0.3}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={puttRef} stroke="rgba(201,168,76,0.25)" strokeDasharray="4 4"
                    label={{ value: `${puttRef} putts`, fill: "rgba(201,168,76,0.4)", fontSize: 10, position: "insideTopRight" }} />
                  <Tooltip content={<ChartTooltip unit=" putts" />} />
                  <Line type="monotone" dataKey="putts" stroke="#a78bfa" strokeWidth={2}
                    dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Handicap Trend" subtitle="Index" delay={0.35}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="handicap" stroke="#c9a84c" strokeWidth={2}
                    dot={{ r: 3, fill: "#c9a84c", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#c9a84c", strokeWidth: 0 }} />
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
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
