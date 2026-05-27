/**
 * Scrambles page — team scramble leaderboard, match history, and admin match logging.
 *
 * Data is loaded from `GET /api/scrambles` (not cached). Player points are computed
 * server-side at read time by scanning all rounds; this page receives the final sorted list.
 *
 * Admin match-logging form (visible only when `isAdmin`):
 *   Step 0 — Teams: date, course selection (existing or new), 4 player name inputs
 *             (Player 1 + Player 3 required; Player 2 + Player 4 optional)
 *   Step 1 — Scores: team scores with a "Log Match" submit button
 *   Step 2 — Success: winner announcement with a "Log Another" shortcut
 *
 * Course selection mirrors `log-round/page.tsx`: choosing "+ Add a new course" reveals
 * the full new-course form (CourseSearch + city + par/rating/slope + optional image upload).
 * The new course is inserted into the `courses` table and appended to local state so it
 * appears immediately in the dropdown without a re-fetch.
 *
 * Player upsert strategy (`getOrCreatePlayer`): looks up the player by name with
 * `.maybeSingle()` (returns null instead of throwing on zero rows), then inserts only
 * if no match is found. This means players are identified by name across sessions.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CourseSearch } from "@/components/CourseSearch";
import { toast } from "sonner";
import type { CourseRow } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScramblePlayer { id: string; name: string; points: number; }
interface ScrambleRound {
  id: string; date: string; course: string;
  team1: string[]; team2: string[];
  team1Score: number; team2Score: number;
  winner: "team1" | "team2" | "tie";
}
interface ScrambleForm {
  date: string;
  selectedCourseId: string;
  course: string;
  player1: string; player2: string;
  player3: string; player4: string;
  team1Score: string; team2Score: string;
}
interface NewCourseForm {
  name: string; city: string; par: string; rating: string; slope: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];
const DEFAULT_FORM: ScrambleForm = {
  date: TODAY, selectedCourseId: "", course: "",
  player1: "", player2: "", player3: "", player4: "",
  team1Score: "", team2Score: "",
};
const EMPTY_NEW_COURSE: NewCourseForm = { name: "", city: "", par: "", rating: "", slope: "" };
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function toImageSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/**
 * Looks up a scramble player by name; inserts a new record if none exists.
 * Returns the player's UUID. Uses `maybeSingle()` to avoid a thrown error on
 * zero rows (unlike `.single()`, which throws when no row is found).
 */
