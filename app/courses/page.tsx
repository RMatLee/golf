/**
 * Course Library page — displays recently-played course cards and a full CRUD table.
 *
 * Fetches courses and rounds directly from Supabase on mount (no API route intermediary).
 * The `useCourseStats` hook joins the two datasets to produce per-course play statistics.
 *
 * Admin controls (Add/Edit/Delete) are rendered only when `isAdmin` (`session !== null`).
 * All writes use the authenticated user's Supabase session; RLS on the `courses` table
 * rejects unauthenticated mutations. Course images are uploaded to the `course-images`
 * storage bucket and their public URL is stored in the `image` column.
 *
 * Duplicate prevention: `isDuplicate(name)` performs a case-insensitive check against
 * existing course names before an insert, surfacing a toast error instead of allowing
 * Supabase to return a constraint violation.
 *
 * Recently played: iterates rounds sorted newest-first, deduplicating by course ID,
 * to find the 3 most recently played distinct courses.
 */
"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CourseSearch } from "@/components/CourseSearch";
import { toast } from "sonner";
import type { CourseRow } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = CourseRow;
interface Round { id: string; date: string; courseId: string; score: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toImageSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const EMPTY_FORM = {
  name: "", city: "", par: "", rating: "", slope: "",
  front_par: "", front_rating: "", front_slope: "",
  back_par: "",  back_rating: "",  back_slope: "",
};

// ─── Per-course derived stats ─────────────────────────────────────────────────

function useCourseStats(courses: Course[], rounds: Round[]) {
  return useMemo(() => {
    return courses.map((c) => {
      const played = rounds
        .filter((r) => r.courseId === c.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const scores = played.map((r) => r.score);
      return {
        course: c,
        timesPlayed: played.length,
        bestScore: scores.length ? Math.min(...scores) : null,
        lastPlayed: played[0]?.date ?? null,
      };
    });
  }, [courses, rounds]);
}

// ─── Recent Course Card ───────────────────────────────────────────────────────

function courseImageSrc(image: string): string {
  if (!image) return "";
  return image.startsWith("http") ? image : "";
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = course.image ? courseImageSrc(course.image) : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="relative overflow-hidden rounded-2xl border border-white/8 hover:border-[#c9a84c]/40 transition-all duration-300 group cursor-default"
      style={{ height: "220px" }}
    >
      {!imgError && imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={course.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/2" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#c9a84c]/0 to-[#c9a84c]/0 group-hover:from-[#c9a84c]/5 group-hover:to-transparent transition-all duration-300" />
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60">
            {course.rating} / {course.slope}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60">
            Par {course.par}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white leading-tight tracking-tight">{course.name}</h3>
        <p className="text-xs text-white/45 mt-0.5">{course.city}</p>
      </div>
    </motion.div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function CourseModal({
  isOpen, editTarget, existingCourses, onClose, onSave,
}: {
  isOpen: boolean;
  editTarget: Course | null;
  existingCourses: Course[];
  onClose: () => void;
  onSave: (data: Omit<Course, "id" | "created_at">, id?: string) => void;
}) {
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [show9Hole, setShow9Hole]       = useState(false);
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading]       = useState(false);
  const [fileError, setFileError]       = useState("");
  const [lastKey, setLastKey]           = useState<string | null>(null);
  const key = editTarget?.id ?? "new";

  // True when the typed name matches an existing course (excluding the one being edited)
  const isDuplicate = form.name.trim().length > 0 && existingCourses.some(
    (c) => c.id !== editTarget?.id && c.name.toLowerCase() === form.name.trim().toLowerCase()
  );

  if (key !== lastKey) {
    setLastKey(key);
    const has9Hole = !!(editTarget?.front_par || editTarget?.front_rating || editTarget?.front_slope || editTarget?.back_par || editTarget?.back_rating || editTarget?.back_slope);
    setShow9Hole(has9Hole);
    setForm(
      editTarget
        ? {
            name: editTarget.name, city: editTarget.city,
            par: String(editTarget.par), rating: String(editTarget.rating), slope: String(editTarget.slope),
            front_par:    editTarget.front_par    != null ? String(editTarget.front_par)    : "",
            front_rating: editTarget.front_rating != null ? String(editTarget.front_rating) : "",
            front_slope:  editTarget.front_slope  != null ? String(editTarget.front_slope)  : "",
            back_par:     editTarget.back_par     != null ? String(editTarget.back_par)     : "",
            back_rating:  editTarget.back_rating  != null ? String(editTarget.back_rating)  : "",
            back_slope:   editTarget.back_slope   != null ? String(editTarget.back_slope)   : "",
          }
        : EMPTY_FORM
    );
    setImageFile(null);
    setFileError("");
    setImagePreview(editTarget?.image ? courseImageSrc(editTarget.image) : "");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Only JPG, PNG, WEBP, or GIF files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File must be under 5 MB.");
      return;
    }
    setFileError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setUploading(true);

    let image = editTarget?.image ?? toImageSlug(form.name.trim());

    if (imageFile) {
      const ext      = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${toImageSlug(form.name.trim())}-${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("courses-images")
        .upload(filePath, imageFile, { upsert: true });

      if (uploadError) {
        setUploading(false);
        toast.error(`Image upload failed: ${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("courses-images")
        .getPublicUrl(uploadData.path);
      image = publicUrl;
    }

    setUploading(false);
    onSave(
      {
        name:   form.name.trim(),
        city:   form.city.trim(),
        par:    Number(form.par)    || 72,
        rating: Number(form.rating) || 0,
        slope:  Number(form.slope)  || 113,
        image,
        front_par:    form.front_par    ? Number(form.front_par)    : null,
        front_rating: form.front_rating ? Number(form.front_rating) : null,
        front_slope:  form.front_slope  ? Number(form.front_slope)  : null,
        back_par:     form.back_par     ? Number(form.back_par)     : null,
        back_rating:  form.back_rating  ? Number(form.back_rating)  : null,
        back_slope:   form.back_slope   ? Number(form.back_slope)   : null,
      },
      editTarget?.id
    );
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4 max-h-[90svh] overflow-y-auto overscroll-contain"
          >
            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-7">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">
                {editTarget ? "Edit Course" : "New Course"}
              </p>
              <h2 className="text-xl font-bold text-white mb-6">
                {editTarget ? editTarget.name : "Add a Course"}
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Course Name</label>
                  <CourseSearch
                    value={form.name}
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    onSelect={({ name, city }) => setForm((f) => ({ ...f, name, city }))}
                    required
                  />
                  {isDuplicate && (
                    <p className="text-xs text-red-400 mt-1.5">
                      A course named &quot;{form.name.trim()}&quot; already exists.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">City / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Kohler, WI"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "par",    label: "Par",    placeholder: "72",   min: "60",  max: "80",  step: "1"   },
                    { key: "rating", label: "Rating", placeholder: "71.5", min: "50",  max: "80",  step: "0.1" },
                    { key: "slope",  label: "Slope",  placeholder: "131",  min: "55",  max: "155", step: "1"   },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">{f.label}</label>
                      <input
                        type="number"
                        placeholder={f.placeholder}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={form[f.key as keyof typeof EMPTY_FORM]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        required
                      />
                    </div>
                  ))}
                </div>

                {/* 9-Hole Details */}
                <div>
                  <button type="button" onClick={() => setShow9Hole((v) => !v)}
                    className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors">
                    <span>9-Hole Details</span>
                    <span className="text-white/20 normal-case tracking-normal">(optional)</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                      className={`transition-transform ${show9Hole ? "rotate-180" : ""}`}>
                      <path d="M5 7L1 3h8L5 7z"/>
                    </svg>
                  </button>
                  <AnimatePresence>
                    {show9Hole && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/8">
                          {[
                            { prefix: "front", label: "Front 9" },
                            { prefix: "back",  label: "Back 9"  },
                          ].map(({ prefix, label }) => (
                            <div key={prefix}>
                              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">{label}</p>
                              <div className="flex flex-col gap-2">
                                {[
                                  { key: `${prefix}_par`,    label: "Par",    placeholder: "36",   min: "27", max: "45", step: "1"   },
                                  { key: `${prefix}_rating`, label: "Rating", placeholder: "35.5", min: "25", max: "45", step: "0.1" },
                                  { key: `${prefix}_slope`,  label: "Slope",  placeholder: "121",  min: "55", max: "155", step: "1"   },
                                ].map((f) => (
                                  <div key={f.key}>
                                    <label className="block text-[10px] text-white/25 mb-1">{f.label}</label>
                                    <input
                                      type="number" placeholder={f.placeholder} min={f.min} max={f.max} step={f.step}
                                      value={form[f.key as keyof typeof EMPTY_FORM]}
                                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                      onKeyDown={(e) => ["e","E","+","-"].includes(e.key) && e.preventDefault()}
                                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Image upload */}
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">
                    Course Image
                    <span className="ml-2 normal-case tracking-normal text-white/20">(optional)</span>
                  </label>
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    {imagePreview ? (
                      <div className="relative rounded-xl overflow-hidden h-32 border border-white/10 group">
                        <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-white font-medium">Click to change</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/15 bg-white/3 h-24 flex flex-col items-center justify-center gap-1.5 hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-all">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-xs text-white/35">Click to upload</span>
                        <span className="text-[10px] text-white/20">JPG, PNG, WEBP up to 5 MB</span>
                      </div>
                    )}
                  </label>
                  {fileError && <p className="text-xs text-red-400 mt-1.5">{fileError}</p>}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!form.name.trim() || !form.city.trim() || !form.par || !form.rating || !form.slope || uploading || isDuplicate}
                    className="flex-1 rounded-xl bg-[#c9a84c] py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {uploading ? "Uploading…" : editTarget ? "Save Changes" : "Add Course"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ course, onConfirm, onCancel }: { course: Course; onConfirm: () => void; onCancel: () => void; }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-7 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-red-400 font-semibold mb-1">Remove Course</p>
          <h2 className="text-lg font-bold text-white mb-2">{course.name}</h2>
          <p className="text-sm text-white/35 mb-6">This will remove the course from your list. Past rounds won&apos;t be affected.</p>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 rounded-xl bg-red-500/80 py-2.5 text-sm font-bold text-white hover:bg-red-500 active:scale-95 transition-all">
              Remove
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { session } = useAuth();
  const isAdmin = !!session;

  const [courses, setCourses]           = useState<Course[]>([]);
  const [rounds, setRounds]             = useState<Round[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  // ── Fetch data on mount ──
  useEffect(() => {
    async function load() {
      const [{ data: courseData }, { data: roundData }] = await Promise.all([
        supabase.from("courses").select("*").order("name"),
        supabase.from("rounds").select("id, date, course_id, score"),
      ]);
      setCourses(courseData ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRounds((roundData ?? []).map((r: any) => ({
        id:       r.id,
        date:     r.date,
        courseId: r.course_id ?? "",
        score:    r.score,
      })));
      setLoading(false);
    }
    load();
  }, []);

  const stats = useCourseStats(courses, rounds);

  const recentCourses = useMemo(() => {
    const seen = new Set<string>();
    const result: Course[] = [];
    const sorted = [...rounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const round of sorted) {
      if (!seen.has(round.courseId)) {
        seen.add(round.courseId);
        const course = courses.find((c) => c.id === round.courseId);
        if (course) result.push(course);
      }
      if (result.length === 3) break;
    }
    return result;
  }, [courses, rounds]);

  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return stats.filter((s) => s.course.name.toLowerCase().includes(q) || s.course.city.toLowerCase().includes(q));
  }, [stats, search]);

  async function handleSave(data: Omit<Course, "id" | "created_at">, id?: string) {
    try {
      if (id) {
        const { data: updated, error } = await supabase.from("courses").update(data).eq("id", id).select().single();
        if (error) throw error;
        if (updated) setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
        toast.success("Course updated");
      } else {
        const { data: created, error } = await supabase.from("courses").insert(data).select().single();
        if (error) throw error;
        if (created) setCourses((prev) => [...prev, created]);
        toast.success("Course added");
      }
    } catch (err) {
      console.error("Course save failed:", err);
      toast.error("Failed to save course. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setDeleteTarget(null);
      toast.success("Course removed");
    } catch (err) {
      console.error("Course delete failed:", err);
      toast.error("Failed to remove course. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-20 sm:pt-28 pb-24">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Courses</p>
            <h1 className="text-4xl font-bold tracking-tight">My Courses</h1>
            <p className="text-sm text-white/30 mt-1.5">
              {loading ? "Loading…" : `${courses.length} courses · ${rounds.length} rounds logged`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all"
            >
              <span className="text-base leading-none">+</span>
              Add Course
            </button>
          )}
        </motion.div>

        {/* Recently played */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3">
          Recently Played
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/8 bg-white/3 animate-pulse" style={{ height: "220px" }} />
              ))
            : recentCourses.map((course, i) => <CourseCard key={course.id} course={course} index={i} />)
          }
        </div>

        {/* All courses table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">All Courses</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" width="12" height="12" viewBox="0 0 13 13" fill="none">
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search courses..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/4 pl-8 pr-4 py-2 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors w-full sm:w-52" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 overflow-hidden">

            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-[2fr_1.5fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/6 bg-white/2">
              {["Course", "Location", "Par", "Best", "Played", "Rating / Slope"].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-widest text-white/25 last:text-right">{h}</span>
              ))}
            </div>

            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-white/25 italic px-5 py-8 text-center">
                  Loading courses…
                </motion.p>
              ) : tableRows.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm text-white/25 italic px-5 py-8 text-center">
                  No courses match your search.
                </motion.p>
              ) : (
                tableRows.map((row, i) => {
                  const { course, timesPlayed, bestScore } = row;
                  return (
                    <motion.div key={course.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors group">

                      {/* Mobile row */}
                      <div className="sm:hidden flex items-center gap-3 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{course.name}</p>
                          <p className="text-xs text-white/40 truncate mt-0.5">{course.city}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-white/30">Par {course.par}</span>
                            <span className="text-[11px] text-white/30">{course.rating}/{course.slope}</span>
                            {bestScore && <span className="text-[11px] text-[#c9a84c] font-bold">Best {bestScore}</span>}
                            <span className="text-[11px] text-white/30">{timesPlayed}x</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditTarget(course); setModalOpen(true); }}
                              className="px-3 py-1.5 rounded-lg text-xs text-white/50 bg-white/5 hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors">
                              Edit
                            </button>
                            <button onClick={() => setDeleteTarget(course)}
                              className="px-3 py-1.5 rounded-lg text-xs text-white/40 bg-white/5 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[2fr_1.5fr_auto_auto_auto_auto] gap-4 px-5 py-4 items-center">
                        <p className="text-sm font-semibold text-white truncate">{course.name}</p>
                        <p className="text-xs text-white/40 truncate">{course.city}</p>
                        <p className="text-sm text-white/70 tabular-nums">{course.par}</p>
                        <p className="text-sm font-bold text-[#c9a84c] tabular-nums">{bestScore ?? "--"}</p>
                        <p className="text-sm text-white/50 tabular-nums">{timesPlayed}x</p>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-white/35 tabular-nums">{course.rating} / {course.slope}</span>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                              <button onClick={() => { setEditTarget(course); setModalOpen(true); }}
                                className="px-2 py-1 rounded-lg text-xs text-white/40 hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors">
                                Edit
                              </button>
                              <button onClick={() => setDeleteTarget(course)}
                                className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {tableRows.length > 0 && (
            <p className="text-xs text-white/20 mt-3 text-right">
              {tableRows.length} {tableRows.length === 1 ? "course" : "courses"}
            </p>
          )}
        </motion.div>
      </div>

      <CourseModal isOpen={modalOpen} editTarget={editTarget} existingCourses={courses} onClose={() => setModalOpen(false)} onSave={handleSave} />

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirm course={deleteTarget} onConfirm={() => handleDelete(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
