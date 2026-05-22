"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { CourseRow } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = CourseRow;

interface RoundForm { date: string; score: string; putts: string; }
interface NewCourseForm { name: string; city: string; par: string; rating: string; slope: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toImageSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function toPar(score: number, par: number) {
  const diff = score - par;
  if (diff === 0) return { label: "Even",                   color: "text-emerald-400", bg: "bg-emerald-400/10" };
  if (diff > 0)   return { label: `+${diff} over par`,      color: "text-red-400",     bg: "bg-red-400/10"     };
  return           { label: `${Math.abs(diff)} under par`,  color: "text-emerald-400", bg: "bg-emerald-400/10" };
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ["Round Details", "Course", "Success"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.slice(0, 2).map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
              i <= current ? "bg-[#c9a84c] text-black" : "bg-white/8 text-white/30"}`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-semibold transition-colors duration-300 ${
              i === current ? "text-white" : i < current ? "text-[#c9a84c]" : "text-white/25"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 2 && (
            <div className={`w-8 h-px transition-colors duration-300 ${i < current ? "bg-[#c9a84c]/50" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

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

const inputCls  = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors";

// ─── Step 1 — Round Details ───────────────────────────────────────────────────

function StepRoundDetails({ form, onChange, onNext }: { form: RoundForm; onChange: (f: RoundForm) => void; onNext: () => void; }) {
  return (
    <motion.form key="step1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
      onSubmit={(e) => { e.preventDefault(); onNext(); }} className="flex flex-col gap-5">
      <Field label="Date">
        <input type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })}
          className={inputCls} required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Score" hint="Total strokes">
          <input type="number" placeholder="e.g. 84" value={form.score} min={30} max={200}
            onChange={(e) => onChange({ ...form, score: e.target.value })} className={inputCls} required />
        </Field>
        <Field label="Putts" hint="Total putts">
          <input type="number" placeholder="e.g. 30" value={form.putts} min={10} max={80}
            onChange={(e) => onChange({ ...form, putts: e.target.value })} className={inputCls} required />
        </Field>
      </div>
      <button type="submit"
        className="mt-2 w-full rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
        Next — Select Course
      </button>
    </motion.form>
  );
}

// ─── Step 2 — Course ──────────────────────────────────────────────────────────

const EMPTY_NEW_COURSE: NewCourseForm = { name: "", city: "", par: "", rating: "", slope: "" };

