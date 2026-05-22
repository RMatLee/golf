"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { ClubType } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Club { id: string; name: string; type: ClubType; carry: string; loft: string; shaft: string; }

// ─── Config ───────────────────────────────────────────────────────────────────

type SectionMedia = { kind: "video"; src: string } | { kind: "image"; src: string };

const CLUB_SECTIONS: { type: ClubType; media: SectionMedia; label: string; subtitle: string }[] = [
  { type: "Driver",        media: { kind: "video", src: "/videos/clubs/driver.mp4" },    label: "Driver",        subtitle: "Off the tee"  },
  { type: "Fairway Woods", media: { kind: "image", src: "/images/clubs/woods.jpg" },     label: "Fairway Woods", subtitle: "Long game"    },
  { type: "Hybrids",       media: { kind: "image", src: "/images/clubs/hybrids.jpg" },   label: "Hybrids",       subtitle: "Versatility"  },
  { type: "Irons",         media: { kind: "image", src: "/images/clubs/irons.jpeg" },    label: "Irons",         subtitle: "Precision"    },
  { type: "Wedges",        media: { kind: "image", src: "/images/clubs/wedges.jpg" },    label: "Wedges",        subtitle: "Short game"   },
  { type: "Putter",        media: { kind: "image", src: "/images/clubs/putter.jpg" },    label: "Putter",        subtitle: "On the green" },
];

const SHAFT_OPTIONS = ["Extra Stiff", "Stiff", "Regular", "Senior", "Ladies", "Steel", "Graphite"];
const EMPTY_FORM: Omit<Club, "id"> = { name: "", type: "Irons", carry: "", loft: "", shaft: "Stiff" };

// ─── Section Background ───────────────────────────────────────────────────────

