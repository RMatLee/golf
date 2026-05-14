"use client"; // Required for hooks

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Rounds", href: "/rounds" },
  { label: "Stats", href: "/stats" },
  { label: "Courses", href: "/courses" },
  { label: "Clubs", href: "/clubs" },
  { label: "Log Round", href: "/log-round" },
];

export default function Navbar() {
  // Gets the current route path so we can highlight the active link
  const pathname = usePathname();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      {/* animates the entire pill fading in and sliding down on page load */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-md shadow-lg"
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
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
    </div>
  );
}