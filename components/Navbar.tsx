"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { label: "Home",      href: "/"         },
  { label: "Rounds",    href: "/rounds"   },
  { label: "Stats",     href: "/stats"    },
  { label: "Courses",   href: "/courses"  },
  { label: "Clubs",     href: "/clubs"    },
  { label: "Log Round", href: "/log-round"},
];

export default function Navbar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const { session, loading, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-md shadow-lg"
      >
        {navLinks.map((link) => {
          const isActive   = pathname === link.href;
          const isLogRound = link.label === "Log Round";

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`
                relative px-4 py-1.5 rounded-full text-sm transition-all duration-200
                ${isLogRound
                  ? "bg-[#c9a84c] text-black font-medium hover:bg-[#d4b86a] ml-2"
                  : isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/90"
                }
              `}
            >
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

      {/* Auth control — discreet, outside the main pill */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {session ? (
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all"
            >
              {/* Lock-open icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            </button>
          ) : (
            <Link
              href="/login"
              title="Sign in"
              className="flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/20 hover:text-white/60 hover:border-white/25 transition-all"
            >
              {/* Lock icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
