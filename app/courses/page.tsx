"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  name: string;
  city: string;
  par: number;
  rating: number;
  slope: number;
  image: string; // e.g. "whitnall-park"
}

interface Round {
  id: string;
  date: string;
  courseId: string;
  score: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_COURSES: Course[] = [
  { id: "1", name: "Whitnall Park",   city: "Hales Corners, WI", par: 72, rating: 69.8, slope: 121, image: "whitnall-park"   },
  { id: "2", name: "Brown Deer Park", city: "Milwaukee, WI",      par: 71, rating: 68.4, slope: 118, image: "brown-deer-park" },
  { id: "3", name: "Oakwood Park",    city: "Franklin, WI",       par: 72, rating: 70.1, slope: 124, image: "oakwood-park"    },
  { id: "4", name: "Dretzka Park",    city: "Milwaukee, WI",      par: 72, rating: 69.2, slope: 119, image: "dretzka-park"    },
  { id: "5", name: "Tuckaway CC",     city: "Franklin, WI",       par: 72, rating: 72.4, slope: 135, image: "tuckaway-cc"     },
];

const SEED_ROUNDS: Round[] = [
  { id: "1",  date: "2024-03-02", courseId: "1", score: 94 },
  { id: "2",  date: "2024-03-15", courseId: "2", score: 91 },
  { id: "3",  date: "2024-04-01", courseId: "3", score: 96 },
  { id: "4",  date: "2024-04-18", courseId: "4", score: 89 },
  { id: "5",  date: "2024-05-03", courseId: "1", score: 92 },
  { id: "6",  date: "2024-05-20", courseId: "2", score: 88 },
  { id: "7",  date: "2024-06-05", courseId: "5", score: 90 },
  { id: "8",  date: "2024-06-22", courseId: "3", score: 86 },
  { id: "9",  date: "2024-07-04", courseId: "4", score: 87 },
  { id: "10", date: "2024-07-19", courseId: "1", score: 85 },
  { id: "11", date: "2024-08-02", courseId: "2", score: 83 },
  { id: "12", date: "2024-08-17", courseId: "5", score: 88 },
  { id: "13", date: "2024-09-01", courseId: "3", score: 84 },
  { id: "14", date: "2024-09-14", courseId: "4", score: 82 },
  { id: "15", date: "2024-10-01", courseId: "1", score: 81 },
  { id: "16", date: "2024-10-18", courseId: "2", score: 85 },
  { id: "17", date: "2024-11-02", courseId: "5", score: 80 },
  { id: "18", date: "2025-03-22", courseId: "1", score: 83 },
  { id: "19", date: "2025-04-05", courseId: "3", score: 79 },
  { id: "20", date: "2025-04-20", courseId: "2", score: 78 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function toImageSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const EMPTY_FORM = {
  name: "", city: "", par: "", rating: "", slope: "",
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

function CourseCard({
  course,
  index,
}: {
  course: Course;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="relative overflow-hidden rounded-2xl border border-white/8 hover:border-[#c9a84c]/40 transition-all duration-300 group cursor-default"
      style={{ height: "220px" }}
    >
      {/* Course image */}
      <img
        src={`/images/courses/${course.image}.jpg`}
        alt={course.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

      {/* Gold shimmer on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#c9a84c]/0 to-[#c9a84c]/0 group-hover:from-[#c9a84c]/5 group-hover:to-transparent transition-all duration-300" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        {/* Rating / slope pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60">
            {course.rating} / {course.slope}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60">
            Par {course.par}
          </span>
        </div>

        {/* Name + city */}
        <h3 className="text-lg font-bold text-white leading-tight tracking-tight">
          {course.name}
        </h3>
        <p className="text-xs text-white/45 mt-0.5">{course.city}</p>
      </div>
    </motion.div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function CourseModal({
  isOpen,
  editTarget,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  editTarget: Course | null;
  onClose: () => void;
  onSave: (data: Omit<Course, "id">, id?: string) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = editTarget?.id ?? "new";

  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      editTarget
        ? {
            name:   editTarget.name,
            city:   editTarget.city,
            par:    String(editTarget.par),
            rating: String(editTarget.rating),
            slope:  String(editTarget.slope),
          }
        : EMPTY_FORM
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(
      {
        name:   form.name.trim(),
        city:   form.city.trim(),
        par:    Number(form.par)    || 72,
        rating: Number(form.rating) || 0,
        slope:  Number(form.slope)  || 113,
        image:  toImageSlug(form.name.trim()),
      },
      editTarget?.id
    );
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-7">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">
                {editTarget ? "Edit Course" : "New Course"}
              </p>
              <h2 className="text-xl font-bold text-white mb-2">
                {editTarget ? editTarget.name : "Add a Course"}
              </h2>
              {!editTarget && (
                <p className="text-xs text-white/30 mb-6">
                  Add an image named{" "}
                  <span className="font-mono text-white/50">
                    {form.name ? `${toImageSlug(form.name)}.jpg` : "your-course-name.jpg"}
                  </span>{" "}
                  to <span className="font-mono text-white/50">public/images/courses/</span>
                </p>
              )}
              {editTarget && <div className="mb-6" />}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">
                    Course Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Whistling Straits"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">
                    City / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kohler, WI"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "par",    label: "Par",    placeholder: "72"   },
                    { key: "rating", label: "Rating", placeholder: "71.5" },
                    { key: "slope",  label: "Slope",  placeholder: "131"  },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">
                        {f.label}
                      </label>
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        value={form[f.key as keyof typeof EMPTY_FORM]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-[#c9a84c] py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all"
                  >
                    {editTarget ? "Save Changes" : "Add Course"}
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

function DeleteConfirm({
  course,
  onConfirm,
  onCancel,
}: {
  course: Course;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-7 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-red-400 font-semibold mb-1">
            Remove Course
          </p>
          <h2 className="text-lg font-bold text-white mb-2">{course.name}</h2>
          <p className="text-sm text-white/35 mb-6">
            This will remove the course from your list. Past rounds won&apos;t be affected.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-red-500/80 py-2.5 text-sm font-bold text-white hover:bg-red-500 active:scale-95 transition-all"
            >
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
  const [courses, setCourses]           = useState<Course[]>(SEED_COURSES);
  const [rounds]                        = useState<Round[]>(SEED_ROUNDS);
  const [search, setSearch]             = useState("");
  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  const stats = useCourseStats(courses, rounds);

  // 3 most recently played courses (deduplicated)
  const recentCourses = useMemo(() => {
    const seen = new Set<string>();
    const result: Course[] = [];
    const sorted = [...rounds].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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

  // Filtered table rows
  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return stats.filter(
      (s) =>
        s.course.name.toLowerCase().includes(q) ||
        s.course.city.toLowerCase().includes(q)
    );
  }, [stats, search]);

  function handleSave(data: Omit<Course, "id">, id?: string) {
    if (id) {
      setCourses((prev) => prev.map((c) => (c.id === id ? { ...data, id } : c)));
    } else {
      setCourses((prev) => [...prev, { ...data, id: uid() }]);
    }
  }

  function handleDelete(id: string) {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-5 pt-28 pb-24">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">
              Courses
            </p>
            <h1 className="text-4xl font-bold tracking-tight">My Courses</h1>
            <p className="text-sm text-white/30 mt-1.5">
              {courses.length} courses · {rounds.length} rounds logged
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all"
          >
            <span className="text-base leading-none">+</span>
            Add Course
          </button>
        </motion.div>

        {/* Recently played */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3"
        >
          Recently Played
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {recentCourses.map((course, i) => (
            <CourseCard key={course.id} course={course} index={i} />
          ))}
        </div>

        {/* All courses table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">
              All Courses
            </p>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                width="12" height="12" viewBox="0 0 13 13" fill="none"
              >
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/4 pl-8 pr-4 py-2 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors w-52"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1.5fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/6 bg-white/2">
              {["Course", "Location", "Par", "Best", "Played", "Rating / Slope"].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-widest text-white/25 last:text-right">
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            <AnimatePresence mode="popLayout">
              {tableRows.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-white/25 italic px-5 py-8 text-center"
                >
                  No courses match your search.
                </motion.p>
              ) : (
                tableRows.map((row, i) => {
                  const { course, timesPlayed, bestScore } = row;
                  return (
                    <motion.div
                      key={course.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="grid grid-cols-[2fr_1.5fr_auto_auto_auto_auto] gap-4 px-5 py-4 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors group items-center"
                    >
                      <p className="text-sm font-semibold text-white truncate">{course.name}</p>
                      <p className="text-xs text-white/40 truncate">{course.city}</p>
                      <p className="text-sm text-white/70 tabular-nums">{course.par}</p>
                      <p className="text-sm font-bold text-[#c9a84c] tabular-nums">
                        {bestScore ?? "--"}
                      </p>
                      <p className="text-sm text-white/50 tabular-nums">{timesPlayed}x</p>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-white/35 tabular-nums">
                          {course.rating} / {course.slope}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <button
                            onClick={() => { setEditTarget(course); setModalOpen(true); }}
                            className="px-2 py-1 rounded-lg text-xs text-white/40 hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(course)}
                            className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            ✕
                          </button>
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

      <CourseModal
        isOpen={modalOpen}
        editTarget={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirm
            course={deleteTarget}
            onConfirm={() => handleDelete(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}