"use client";

/**
 * components/dashboard/manufacturer-autocomplete-field.tsx
 * -----------------------------------------------------------------------
 * Clean dropdown-suggestions combobox for the Manufacturer field on
 * CreatePassportModal. Not a native <datalist>: unlike Grade or
 * Chain-of-Custody Participant Name, this field's submitted value is a
 * Manufacturer row's UUID, not the text a person actually recognizes
 * (its legal name). A <datalist> option can carry a `value` different
 * from its label, but selecting one still just writes that `value` into
 * the input verbatim — the field would end up *displaying* a raw UUID
 * after every selection, exactly the confusing state this feature is
 * meant to fix (see create-passport-modal.tsx's file banner, item 3, and
 * this field's old "Manufacturer ID (UUID)" label/hint).
 *
 * Fully backward compatible by design: this component does not replace
 * the existing manufacturerId text field, it wraps it. Typing or pasting
 * a UUID directly still works exactly as before — the dropdown is purely
 * an additive, click-to-fill convenience layered on top, never a forced
 * autofill. Matching suggestions are filtered by legal name, country, or
 * id substring so a partially-remembered UUID still narrows the list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import type { ManufacturerSuggestion } from "@/lib/services/form-suggestions";

interface ManufacturerAutocompleteFieldProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: ManufacturerSuggestion[];
  className: string;
  placeholder?: string;
  required?: boolean;
}

const MAX_VISIBLE_MATCHES = 8;

export function ManufacturerAutocompleteField({
  value,
  onChange,
  suggestions,
  className,
  placeholder,
  required,
}: ManufacturerAutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = !q
      ? suggestions
      : suggestions.filter(
          (m) =>
            m.legalName.toLowerCase().includes(q) ||
            m.country.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q)
        );
    return pool.slice(0, MAX_VISIBLE_MATCHES);
  }, [value, suggestions]);

  useEffect(() => {
    setHighlighted(0);
  }, [matches.length]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectMatch = (m: ManufacturerSuggestion) => {
    onChange(m.id);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && matches[highlighted]) {
      e.preventDefault();
      selectMatch(matches[highlighted]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="manufacturer-suggestion-list"
      />
      {isOpen && matches.length > 0 && (
        <ul
          id="manufacturer-suggestion-list"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl py-1"
        >
          {matches.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMatch(m);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 cursor-pointer flex items-start gap-2 ${
                i === highlighted ? "bg-emerald-500/10 text-emerald-300" : "text-slate-300"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <div className="font-bold truncate">{m.legalName}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {m.country} · {m.id}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
