"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Round {
  id: string;
  date: string;
  course: string;
  score: number;
  par: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toPar(score: number, par: number) {
  const diff = score - par;
  if (diff === 0) return { label: "E",       color: "text-emerald-400" };
  if (diff > 0)   return { label: `+${diff}`, color: "text-red-400"     };
  return           { label: `${diff}`,        color: "text-emerald-400" };
}

function toParBadgeBg(diff: number) {
  if (diff <= 0)  return "bg-emerald-400/10 text-emerald-400";
  if (diff <= 10) return "bg-yellow-400/10 text-yellow-400";
  return "bg-red-400/10 text-red-400";
}

type SortKey = "date-desc" | "date-asc" | "score-asc" | "score-desc";

// ─── Recent Round Card ────────────────────────────────────────────────────────

function RecentCard({ round, index }: { round: Round; index: number }) {
  const diff = round.score - round.par;
  const { label, color } = toPar(round.score, round.par);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-6 flex flex-col gap-4 hover:border-[#c9a84c]/30 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-1">{fmtDate(round.date)}</p>
          <h3 className="text-base font-bold text-white leading-tight">{round.course}</h3>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${toParBadgeBg(diff)}`}>
          {diff === 0 ? "Even" : diff > 0 ? `+${diff} over` : `${Math.abs(diff)} under`}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-5xl font-black tracking-tighter text-white">{round.score}</span>
        <div className="mb-1.5 flex flex-col">
          <span className={`text-xl font-bold ${color}`}>{label}</span>
          <span className="text-[10px] text-white/25 uppercase tracking-widest">par {round.par}</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c9a84c]/0 via-[#c9a84c]/40 to-[#c9a84c]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoundsPage() {
  const [rounds, setRounds]   = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [course, setCourse]   = useState("All");
  const [sort, setSort]       = useState<SortKey>("date-desc");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("rounds")
        .select("id, date, score, par, courses(name)")
        .order("date", { ascending: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRounds((data ?? []).map((r: any) => ({
        id:     r.id,
        date:   r.date,
        score:  r.score,
        par:    r.par,
        course: r.courses?.name ?? "Unknown",
      })));
      setLoading(false);
    }
    load();
  }, []);

  const byDateDesc = useMemo(
    () => [...rounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [rounds]
  );

  const recentThree = byDateDesc.slice(0, 3);

  const courses = useMemo(() => {
    const unique = Array.from(new Set(rounds.map((r) => r.course))).sort();
    return ["All", ...unique];
  }, [rounds]);

  const tableRounds = useMemo(() => {
    let result = [...rounds];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.course.toLowerCase().includes(q));
    }
    if (course !== "All") result = result.filter((r) => r.course === course);
    switch (sort) {
      case "date-desc":  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case "date-asc":   result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case "score-asc":  result.sort((a, b) => a.score - b.score); break;
      case "score-desc": result.sort((a, b) => b.score - a.score); break;
    }
    return result;
  }, [rounds, search, course, sort]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-28 pb-24">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">History</p>
          <h1 className="text-4xl font-bold tracking-tight">Rounds</h1>
          <p className="text-sm text-white/30 mt-1.5">
            {loading ? "Loading…" : `${rounds.length} rounds logged`}
          </p>
        </motion.div>

        {/* Recent 3 cards */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3">
          Most Recent
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/8 bg-white/3 animate-pulse h-40" />
              ))
            : recentThree.map((round, i) => <RecentCard key={round.id} round={round} index={i} />)
          }
        </div>

        {/* All Rounds Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-4">All Rounds</p>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search course..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/4 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors" />
            </div>
            <select value={course} onChange={(e) => setCourse(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors">
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors">
              <option value="date-desc">Date ↓ Newest</option>
              <option value="date-asc">Date ↑ Oldest</option>
              <option value="score-asc">Score ↑ Best</option>
              <option value="score-desc">Score ↓ Worst</option>
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3 border-b border-white/6 bg-white/2">
              {["Date", "Course", "Score", "vs Par"].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-widest text-white/25 last:text-right">{h}</span>
              ))}
            </div>
            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-white/25 italic px-5 py-8 text-center">
                  Loading rounds…
                </motion.p>
              ) : tableRounds.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm text-white/25 italic px-5 py-8 text-center">
                  No rounds match your filters.
                </motion.p>
              ) : (
                tableRounds.map((round, i) => {
                  const { label, color } = toPar(round.score, round.par);
                  return (
                    <motion.div key={round.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3.5 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors group"
                    >
                      <span className="text-xs text-white/40 font-mono tabular-nums self-center">{fmtDate(round.date)}</span>
                      <span className="text-sm text-white font-medium self-center truncate">{round.course}</span>
                      <span className="text-sm font-bold text-white tabular-nums self-center text-right">{round.score}</span>
                      <span className={`text-sm font-bold tabular-nums self-center text-right ${color}`}>{label}</span>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {tableRounds.length > 0 && (
            <p className="text-xs text-white/20 mt-3 text-right">
              Showing {tableRounds.length} of {rounds.length} rounds
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
