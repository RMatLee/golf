/**
 * CourseSearch — unified course name input with optional Places autocomplete.
 *
 * On mount, probes `/api/courses/search?q=_` to check whether `GOOGLE_PLACES_API_KEY`
 * is configured. If so, input keystrokes are debounced (400 ms) and matched against
 * the Places API; results appear in a dropdown. If not configured, it renders as a
 * plain text input with no dropdown.
 *
 * Selection flow:
 *   1. User mouses down on a suggestion → the selected name is recorded.
 *   2. The `onSelect` callback fires, updating the parent's name and city fields.
 *   3. The value change triggers a debounced search effect, but the selected name
 *      is checked first and the search is skipped, preventing the dropdown from
 *      immediately reopening after selection.
 *
 * Props:
 *   - `value` / `onChange` — controlled input value
 *   - `onSelect({ name, city })` — called when a Places result is chosen
 *   - `required` — forwarded to the underlying `<input>`
 */
"use client";

import { useState, useEffect } from "react";
import type { CourseSearchResult } from "@/app/api/courses/search/route";

interface Props {
  value:     string;
  onChange:  (value: string) => void;
  onSelect:  (result: { name: string; city: string }) => void;
  required?: boolean;
}

export function CourseSearch({ value, onChange, onSelect, required }: Props) {
  const [search, setSearch] = useState<{ query: string; results: CourseSearchResult[]; error?: string } | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [open,       setOpen]       = useState(false);
  const [configured, setConfigured] = useState(false);
  const canSearch = configured && value.trim().length >= 2 && value !== selectedName;
  const results = canSearch && search?.query === value ? search.results : [];
  const loading = canSearch && search?.query !== value;

  // Check once if the API key is present
  useEffect(() => {
    fetch("/api/courses/search?q=_")
      .then((r) => r.json())
      .then(({ configured }) => setConfigured(!!configured));
  }, []);

  // Debounced search — only runs when configured
  useEffect(() => {
    if (!canSearch) return;
    let active = true;
    const timeout = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(value)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`Course search failed: ${r.status}`);
          return r.json();
        })
        .then(({ results }) => {
          if (!active) return;
          setSearch({ query: value, results: results ?? [] });
          setOpen((results ?? []).length > 0);
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error("Course search failed:", error);
          setSearch({ query: value, results: [], error: "Course search unavailable. Enter the course manually." });
          setOpen(false);
        });
    }, 400);

    return () => { active = false; clearTimeout(timeout); };
  }, [value, canSearch]);

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
          onChange={(e) => {
            setSelectedName(null);
            setOpen(false);
            onChange(e.target.value);
          }}
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
      {canSearch && search?.query === value && search.error && (
        <p role="status" className="mt-1 text-xs text-red-400">{search.error}</p>
      )}

      {/* Dropdown — only when configured and results exist */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
          {results.map((r) => (
            <li
              key={r.placeId}
              onMouseDown={() => {
                setSelectedName(r.name);
                onSelect({ name: r.name, city: r.city });
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
