"use client";

import { useState, useRef, useEffect } from "react";

type Item = { label: string; value: string };

type Props = {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SearchableSelect({ items, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.value === value);
  const filtered = query
    ? items.filter((i) => i.label.includes(query))
    : items;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(item: Item) {
    onChange(item.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" dir="rtl">
      <input
        type="text"
        value={open ? query : (selected?.label ?? "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto text-sm">
          {filtered.map((item) => (
            <li
              key={item.value}
              onMouseDown={(e) => { e.preventDefault(); select(item); }}
              className={`px-3 py-2 cursor-pointer hover:bg-amber-50 ${
                item.value === value ? "bg-amber-100 font-medium" : ""
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
