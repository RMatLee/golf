"use client";

import { useState, useEffect, useRef } from "react";
import type { CourseSearchResult } from "@/app/api/courses/search/route";

interface Props {
  value:     string;
  onChange:  (value: string) => void;
  onSelect:  (result: { name: string; city: string }) => void;
  required?: boolean;
}

export function CourseSearch({ value, onChange, onSelect, required }: Props) {
  const [results,    setResults]    = useState<CourseSearchResult[]>([]);
  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [configured, setConfigured] = useState(false);
  const debounceRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearchRef = useRef(false);

  // Check once if the API key is present
  useEffect(() => {
    fetch("/api/courses/search?q=_")
      .then((r) => r.json())
      .then(({ configured }) => setConfigured(!!configured));
  }, []);

  // Debounced search — only runs when configured
  useEffect(() => {
    if (!configured) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // A result was just selected — skip this search cycle and reset the flag
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (!value.trim() || value.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then(({ results }) => {
          setResults(results ?? []);
          setOpen((results ?? []).length > 0);
          setLoading(false);
        });
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, configured]);

  return (
    <div className="relative">
      <div className="relative">
        {/* Search icon only shown when API is active */}
        {configured && (
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
            width="13" height="13" viewBox="0 0 13 13" fill="none"
          >
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <input
          type="text"
          placeholder="e.g. Whistling Straits"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={`w-full rounded-xl border border-white/10 bg-white/5 ${configured ? "pl-9" : "px-4"} pr-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#c9a84c]/50 focus:outline-none transition-colors`}
          required={required}
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/25">
            searching…
          </span>
        )}
      </div>

      {/* Dropdown — only when configured and results exist */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
          {results.map((r) => (
            <li
              key={r.placeId}
              onMouseDown={() => {
                skipNextSearchRef.current = true;
                onSelect({ name: r.name, city: r.city });
                setResults([]);
                setOpen(false);
              }}
              className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <p className="text-sm font-medium text-white">{r.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{r.city}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
