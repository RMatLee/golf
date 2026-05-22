"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { HomeStats, RecentRound } from "@/app/api/home/route";

export default function Home() {
  const [stats, setStats] = useState<HomeStats>({
    lastScore:    "—",
    lastCourse:   "—",
    handicap:     "—",
    roundsPlayed: "—",
  });

  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home")
      .then((r) => r.json())
      .then(({ stats, recentRounds }) => {
        setStats(stats);
        setRecentRounds(recentRounds);
        setLoading(false);
      });
  }, []);

  const statStrip = [
    { label: "Last Score",    value: stats.lastScore    },
    { label: "Last Course",   value: stats.lastCourse   },
    { label: "Handicap",      value: stats.handicap     },
    { label: "Rounds Played", value: stats.roundsPlayed },
  ];

  return (
    <main className="bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/videos/golf-course.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            className="text-[#c9a84c] uppercase tracking-[0.3em] text-sm mb-4">
            Personal Golf Tracker
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
            className="text-5xl md:text-7xl font-light tracking-wide mb-6">
            Come Follow Ryan&apos;s Growth
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}
            className="text-white/60 text-lg max-w-md">
            Tracking my rounds, monitor my progress, and own my game.
          </motion.p>
        </div>
      </section>

      {/* Stat Strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-t border-white/10">
        {statStrip.map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center py-10 border-r border-white/10 last:border-r-0">
            <span className="text-3xl font-light text-[#c9a84c]">{stat.value}</span>
            <span className="text-white/40 uppercase tracking-widest text-xs mt-2">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* Recent Rounds */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.h2 initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6 }} className="text-3xl font-light mb-12 border-l-2 border-[#c9a84c] pl-4">
          Recent Rounds
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse h-36" />
              ))
            : recentRounds.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#c9a84c]/50 transition-colors">
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-2">No rounds yet</p>
                  <p className="text-white/60 text-sm">Log your first round to get started.</p>
                </motion.div>
              ))
            : recentRounds.map((round, i) => {
                const diff  = round.score - round.par;
                const label = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
                const color = diff <= 0 ? "text-emerald-400" : "text-red-400";
                const date  = new Date(round.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <motion.div key={round.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#c9a84c]/50 transition-colors">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-1">{date}</p>
                    <p className="text-white font-semibold mb-3">{round.course}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white">{round.score}</span>
                      <span className={`text-lg font-bold mb-0.5 ${color}`}>{label}</span>
                    </div>
                  </motion.div>
                );
              })
          }
        </div>
      </section>
    </main>
  );
}
