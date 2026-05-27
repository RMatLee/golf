/**
 * Rounds history page.
 *
 * Shows the 3 most recent rounds as animated cards, followed by a sortable and
 * filterable table of all rounds. Fetches from `GET /api/rounds` (Redis-cached).
 *
 * Admin controls (edit/delete) appear only when `isAdmin` is true (`session !== null`).
 * Writes go directly to Supabase using the authenticated user's session token;
 * RLS on the `rounds` table rejects unauthenticated mutations. The Redis cache is
 * invalidated via `POST /api/cache/invalidate` after every successful write.
 *
 * Key derived state (all memoized):
 *  - `recentThree`  — top 3 rounds sorted newest-first, shown as cards
 *  - `courses`      — deduplicated sorted course name list for the dropdown filter
 *  - `tableRounds`  — full list filtered by `search`, `course`, and sorted by `sort`
 */
"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { RoundItem } from "@/app/api/rounds/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Round = RoundItem;

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

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors";

// ─── Recent Round Card ────────────────────────────────────────────────────────

function RecentCard({ round, index, isAdmin, onEdit, onDelete }: {
  round: Round; index: number; isAdmin: boolean;
  onEdit: (r: Round) => void; onDelete: (r: Round) => void;
}) {
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-white/10 text-white/30">
            {round.holes ?? 18}H
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${toParBadgeBg(diff)}`}>
            {diff === 0 ? "Even" : diff > 0 ? `+${diff} over` : `${Math.abs(diff)} under`}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-5xl font-black tracking-tighter text-white">{round.score}</span>
        <div className="mb-1.5 flex flex-col">
          <span className={`text-xl font-bold ${color}`}>{label}</span>
          <span className="text-[10px] text-white/25 uppercase tracking-widest">par {round.par}</span>
        </div>
      </div>
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(round)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={() => onDelete(round)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c9a84c]/0 via-[#c9a84c]/40 to-[#c9a84c]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

type Course9H = {
  par: number;
  rating: number;
  slope: number;
  front_par: number | null;
  front_rating: number | null;
  front_slope: number | null;
  back_par: number | null;
  back_rating: number | null;
  back_slope: number | null;
};

/** Computes a USGA handicap differential: (score − rating) × 113 / slope, to one decimal. */
function calcDifferential(score: number, rating: number, slope: number) {
  return Math.round((score - rating) * 113 / slope * 10) / 10;
}

function EditModal({ round, onClose, onSaved }: {
  round: Round;
  onClose: () => void;
  onSaved: (updated: { id: string; date: string; score: number; par: number; holes: number }) => void;
}) {
  const [form, setForm]         = useState({
    date: round.date, score: String(round.score), putts: "",
    holes: "18" as "9" | "18", nineHoleType: "" as "front" | "back" | "",
  });
  const [course9H, setCourse9H] = useState<Course9H | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    supabase.from("rounds")
      .select("putts, holes, nine_hole_type, courses(par, rating, slope, front_par, front_rating, front_slope, back_par, back_rating, back_slope)")
      .eq("id", round.id).single()
      .then(({ data }) => {
        if (data?.courses) setCourse9H(data.courses as unknown as Course9H);
        setForm((f) => ({
          ...f,
          putts:        String(data?.putts ?? ""),
          holes:        String(data?.holes ?? 18) as "9" | "18",
          nineHoleType: (data?.nine_hole_type as "front" | "back") || "",
        }));
        setFetching(false);
      });
  }, [round.id]);

  const has9HData = !!(course9H?.front_rating || course9H?.back_rating || course9H?.front_par || course9H?.back_par);

  function derivePar(): number {
    if (!course9H) return round.par;
    if (form.holes === "9") {
      if (form.nineHoleType === "front") return course9H.front_par ?? Math.round(course9H.par / 2);
      if (form.nineHoleType === "back")  return course9H.back_par  ?? Math.round(course9H.par / 2);
      return Math.round(course9H.par / 2);
    }
    return course9H.par;
  }

  function deriveHandicap(): number | null {
    if (!course9H) return null;
    const score = Number(form.score);
    if (form.holes === "9") {
      if (form.nineHoleType === "front" && course9H.front_rating && course9H.front_slope)
        return calcDifferential(score, course9H.front_rating, course9H.front_slope);
      if (form.nineHoleType === "back"  && course9H.back_rating  && course9H.back_slope)
        return calcDifferential(score, course9H.back_rating, course9H.back_slope);
      return calcDifferential(score, course9H.rating / 2, course9H.slope);
    }
    return calcDifferential(score, course9H.rating, course9H.slope);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const par      = derivePar();
    const handicap = deriveHandicap();
    try {
      const payload: Record<string, unknown> = {
        date:           form.date,
        score:          Number(form.score),
        putts:          Number(form.putts) || 0,
        holes:          Number(form.holes),
        par,
        nine_hole_type: form.nineHoleType || null,
      };
      if (handicap !== null) payload.handicap = handicap;
      const { error } = await supabase.from("rounds").update(payload).eq("id", round.id);
      if (error) throw error;
      await fetch("/api/cache/invalidate", { method: "POST" });
      toast.success("Round updated");
      onSaved({ id: round.id, date: form.date, score: Number(form.score), par, holes: Number(form.holes) });
    } catch {
      toast.error("Failed to update round");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Edit</p>
        <h2 className="text-xl font-bold mb-5">{round.course}</h2>

        {fetching ? (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm text-white/30">Loading…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Holes</label>
              <div className="flex gap-2">
                {(["9", "18"] as const).map((h) => (
                  <button key={h} type="button"
                    onClick={() => setForm({ ...form, holes: h, nineHoleType: h === "18" ? "" : form.nineHoleType })}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                      form.holes === h
                        ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                        : "border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20"
                    }`}>
                    {h}H
                  </button>
                ))}
              </div>
            </div>

            {form.holes === "9" && has9HData && (
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Which 9?</label>
                <div className="flex gap-2">
                  {(["front", "back"] as const).map((side) => (
                    <button key={side} type="button" onClick={() => setForm({ ...form, nineHoleType: side })}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-bold capitalize transition-all ${
                        form.nineHoleType === side
                          ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                          : "border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20"
                      }`}>
                      {side} 9
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputCls} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Score</label>
                <input type="number" min={15} max={200} value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  onKeyDown={(e) => ["e","E","+","-"].includes(e.key) && e.preventDefault()}
                  className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  required />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Putts</label>
                <input type="number" min={0} max={80} value={form.putts}
                  onChange={(e) => setForm({ ...form, putts: e.target.value })}
                  onKeyDown={(e) => ["e","E","+","-"].includes(e.key) && e.preventDefault()}
                  className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-[#c9a84c] py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ round, onClose, onDeleted }: {
  round: Round;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("rounds").delete().eq("id", round.id);
      if (error) throw error;
      await fetch("/api/cache/invalidate", { method: "POST" });
      toast.success("Round deleted");
      onDeleted(round.id);
    } catch {
      toast.error("Failed to delete round");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-red-400 font-semibold mb-1">Delete Round</p>
        <h2 className="text-xl font-bold mb-1">{round.course}</h2>
        <p className="text-sm text-white/40 mb-6">{fmtDate(round.date)} · {round.score} strokes</p>
        <p className="text-sm text-white/60 mb-6">This round will be permanently removed. This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 rounded-xl bg-red-500/80 py-2.5 text-sm font-bold text-white hover:bg-red-500 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoundsPage() {
  const { session }           = useAuth();
  const isAdmin               = session !== null;

  const [rounds, setRounds]   = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [search, setSearch]   = useState("");
  const [course, setCourse]   = useState("All");
  const [sort, setSort]       = useState<SortKey>("date-desc");
  const [editTarget, setEditTarget]     = useState<Round | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Round | null>(null);

  useEffect(() => {
    fetch("/api/rounds")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(({ rounds }) => {
        setRounds(rounds);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Rounds fetch failed:", err);
        setError(true);
        setLoading(false);
      });
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

  function handleSaved(updated: { id: string; date: string; score: number; par: number; holes: number }) {
    setRounds((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
    setEditTarget(null);
  }

  function handleDeleted(id: string) {
    setRounds((prev) => prev.filter((r) => r.id !== id));
    setDeleteTarget(null);
  }

  const adminColClass   = isAdmin ? "grid-cols-[1fr_2fr_auto_auto_auto]" : "grid-cols-[1fr_2fr_auto_auto]";
  const adminHeaderCols = isAdmin ? ["Date", "Course", "Score", "vs Par", ""] : ["Date", "Course", "Score", "vs Par"];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-20 sm:pt-28 pb-24">

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
            : recentThree.map((round, i) => (
                <RecentCard key={round.id} round={round} index={i}
                  isAdmin={isAdmin} onEdit={setEditTarget} onDelete={setDeleteTarget} />
              ))
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

            {/* Desktop header */}
            <div className={`hidden sm:grid ${adminColClass} gap-4 px-5 py-3 border-b border-white/6 bg-white/2`}>
              {adminHeaderCols.map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-widest text-white/25 last:text-right">{h}</span>
              ))}
            </div>

            <AnimatePresence mode="popLayout">
              {error ? (
                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-red-400/70 italic px-5 py-8 text-center">
                  Could not load rounds. Check your connection and refresh.
                </motion.p>
              ) : loading ? (
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
                  const EditBtn = () => (
                    <button onClick={() => setEditTarget(round)}
                      className="p-2 rounded-lg bg-white/5 sm:bg-transparent hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  );
                  const DeleteBtn = () => (
                    <button onClick={() => setDeleteTarget(round)}
                      className="p-2 rounded-lg bg-white/5 sm:bg-transparent hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  );
                  return (
                    <motion.div key={round.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors group">

                      {/* Mobile row */}
                      <div className="sm:hidden flex items-center gap-3 px-4 py-3.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{round.course}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-white/35 tabular-nums">{fmtDate(round.date)}</span>
                            <span className="text-[10px] border border-white/10 rounded px-1 text-white/25">{round.holes ?? 18}H</span>
                          </div>
                        </div>
                        <div className="text-right mr-1">
                          <p className="text-lg font-bold text-white tabular-nums">{round.score}</p>
                          <p className={`text-xs font-bold tabular-nums ${color}`}>{label}</p>
                        </div>
                        {isAdmin && <div className="flex gap-1"><EditBtn /><DeleteBtn /></div>}
                      </div>

                      {/* Desktop row */}
                      <div className={`hidden sm:grid ${adminColClass} gap-4 px-5 py-3.5`}>
                        <span className="text-xs text-white/40 font-mono tabular-nums self-center">
                          {fmtDate(round.date)}
                          <span className="ml-1.5 text-[10px] border border-white/10 rounded px-1 py-0.5 text-white/25">{round.holes ?? 18}H</span>
                        </span>
                        <span className="text-sm text-white font-medium self-center truncate">{round.course}</span>
                        <span className="text-sm font-bold text-white tabular-nums self-center text-right">{round.score}</span>
                        <span className={`text-sm font-bold tabular-nums self-center text-right ${color}`}>{label}</span>
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditBtn /><DeleteBtn />
                          </div>
                        )}
                      </div>

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

      {/* Modals */}
      <AnimatePresence>
        {editTarget && (
          <EditModal key="edit" round={editTarget}
            onClose={() => setEditTarget(null)} onSaved={handleSaved} />
        )}
        {deleteTarget && (
          <DeleteConfirm key="delete" round={deleteTarget}
            onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
        )}
      </AnimatePresence>
    </div>
  );
}
