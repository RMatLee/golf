"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CourseSearch } from "@/components/CourseSearch";
import { toast } from "sonner";
import type { CourseRow } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = CourseRow;

interface RoundForm { date: string; score: string; putts: string; holes: "9" | "18"; nineHoleType: "front" | "back" | ""; }
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
      <Field label="Holes Played">
        <div className="flex gap-2">
          {(["9", "18"] as const).map((h) => (
            <button key={h} type="button" onClick={() => onChange({ ...form, holes: h })}
              className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-all ${
                form.holes === h
                  ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                  : "border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20"
              }`}>
              {h} Holes
            </button>
          ))}
        </div>
      </Field>
      <Field label="Date">
        <input type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })}
          className={inputCls} required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Score" hint="Total strokes">
          <input type="number" placeholder={form.holes === "9" ? "e.g. 42" : "e.g. 84"} value={form.score} min={15} max={200}
            onChange={(e) => onChange({ ...form, score: e.target.value })} className={inputCls} required />
        </Field>
        <Field label="Putts" hint="Total putts">
          <input type="number" placeholder={form.holes === "9" ? "e.g. 15" : "e.g. 30"} value={form.putts} min={5} max={80}
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
const MAX_FILE_SIZE  = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function StepCourse({ courses, selectedId, newCourse, imageFile, holes, nineHoleType, onSelectId, onNewCourse, onImageFile, onNineHoleType, onBack, onSubmit, submitting }: {
  courses: Course[];
  selectedId: string;
  newCourse: NewCourseForm;
  imageFile: File | null;
  holes: "9" | "18";
  nineHoleType: "front" | "back" | "";
  onSelectId: (id: string) => void;
  onNewCourse: (f: NewCourseForm) => void;
  onImageFile: (f: File | null) => void;
  onNineHoleType: (t: "front" | "back" | "") => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const isNew = selectedId === "new";
  const selectedCourse = courses.find((c) => c.id === selectedId);
  const has9HData = !!(selectedCourse?.front_rating || selectedCourse?.back_rating || selectedCourse?.front_par || selectedCourse?.back_par);

  return (
    <motion.form key="step2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (isNew && (!newCourse.name.trim() || !newCourse.city.trim() || !newCourse.par || !newCourse.rating || !newCourse.slope)) return;
        onSubmit();
      }}
      className="flex flex-col gap-5">
      <Field label="Course">
        <select value={selectedId} onChange={(e) => { onSelectId(e.target.value); onNineHoleType(""); }} className={selectCls} required>
          <option value="" disabled>Select a course...</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
          <option value="new">+ Add a new course</option>
        </select>
      </Field>

      {holes === "9" && has9HData && (
        <Field label="Which 9?">
          <div className="flex gap-2">
            {(["front", "back"] as const).map((side) => (
              <button key={side} type="button" onClick={() => onNineHoleType(side)}
                className={`flex-1 rounded-xl border py-3 text-sm font-bold capitalize transition-all ${
                  nineHoleType === side
                    ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                    : "border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20"
                }`}>
                {side} 9
              </button>
            ))}
          </div>
        </Field>
      )}

      <AnimatePresence>
        {isNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="flex flex-col gap-4 pt-1 border-t border-white/8 mt-1">
              <p className="text-xs text-white/30 pt-3">Enter the details for the new course. It will be saved to your course list.</p>
              <Field label="Course Name">
                <CourseSearch
                  value={newCourse.name}
                  onChange={(v) => onNewCourse({ ...newCourse, name: v })}
                  onSelect={({ name, city }) => onNewCourse({ ...newCourse, name, city })}
                  required={isNew}
                />
              </Field>
              <Field label="City / Location">
                <input
                  type="text"
                  placeholder="e.g. Kohler, WI"
                  value={newCourse.city}
                  onChange={(e) => onNewCourse({ ...newCourse, city: e.target.value })}
                  className={inputCls}
                  required={isNew}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "par",    label: "Par",    placeholder: "72",   min: "60",  max: "80",  step: "1"   },
                  { key: "rating", label: "Rating", placeholder: "71.5", min: "50",  max: "80",  step: "0.1" },
                  { key: "slope",  label: "Slope",  placeholder: "131",  min: "55",  max: "155", step: "1"   },
                ].map((f) => (
                  <Field key={f.key} label={f.label}>
                    <input
                      type="number"
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={newCourse[f.key as keyof NewCourseForm]}
                      onChange={(e) => onNewCourse({ ...newCourse, [f.key]: e.target.value })}
                      onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                      className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      required={isNew}
                    />
                  </Field>
                ))}
              </div>
              {/* Image upload */}
              <Field label="Course Image" hint="optional · JPG, PNG, WEBP up to 5 MB">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) return;
                      onImageFile(file);
                    }}
                  />
                  {imageFile ? (
                    <div className="relative rounded-xl overflow-hidden h-28 border border-white/10 group">
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
const DEFAULT_ROUND: RoundForm = { date: TODAY, score: "", putts: "", holes: "18", nineHoleType: "" };

export default function LogRoundPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  const [courses, setCourses]         = useState<Course[]>([]);
  const [step, setStep]               = useState<0 | 1 | 2>(0);
  const [roundForm, setRoundForm]     = useState<RoundForm>(DEFAULT_ROUND);
  const [selectedId, setSelectedId]   = useState("");
  const [newCourse, setNewCourse]     = useState<NewCourseForm>(EMPTY_NEW_COURSE);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [savedCourse, setSavedCourse] = useState<Course | null>(null);

  useEffect(() => {
    supabase.from("courses").select("*").order("name").then(({ data }) => setCourses(data ?? []));
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    let courseId = selectedId;
    let resolved: Course | undefined = courses.find((c) => c.id === selectedId);

    try {
      // If adding a new course, insert it first
      if (selectedId === "new") {
        let image = toImageSlug(newCourse.name.trim());
        if (imageFile) {
          const ext      = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const filePath = `${toImageSlug(newCourse.name.trim())}-${Date.now()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("courses-images")
            .upload(filePath, imageFile, { upsert: true });
          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from("courses-images")
              .getPublicUrl(uploadData.path);
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
        if (created) {
          setCourses((prev) => [...prev, created]);
          courseId = created.id;
          resolved = created;
        }
      }

      const coursePar   = resolved?.par ?? 72;
      const courseRating = resolved?.rating ?? 72;
      const courseSlope  = resolved?.slope ?? 113;
      const holesPlayed  = Number(roundForm.holes) as 9 | 18;
      const score        = Number(roundForm.score);

      let parForRound = holesPlayed === 9 ? Math.round(coursePar / 2) : coursePar;
      let nineHoleType: string | null = null;
      let rating = courseRating;
      let slope  = courseSlope;

      if (holesPlayed === 9 && roundForm.nineHoleType) {
        nineHoleType = roundForm.nineHoleType;
        if (roundForm.nineHoleType === "front") {
          parForRound = resolved?.front_par    ?? Math.round(coursePar / 2);
          rating      = resolved?.front_rating ?? courseRating / 2;
          slope       = resolved?.front_slope  ?? courseSlope;
        } else {
          parForRound = resolved?.back_par    ?? Math.round(coursePar / 2);
          rating      = resolved?.back_rating ?? courseRating / 2;
          slope       = resolved?.back_slope  ?? courseSlope;
        }
      } else if (holesPlayed === 9) {
        rating = courseRating / 2;
      }

      const handicap = Math.round((score - rating) * 113 / slope * 10) / 10;

      const insertData: Record<string, unknown> = {
        date:      roundForm.date,
        course_id: courseId,
        score,
        par:       parForRound,
        holes:     holesPlayed,
        putts:     Number(roundForm.putts),
        handicap,
      };
      if (nineHoleType) insertData.nine_hole_type = nineHoleType;

      const { error: roundError } = await supabase.from("rounds").insert(insertData);

      if (roundError) throw new Error("Failed to save round");

      await fetch("/api/cache/invalidate", { method: "POST" });

      setSavedCourse(resolved ?? null);
      setSubmitting(false);
      setStep(2);
    } catch (err) {
      console.error("Log round failed:", err);
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function handleLogAnother() {
    setStep(0);
    setRoundForm(DEFAULT_ROUND);
    setSelectedId("");
    setNewCourse(EMPTY_NEW_COURSE);
    setImageFile(null);
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
              imageFile={imageFile}
              holes={roundForm.holes}
              nineHoleType={roundForm.nineHoleType}
              onSelectId={setSelectedId}
              onNewCourse={setNewCourse}
              onImageFile={setImageFile}
              onNineHoleType={(t) => setRoundForm((f) => ({ ...f, nineHoleType: t }))}
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