async function getOrCreatePlayer(name: string): Promise<string> {
  const trimmed = name.trim();
  const { data: existing } = await (supabase as any)
    .from("scramble_players").select("id").eq("name", trimmed).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from("scramble_players").insert({ name: trimmed }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? `Failed to create player: ${trimmed}`);
  return (created as any).id as string;
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] uppercase tracking-widest text-white/35 font-semibold">{label}</label>
        {hint && <span className="text-[10px] text-white/20">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors";

// ─── Step bar ─────────────────────────────────────────────────────────────────

const FORM_STEPS = ["Teams", "Scores"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {FORM_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${i <= current ? "bg-[#c9a84c] text-black" : "bg-white/8 text-white/30"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`text-xs font-semibold transition-colors duration-300 ${i === current ? "text-white" : i < current ? "text-[#c9a84c]" : "text-white/25"}`}>
            {label}
          </span>
          {i < FORM_STEPS.length - 1 && (
            <div className={`w-8 h-px transition-colors duration-300 ${i < current ? "bg-[#c9a84c]/50" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 0 — Teams ───────────────────────────────────────────────────────────

function StepTeams({
  form,
  onChange,
  onNext,
  playerNames,
  courses = [],
  newCourse,
  onNewCourse,
  imageFile,
  onImageFile,
}: {
  form: ScrambleForm;
  onChange: (f: ScrambleForm) => void;
  onNext: () => void;
  playerNames: string[];
  courses?: CourseRow[];
  newCourse: NewCourseForm;
  onNewCourse: (f: NewCourseForm) => void;
  imageFile: File | null;
  onImageFile: (f: File | null) => void;
}) {
  const isNew = form.selectedCourseId === "new";
  const selectedCourse = courses.find((c) => c.id === form.selectedCourseId);

  return (
    <motion.form
      key="step-teams"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      onSubmit={(e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isNew && (!newCourse.name.trim() || !newCourse.city.trim() || !newCourse.par || !newCourse.rating || !newCourse.slope)) return;
        onNext();
      }}
      className="flex flex-col gap-5"
    >
      <datalist id="scramble-player-names">
        {playerNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Field label="Date">
        <input type="date" value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          className={inputCls} required />
      </Field>

      <Field label="Course">
        <select
          value={form.selectedCourseId}
          onChange={(e) => {
            const id = e.target.value;
            const course = courses.find((c) => c.id === id);
            onChange({ ...form, selectedCourseId: id, course: course ? course.name : "" });
          }}
          className={selectCls}
          required
        >
          <option value="" disabled>Select a course...</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
          ))}
          <option value="new">+ Add a new course</option>
        </select>
      </Field>

      {/* Existing course preview */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">{selectedCourse.name}</p>
              <p className="text-xs text-white/35 mt-0.5">{selectedCourse.city}</p>
            </div>
            <p className="text-xs text-white/40">Par {selectedCourse.par}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New course fields */}
      <AnimatePresence>
        {isNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 pt-1 border-t border-white/8 mt-1">
              <p className="text-xs text-white/30 pt-3">
                Enter the details for the new course. It will be saved to your course list.
              </p>
              <Field label="Course Name">
                <CourseSearch
                  value={newCourse.name}
                  onChange={(v) => onNewCourse({ ...newCourse, name: v })}
                  onSelect={({ name, city }) => onNewCourse({ ...newCourse, name, city })}
                  required={isNew}
                />
              </Field>
              <Field label="City / Location">
                <input type="text" placeholder="e.g. Kohler, WI" value={newCourse.city}
                  onChange={(e) => onNewCourse({ ...newCourse, city: e.target.value })}
                  className={inputCls} required={isNew} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "par",    label: "Par",    placeholder: "72",   min: "60",  max: "80",  step: "1"   },
                  { key: "rating", label: "Rating", placeholder: "71.5", min: "50",  max: "80",  step: "0.1" },
                  { key: "slope",  label: "Slope",  placeholder: "131",  min: "55",  max: "155", step: "1"   },
                ] as const).map((f) => (
                  <Field key={f.key} label={f.label}>
                    <input
                      type="number" placeholder={f.placeholder} min={f.min} max={f.max} step={f.step}
                      value={newCourse[f.key]}
                      onChange={(e) => onNewCourse({ ...newCourse, [f.key]: e.target.value })}
                      onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                      className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      required={isNew}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Course Image" hint="optional · JPG, PNG, WEBP up to 5 MB">
                <label className="block cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) return;
                      onImageFile(file);
                    }}
                  />
                  {imageFile ? (
                    <div className="relative rounded-xl overflow-hidden h-28 border border-white/10 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-white font-medium">Click to change</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 bg-white/3 h-20 flex flex-col items-center justify-center gap-1 hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-all">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span className="text-xs text-white/30">Click to upload</span>
                    </div>
                  )}
                </label>
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/3">
          <p className="text-[11px] uppercase tracking-widest text-[#c9a84c] font-semibold">Team 1</p>
          <Field label="Player 1" hint="required">
            <input list="scramble-player-names" type="text" placeholder="Name" value={form.player1}
              onChange={(e) => onChange({ ...form, player1: e.target.value })} className={inputCls} required />
          </Field>
          <Field label="Player 2" hint="optional">
            <input list="scramble-player-names" type="text" placeholder="Name" value={form.player2}
              onChange={(e) => onChange({ ...form, player2: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/8 bg-white/2">
          <p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold">Team 2</p>
          <Field label="Player 3" hint="required">
            <input list="scramble-player-names" type="text" placeholder="Name" value={form.player3}
              onChange={(e) => onChange({ ...form, player3: e.target.value })} className={inputCls} required />
          </Field>
          <Field label="Player 4" hint="optional">
            <input list="scramble-player-names" type="text" placeholder="Name" value={form.player4}
              onChange={(e) => onChange({ ...form, player4: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </div>

      <button type="submit"
        className="mt-1 w-full rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
        Next — Enter Scores
      </button>
    </motion.form>
  );
}

// ─── Step 1 — Scores ──────────────────────────────────────────────────────────

function StepScores({
  form, onChange, onBack, onSubmit, submitting,
}: {
  form: ScrambleForm;
  onChange: (f: ScrambleForm) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const team1Label = [form.player1, form.player2].filter(Boolean).join(" + ") || "Team 1";
  const team2Label = [form.player3, form.player4].filter(Boolean).join(" + ") || "Team 2";

  return (
    <motion.form
      key="step-scores"
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
      onSubmit={(e: React.SyntheticEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit(); }}
      className="flex flex-col gap-5"
    >
      <p className="text-sm text-white/40">{form.course} · {fmtDate(form.date)}</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label={team1Label}>
          <input type="number" placeholder="Score" min={20} max={200} value={form.team1Score}
            onChange={(e) => onChange({ ...form, team1Score: e.target.value })}
            onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
            className={`${inputCls} text-center text-2xl font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            required />
        </Field>
        <Field label={team2Label}>
          <input type="number" placeholder="Score" min={20} max={200} value={form.team2Score}
            onChange={(e) => onChange({ ...form, team2Score: e.target.value })}
            onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
            className={`${inputCls} text-center text-2xl font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            required />
        </Field>
      </div>
      <div className="flex gap-3 mt-1">
        <button type="button" onClick={onBack}
          className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
          ← Back
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none">
          {submitting ? "Saving…" : "Log Match"}
        </button>
      </div>
    </motion.form>
  );
}

// ─── Step 2 — Success ─────────────────────────────────────────────────────────

function StepSuccess({
  form, winner, onLogAnother,
}: {
  form: ScrambleForm;
  winner: "team1" | "team2" | "tie";
  onLogAnother: () => void;
}) {
  const team1Label = [form.player1, form.player2].filter(Boolean).join(" & ") || "Team 1";
  const team2Label = [form.player3, form.player4].filter(Boolean).join(" & ") || "Team 2";
  const winnerLabel = winner === "team1" ? team1Label : winner === "team2" ? team2Label : "Tie!";

  return (
    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center gap-6 py-2">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/30 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6 10-10" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Match Logged</p>
        <h2 className="text-3xl font-black tracking-tight text-white">{winnerLabel}</h2>
        <p className="text-sm text-white/35 mt-1">
          {winner === "tie" ? "Match ended in a tie" : "won the match"}
        </p>
      </div>
      <div className="w-full grid grid-cols-2 gap-3">
        {[
          { label: team1Label, score: form.team1Score, win: winner === "team1" },
          { label: team2Label, score: form.team2Score, win: winner === "team2" },
        ].map(({ label, score, win }) => (
          <div key={label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${win ? "border-[#c9a84c]/30 bg-[#c9a84c]/8" : "border-white/8 bg-white/3"}`}>
            <span className="text-[10px] uppercase tracking-widest text-white/25 truncate">{label}</span>
            <span className={`text-3xl font-black ${win ? "text-[#c9a84c]" : "text-white"}`}>{score}</span>
          </div>
        ))}
      </div>
      <button onClick={onLogAnother}
        className="w-full rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
        Log Another Match
      </button>
    </motion.div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

const PODIUM_SLOTS = [
  { rank: 2, label: "2nd", color: "#94a3b8", platformH: "h-20", delay: 0.15 },
  { rank: 1, label: "1st", color: "#c9a84c", platformH: "h-28", delay: 0.05 },
  { rank: 3, label: "3rd", color: "#cd7f32", platformH: "h-14", delay: 0.25 },
] as const;

/**
 * Renders a 3-slot podium (2nd left, 1st center, 3rd right) with staggered spring
 * animations. Slots without a corresponding player show an empty placeholder so the
 * layout is stable even when fewer than 3 players have recorded wins.
 * Platform heights visually distinguish 1st (tallest), 2nd, and 3rd (shortest).
 */
function Podium({ players }: { players: ScramblePlayer[] }) {
  if (players.length === 0) return null;
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-3 pb-2">
      {PODIUM_SLOTS.map(({ rank, label, color, platformH, delay }) => {
        const player = players[rank - 1];
        return (
          <motion.div key={rank} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 180, damping: 22 }}
            className="flex flex-col items-center">
            <div className="text-center mb-2 w-24 sm:w-28">
              {player ? (
                <>
                  <div className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-black text-black"
                    style={{ background: color }}>{rank}</div>
                  <p className="text-sm font-bold text-white leading-tight truncate px-1">{player.name}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color }}>
                    {player.points} {player.points === 1 ? "pt" : "pts"}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold border border-white/10 text-white/20">
                    {rank}
                  </div>
                  <p className="text-xs text-white/20">—</p>
                </>
              )}
            </div>
            <div className={`w-24 sm:w-28 ${platformH} rounded-t-lg flex items-end justify-center pb-2`}
              style={{ background: `${color}14`, border: `1px solid ${color}30`, borderBottom: "none" }}>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/20">{label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScramblesPage() {
  const { session } = useAuth();
  const isAdmin = session !== null;

  const [players, setPlayers] = useState<ScramblePlayer[]>([]);
  const [rounds, setRounds]   = useState<ScrambleRound[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [step, setStep]           = useState<0 | 1 | 2>(0);
  const [form, setForm]           = useState<ScrambleForm>(DEFAULT_FORM);
  const [newCourse, setNewCourse] = useState<NewCourseForm>(EMPTY_NEW_COURSE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastWinner, setLastWinner] = useState<"team1" | "team2" | "tie">("tie");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/scrambles");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setPlayers(json.players ?? []);
      setRounds(json.rounds ?? []);
    } catch {
      setError("Failed to load scramble data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    supabase.from("courses").select("*").order("name").then(({ data }) => setCourses(data ?? []));
  }, [loadData]);

  function resetForm() {
    setForm({ ...DEFAULT_FORM, date: new Date().toISOString().split("T")[0] });
    setNewCourse(EMPTY_NEW_COURSE);
    setImageFile(null);
    setStep(0);
  }

  function openForm()  { resetForm(); setShowForm(true); }
  function closeForm() { setShowForm(false); resetForm(); }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let courseName = form.course.trim();

      // Create new course in the courses table if needed
      if (form.selectedCourseId === "new") {
        let image = toImageSlug(newCourse.name.trim());
        if (imageFile) {
          const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const filePath = `${toImageSlug(newCourse.name.trim())}-${Date.now()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("courses-images").upload(filePath, imageFile, { upsert: true });
          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from("courses-images").getPublicUrl(uploadData.path);
            image = publicUrl;
          }
        }
        const { data: created, error: courseError } = await supabase.from("courses").insert({
          name:   newCourse.name.trim(),
          city:   newCourse.city.trim(),
          par:    Number(newCourse.par)    || 72,
          rating: Number(newCourse.rating) || 0,
          slope:  Number(newCourse.slope)  || 113,
          image,
        }).select().single();
        if (courseError) throw new Error("Failed to save course");
        courseName = (created as any).name;
        setCourses((prev) => [...prev, created as CourseRow].sort((a, b) => a.name.localeCompare(b.name)));
      }

      const p1Id = await getOrCreatePlayer(form.player1);
      const p2Id = form.player2.trim() ? await getOrCreatePlayer(form.player2) : null;
      const p3Id = form.player3.trim() ? await getOrCreatePlayer(form.player3) : null;
      const p4Id = form.player4.trim() ? await getOrCreatePlayer(form.player4) : null;

      const t1 = Number(form.team1Score);
      const t2 = Number(form.team2Score);

      const { error: insertError } = await supabase.from("scramble_rounds").insert({
        date:        form.date,
        course:      courseName,
        p1_id:       p1Id,
        p2_id:       p2Id,
        p3_id:       p3Id,
        p4_id:       p4Id,
        team1_score: t1,
        team2_score: t2,
      });
      if (insertError) throw new Error("Failed to log match");

      const winner: "team1" | "team2" | "tie" = t1 < t2 ? "team1" : t2 < t1 ? "team2" : "tie";
      setLastWinner(winner);
      setStep(2);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const playerNames = players.map((p) => p.name);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-20 sm:pt-28 pb-24">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Leaderboard</p>
            <h1 className="text-4xl font-bold tracking-tight">Scrambles</h1>
          </div>
          {isAdmin && (
            <button
              onClick={showForm ? closeForm : openForm}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                showForm
                  ? "border border-white/10 text-white/50 hover:text-white hover:border-white/20"
                  : "bg-[#c9a84c] text-black hover:bg-[#d4b86a]"
              }`}
            >
              {showForm ? (step === 2 ? "Close" : "Cancel") : "+ Log Match"}
            </button>
          )}
        </motion.div>

        {/* Inline log form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-10"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                {step < 2 && (
                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-3">New Match</p>
                    <StepBar current={step} />
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <StepTeams
                      form={form}
                      onChange={setForm}
                      onNext={() => setStep(1)}
                      playerNames={playerNames}
                      courses={courses}
                      newCourse={newCourse}
                      onNewCourse={setNewCourse}
                      imageFile={imageFile}
                      onImageFile={setImageFile}
                    />
                  )}
                  {step === 1 && (
                    <StepScores
                      form={form}
                      onChange={setForm}
                      onBack={() => setStep(0)}
                      onSubmit={handleSubmit}
                      submitting={submitting}
                    />
                  )}
                  {step === 2 && (
                    <StepSuccess
                      form={form}
                      winner={lastWinner}
                      onLogAnother={resetForm}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="flex items-end justify-center gap-3 py-8">
              {[80, 112, 56].map((h, i) => (
                <div key={i} className="w-28 rounded-t-lg bg-white/5" style={{ height: h }} />
              ))}
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5" />
            ))}
          </div>
        )}

        {error && !loading && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <>
            {players.length > 0 ? (
              <div className="mb-10">
                <Podium players={players} />
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-white/20 text-sm mb-1">No scramble matches logged yet.</p>
                {isAdmin && !showForm && (
                  <button onClick={openForm}
                    className="mt-4 rounded-xl bg-[#c9a84c] px-6 py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
                    Log your first match
                  </button>
                )}
              </div>
            )}

            {players.length > 0 && (
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold mb-4">Rankings</p>
                <div className="rounded-2xl border border-white/8 overflow-hidden">
                  {players.map((p, i) => (
                    <motion.div key={p.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 + 0.3 }}
                      className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-black w-5 text-center ${i === 0 ? "text-[#c9a84c]" : i === 1 ? "text-[#94a3b8]" : i === 2 ? "text-[#cd7f32]" : "text-white/25"}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${i === 0 ? "text-[#c9a84c]" : "text-white/50"}`}>
                        {p.points} {p.points === 1 ? "pt" : "pts"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {rounds.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold mb-4">Match History</p>
                <div className="space-y-3">
                  {rounds.map((r, i) => {
                    const t1 = r.team1.join(" & ") || "Team 1";
                    const t2 = r.team2.join(" & ") || "Team 2";
                    const winnerLabel = r.winner === "team1" ? t1 : r.winner === "team2" ? t2 : null;
                    return (
                      <motion.div key={r.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 + 0.2 }}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{r.course}</p>
                            <p className="text-xs text-white/35 mt-0.5">{fmtDate(r.date)}</p>
                          </div>
                          {winnerLabel ? (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#c9a84c] border border-[#c9a84c]/25 px-2 py-1 rounded-lg whitespace-nowrap ml-3 shrink-0">
                              {winnerLabel} wins
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 border border-white/10 px-2 py-1 rounded-lg ml-3 shrink-0">
                              Tie
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: t1, score: r.team1Score, win: r.winner === "team1" },
                            { label: t2, score: r.team2Score, win: r.winner === "team2" },
                          ].map(({ label, score, win }) => (
                            <div key={label} className={`rounded-xl border p-3 ${win ? "border-[#c9a84c]/30 bg-[#c9a84c]/6" : "border-white/8 bg-white/2"}`}>
                              <p className="text-[10px] text-white/30 mb-1 truncate">{label}</p>
                              <p className={`text-xl font-black tabular-nums ${win ? "text-[#c9a84c]" : "text-white"}`}>{score}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
