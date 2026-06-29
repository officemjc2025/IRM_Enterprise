"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { GroupedSearchResults, SearchResultItem } from "../types/search.types";

interface GlobalSearchProps {
  onSelectResult?: (result: SearchResultItem) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function GlobalSearch({
  onSelectResult,
  placeholder = "Type to search units, persons, and occupancies...",
  autoFocus = true,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<GroupedSearchResults>({
    units: [],
    persons: [],
    occupancies: [],
  });
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Fetch logic
  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!term) {
      queueMicrotask(() => {
        setResults({ units: [], persons: [], occupancies: [] });
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      setLoading(true);
    });
    const performSearch = async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (json.success) {
          startTransition(() => {
            setResults(json.data);
          });
        }
      } catch (err) {
        console.error("Failed to fetch search results:", err);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      performSearch();
    });
  }, [debouncedQuery]);

  const hasResults =
    results.units.length > 0 ||
    results.persons.length > 0 ||
    results.occupancies.length > 0;

  const handleItemClick = (e: React.MouseEvent, item: SearchResultItem) => {
    if (onSelectResult) {
      e.preventDefault();
      onSelectResult(item);
    }
  };

  const renderSection = (title: string, items: SearchResultItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          {title} ({items.length})
        </h4>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-lg divide-y divide-slate-100 dark:divide-slate-700/80 shadow-sm overflow-hidden">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              onClick={(e) => handleItemClick(e, item)}
              className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition duration-150"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {item.subtitle}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-600/40">
                  {item.type}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-3.5 border border-slate-200 dark:border-slate-700/80 rounded-lg dark:bg-slate-900 text-sm shadow-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition duration-150"
          autoFocus={autoFocus}
        />
        {(loading || isPending) && (
          <div className="absolute right-4 top-3.5 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-[#D4AF37]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {query.trim() === "" ? (
        <div className="p-12 border border-dashed border-slate-200 dark:border-slate-700/80 rounded-lg text-center text-slate-400 dark:text-slate-500 text-sm">
          Enter a search term above to begin searching.
        </div>
      ) : !loading && !isPending && !hasResults ? (
        <div className="p-12 border border-dashed border-slate-200 dark:border-slate-700/80 rounded-lg text-center text-slate-400 dark:text-slate-500 text-sm">
          No matching results found for &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-6">
          {renderSection("Units", results.units)}
          {renderSection("People", results.persons)}
          {renderSection("Occupancy Records", results.occupancies)}
        </div>
      )}
    </div>
  );
}
