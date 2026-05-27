/**
 * Application navigation bar.
 *
 * Renders two separate layouts that are toggled by screen width:
 *  - Mobile (< sm): a fixed top bar with a hamburger menu that slides down a full-screen link list.
 *  - Desktop (≥ sm): a floating pill centered at the top of the viewport with Framer Motion
 *    layout animation (`layoutId="pill-indicator"`) that slides the active indicator between links.
 *
 * Auth state determines visibility of the lock icon (sign-in) vs. lock-open icon (sign-out).
 * The "Log Round" link is styled as a gold CTA pill rather than a plain nav item.
 *
 * The mobile overlay (`fixed inset-0 z-30`) closes the menu when the user taps outside it.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { label: "Home",      href: "/"         },
  { label: "Rounds",    href: "/rounds"   },
  { label: "Stats",     href: "/stats"    },
  { label: "Courses",   href: "/courses"  },
  { label: "Clubs",     href: "/clubs"     },
  { label: "Scrambles", href: "/scrambles"},
  { label: "Log Round", href: "/log-round" },
];

const LockOpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { session, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    setOpen(false);
  }

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 h-14 z-50 flex items-center justify-between px-5 bg-black/80 backdrop-blur-md border-b border-white/10 sm:hidden">
        <Link href="/" onClick={() => setOpen(false)}
          className="text-white font-bold text-sm tracking-[0.2em] uppercase">
          Golf
        </Link>
        <div className="flex items-center gap-4">
          {!loading && (session ? (
            <button onClick={handleSignOut} title="Sign out" className="text-white/40 hover:text-white transition-colors">
              <LockOpenIcon />
            </button>
          ) : (
            <Link href="/login" title="Sign in" onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
              <LockIcon />
            </Link>
          ))}
          <button onClick={() => setOpen((v) => !v)} className="text-white/60 hover:text-white transition-colors p-0.5" aria-label="Menu">
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile slide-down menu ───────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30 sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.nav
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="fixed top-14 inset-x-0 z-40 bg-[#0a0a0a]/98 backdrop-blur-md border-b border-white/10 sm:hidden"
            >
              {navLinks.map((link) => {
                const isActive   = pathname === link.href;
                const isLogRound = link.label === "Log Round";
                return (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                    className={`flex items-center justify-between px-6 py-4 text-sm font-medium border-b border-white/6 last:border-0 transition-colors active:bg-white/5 ${
                      isLogRound ? "text-[#c9a84c]" : isActive ? "text-white" : "text-white/50"
                    }`}>
                    {link.label}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />}
                  </Link>
                );
              })}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop floating pill ────────────────────────────────────────────── */}
      <div className="hidden sm:flex fixed top-6 left-1/2 -translate-x-1/2 z-50 items-center gap-3">
        <motion.nav
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-md shadow-lg"
        >
          {navLinks.map((link) => {
            const isActive   = pathname === link.href;
            const isLogRound = link.label === "Log Round";
            return (
              <Link key={link.href} href={link.href}
                className={`relative px-4 py-1.5 rounded-full text-sm transition-all duration-200 ${
                  isLogRound
                    ? "bg-[#c9a84c] text-black font-medium hover:bg-[#d4b86a] ml-2"
                    : isActive ? "text-white" : "text-white/50 hover:text-white/90"
                }`}>
                {isActive && !isLogRound && (
                  <motion.span
                    layoutId="pill-indicator"
                    className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </motion.nav>

        {!loading && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            {session ? (
              <button onClick={handleSignOut} title="Sign out"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all">
                <LockOpenIcon />
              </button>
            ) : (
              <Link href="/login" title="Sign in"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/20 hover:text-white/60 hover:border-white/25 transition-all">
                <LockIcon />
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
}