function StepCourse({ courses, selectedId, newCourse, onSelectId, onNewCourse, onBack, onSubmit, submitting }: {
  courses: Course[];
  selectedId: string;
  newCourse: NewCourseForm;
  onSelectId: (id: string) => void;
  onNewCourse: (f: NewCourseForm) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const isNew = selectedId === "new";

  return (
    <motion.form key="step2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
      onSubmit={(e) => { e.preventDefault(); if (isNew && !newCourse.name.trim()) return; onSubmit(); }}
      className="flex flex-col gap-5">
      <Field label="Course">
        <select value={selectedId} onChange={(e) => onSelectId(e.target.value)} className={selectCls} required>
          <option value="" disabled>Select a course...</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
          <option value="new">+ Add a new course</option>
        </select>
      </Field>

      <AnimatePresence>
        {isNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="flex flex-col gap-4 pt-1 border-t border-white/8 mt-1">
              <p className="text-xs text-white/30 pt-3">Enter the details for the new course. It will be saved to your course list.</p>
              <Field label="Course Name">
                <input type="text" placeholder="e.g. Whistling Straits" value={newCourse.name}
                  onChange={(e) => onNewCourse({ ...newCourse, name: e.target.value })} className={inputCls} required={isNew} />
              </Field>
              <Field label="City / Location">
                <input type="text" placeholder="e.g. Kohler, WI" value={newCourse.city}
                  onChange={(e) => onNewCourse({ ...newCourse, city: e.target.value })} className={inputCls} required={isNew} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "par",    label: "Par",    placeholder: "72"   },
                  { key: "rating", label: "Rating", placeholder: "71.5" },
                  { key: "slope",  label: "Slope",  placeholder: "131"  },
                ].map((f) => (
                  <Field key={f.key} label={f.label}>
                    <input type="text" placeholder={f.placeholder}
                      value={newCourse[f.key as keyof NewCourseForm]}
                      onChange={(e) => onNewCourse({ ...newCourse, [f.key]: e.target.value })}
                      className={inputCls} required={isNew} />
                  </Field>
                ))}
              </div>
              {newCourse.name && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                  <p className="text-[11px] text-white/30 leading-relaxed">
                    Optionally add an image named{" "}
                    <span className="font-mono text-[#c9a84c]/70">{toImageSlug(newCourse.name)}.jpg</span>{" "}
                    to <span className="font-mono text-white/40">public/images/courses/</span>
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedId && selectedId !== "new" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 px-4 py-3 flex items-center justify-between">
            {(() => {
              const c = courses.find((c) => c.id === selectedId)!;
              return (
                <>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <p className="text-xs text-white/35 mt-0.5">{c.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Par {c.par}</p>
                    <p className="text-xs text-white/30">{c.rating} / {c.slope}</p>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 mt-2">
        <button type="button" onClick={onBack}
          className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
          ← Back
        </button>
        <button type="submit" disabled={!selectedId || submitting}
          className="flex-1 rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none">
          {submitting ? "Saving…" : "Log Round"}
        </button>
      </div>
    </motion.form>
  );
}

// ─── Step 3 — Success ─────────────────────────────────────────────────────────

function StepSuccess({ score, par, putts, courseName, date, onLogAnother, onHome }: {
  score: number; par: number; putts: number; courseName: string; date: string;
  onLogAnother: () => void; onHome: () => void;
}) {
  const { label, color, bg } = toPar(score, par);

  return (
    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }} className="flex flex-col items-center text-center gap-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/30 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l6 6 10-10" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Round Logged</p>
        <h2 className="text-3xl font-black tracking-tight text-white">{courseName}</h2>
        <p className="text-sm text-white/35 mt-1">{fmtDate(date)}</p>
      </div>
      <div className="w-full grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/25">Score</span>
          <span className="text-3xl font-black text-white">{score}</span>
        </div>
        <div className={`rounded-2xl border border-white/8 ${bg} p-4 flex flex-col gap-1`}>
          <span className="text-[10px] uppercase tracking-widest text-white/25">vs Par</span>
          <span className={`text-xl font-black ${color}`}>{label}</span>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/25">Putts</span>
          <span className="text-3xl font-black text-white">{putts}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full pt-2">
        <button onClick={onLogAnother}
          className="w-full rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
          Log Another Round
        </button>
        <button onClick={onHome}
          className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
          Back to Home
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];
const DEFAULT_ROUND: RoundForm = { date: TODAY, score: "", putts: "" };

export default function LogRoundPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  const [courses, setCourses]       = useState<Course[]>([]);
  const [step, setStep]             = useState<0 | 1 | 2>(0);
  const [roundForm, setRoundForm]   = useState<RoundForm>(DEFAULT_ROUND);
  const [selectedId, setSelectedId] = useState("");
  const [newCourse, setNewCourse]   = useState<NewCourseForm>(EMPTY_NEW_COURSE);
  const [submitting, setSubmitting] = useState(false);
  const [savedCourse, setSavedCourse] = useState<Course | null>(null);

  useEffect(() => {
    supabase.from("courses").select("*").order("name").then(({ data }) => setCourses(data ?? []));
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    let courseId = selectedId;
    let resolved: Course | undefined = courses.find((c) => c.id === selectedId);

    // If adding a new course, insert it first
    if (selectedId === "new") {
      const { data: created } = await supabase.from("courses").insert({
        name:   newCourse.name.trim(),
        city:   newCourse.city.trim(),
        par:    Number(newCourse.par)    || 72,
        rating: Number(newCourse.rating) || 0,
        slope:  Number(newCourse.slope)  || 113,
        image:  toImageSlug(newCourse.name.trim()),
      }).select().single();

      if (created) {
        setCourses((prev) => [...prev, created]);
        courseId = created.id;
        resolved = created;
      }
    }

    // Insert the round
    await supabase.from("rounds").insert({
      date:      roundForm.date,
      course_id: courseId,
      score:     Number(roundForm.score),
      par:       resolved?.par ?? 72,
      putts:     Number(roundForm.putts),
    });

    // Invalidate Redis cache so next page load fetches fresh data
    await fetch("/api/cache/invalidate", { method: "POST" });

    setSavedCourse(resolved ?? null);
    setSubmitting(false);
    setStep(2);
  }

  function handleLogAnother() {
    setStep(0);
    setRoundForm(DEFAULT_ROUND);
    setSelectedId("");
    setNewCourse(EMPTY_NEW_COURSE);
    setSavedCourse(null);
  }

  if (authLoading || !session) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-lg mx-auto px-5 pt-28 pb-24">

        <AnimatePresence mode="wait">
          {step < 2 && (
            <motion.div key="header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mb-8">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">New Entry</p>
              <h1 className="text-4xl font-bold tracking-tight">Log a Round</h1>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 2 && <StepBar current={step} />}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <StepRoundDetails form={roundForm} onChange={setRoundForm} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepCourse
              courses={courses}
              selectedId={selectedId}
              newCourse={newCourse}
              onSelectId={setSelectedId}
              onNewCourse={setNewCourse}
              onBack={() => setStep(0)}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
          {step === 2 && savedCourse && (
            <StepSuccess
              score={Number(roundForm.score)}
              par={savedCourse.par}
              putts={Number(roundForm.putts)}
              courseName={savedCourse.name}
              date={roundForm.date}
              onLogAnother={handleLogAnother}
              onHome={() => router.push("/")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