function SectionBackground({ media, isOpen }: { media: SectionMedia; isOpen: boolean }) {
  const brightness = isOpen ? 0.45 : 0.3;
  if (media.kind === "video") {
    return <video src={media.src} autoPlay muted loop playsInline
      className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
      style={{ filter: `brightness(${brightness})` }} />;
  }
  return <img src={media.src} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
    style={{ filter: `brightness(${brightness})` }} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ClubModal({ isOpen, editTarget, defaultType, onClose, onSave }: {
  isOpen: boolean; editTarget: Club | null; defaultType: ClubType;
  onClose: () => void; onSave: (data: Omit<Club, "id">, id?: string) => void;
}) {
  const [form, setForm] = useState<Omit<Club, "id">>(editTarget ?? { ...EMPTY_FORM, type: defaultType });
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = editTarget?.id ?? "new";
  if (key !== lastKey) {
    setLastKey(key);
    setForm(editTarget ?? { ...EMPTY_FORM, type: defaultType });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4">
            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl p-7">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">
                {editTarget ? "Edit Club" : "New Club"}
              </p>
              <h2 className="text-xl font-bold text-white mb-6">
                {editTarget ? editTarget.name : `Add to ${defaultType}`}
              </h2>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSave(form, editTarget?.id); onClose(); }}
                className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Club Name</label>
                  <input type="text" placeholder="e.g. 7-Iron" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors"
                    required />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClubType })}
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-2.5 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors">
                    {CLUB_SECTIONS.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Carry (yds)</label>
                    <input type="text" placeholder="e.g. 155" value={form.carry}
                      onChange={(e) => setForm({ ...form, carry: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Loft (°)</label>
                    <input type="text" placeholder="e.g. 31" value={form.loft}
                      onChange={(e) => setForm({ ...form, loft: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Shaft Flex</label>
                  <select value={form.shaft} onChange={(e) => setForm({ ...form, shaft: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-2.5 text-sm text-white focus:border-[#c9a84c]/50 focus:outline-none transition-colors">
                    {SHAFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 rounded-xl bg-[#c9a84c] py-2.5 text-sm font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
                    {editTarget ? "Save Changes" : "Add Club"}
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

// ─── Club Row ─────────────────────────────────────────────────────────────────

function ClubRow({ club, onEdit, onDelete }: { club: Club; onEdit: (club: Club) => void; onDelete: (id: string) => void; }) {
  return (
    <motion.div layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-4 px-5 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-default">
      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] opacity-50 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      <span className="text-sm font-medium text-white flex-1">{club.name}</span>
      <div className="hidden sm:flex items-center gap-6 text-xs text-white/40">
        <span className="font-mono tabular-nums w-16 text-right">{club.carry !== "--" ? `${club.carry} yds` : "--"}</span>
        <span className="font-mono tabular-nums w-10 text-right">{club.loft}°</span>
        <span className="w-16">{club.shaft}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(club)}
          className="px-2.5 py-1 rounded-lg text-xs text-white/40 hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(club.id)}
          className="px-2.5 py-1 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
          ✕
        </button>
      </div>
    </motion.div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ section, clubs, isOpen, onToggle, onAdd, onEdit, onDelete }: {
  section: (typeof CLUB_SECTIONS)[number]; clubs: Club[]; isOpen: boolean;
  onToggle: () => void; onAdd: (type: ClubType) => void;
  onEdit: (club: Club) => void; onDelete: (id: string) => void;
}) {
  return (
    <motion.div layout
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isOpen ? "border-[#c9a84c]/40 shadow-[0_0_40px_rgba(201,168,76,0.08)]" : "border-white/8 hover:border-white/15"}`}>
      <div className="relative cursor-pointer select-none" onClick={onToggle} style={{ height: isOpen ? "180px" : "100px" }}>
        <SectionBackground media={section.media} isOpen={isOpen} />
        <div className={`absolute inset-0 transition-all duration-300 ${
          isOpen ? "bg-gradient-to-b from-black/20 via-transparent to-black/80" : "bg-gradient-to-r from-black/60 to-transparent"}`} />
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#c9a84c]/80 font-semibold mb-0.5">{section.subtitle}</p>
            <h3 className="text-xl font-bold text-white tracking-tight">{section.label}</h3>
            {!isOpen && <p className="text-xs text-white/40 mt-0.5">{clubs.length} {clubs.length === 1 ? "club" : "clubs"}</p>}
          </div>
          <div className="flex items-center gap-3">
            {isOpen && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => { e.stopPropagation(); onAdd(section.type); }}
                className="flex items-center gap-1.5 rounded-xl bg-[#c9a84c] px-3.5 py-1.5 text-xs font-bold text-black hover:bg-[#d4b86a] active:scale-95 transition-all">
                + Add
              </motion.button>
            )}
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden bg-[#0d0d0d]">
            <div className="flex items-center gap-4 px-5 pt-4 pb-2 border-b border-white/5">
              <span className="w-1.5 flex-shrink-0" />
              <span className="flex-1 text-[10px] uppercase tracking-widest text-white/25">Club</span>
              <div className="hidden sm:flex items-center gap-6 text-[10px] uppercase tracking-widest text-white/25">
                <span className="w-16 text-right">Carry</span>
                <span className="w-10 text-right">Loft</span>
                <span className="w-16">Shaft</span>
              </div>
              <span className="w-20" />
            </div>
            <div className="py-2">
              <AnimatePresence>
                {clubs.length === 0
                  ? <p className="text-xs text-white/25 italic px-7 py-4">No clubs yet — hit &quot;Add&quot; to get started.</p>
                  : clubs.map((club) => <ClubRow key={club.id} club={club} onEdit={onEdit} onDelete={onDelete} />)
                }
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const [clubs, setClubs]               = useState<Club[]>([]);
  const [loading, setLoading]           = useState(true);
  const [openSection, setOpenSection]   = useState<ClubType | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Club | null>(null);
  const [addingToType, setAddingToType] = useState<ClubType>("Irons");

  useEffect(() => {
    supabase.from("clubs").select("*").order("created_at").then(({ data, error }) => {
      console.log("clubs fetch → data:", data, "error:", error);
      setClubs((data ?? []) as Club[]);
      setLoading(false);
    });
  }, []);

  function toggleSection(type: ClubType) {
    setOpenSection((prev) => (prev === type ? null : type));
  }

  function openAdd(type: ClubType) { setEditTarget(null); setAddingToType(type); setModalOpen(true); }
  function openEdit(club: Club) { setEditTarget(club); setAddingToType(club.type); setModalOpen(true); }

  async function handleSave(data: Omit<Club, "id">, id?: string) {
    const payload = { ...data, type: data.type as string };
    if (id) {
      const { data: updated } = await supabase.from("clubs").update(payload).eq("id", id).select().single();
      if (updated) setClubs((prev) => prev.map((c) => (c.id === id ? (updated as Club) : c)));
    } else {
      const { data: created } = await supabase.from("clubs").insert(payload).select().single();
      if (created) setClubs((prev) => [...prev, created as Club]);
    }
  }

  async function handleDelete(id: string) {
    await supabase.from("clubs").delete().eq("id", id);
    setClubs((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-5 pt-28 pb-24">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold mb-1">Equipment</p>
          <h1 className="text-4xl font-bold tracking-tight">My Bag</h1>
          <p className="text-sm text-white/30 mt-1.5">
            {loading ? "Loading…" : `${clubs.length} clubs · Tap a section to expand`}
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {CLUB_SECTIONS.map((section, i) => (
            <motion.div key={section.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}>
              <SectionCard
                section={section}
                clubs={clubs.filter((c) => c.type === section.type)}
                isOpen={openSection === section.type}
                onToggle={() => toggleSection(section.type)}
                onAdd={openAdd}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <ClubModal isOpen={modalOpen} editTarget={editTarget} defaultType={addingToType}
        onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
