"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { FiChevronDown, FiX, FiSearch } from "react-icons/fi";
import clsx from "clsx";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchStr?: string; // pre-computed search string for advanced match
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found",
  loadingMessage = "Loading...",
  disabled = false,
  loading = false,
  required = false,
  className,
  id,
  name
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 1. Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value) || null;
  }, [options, value]);

  // 2. Filter options based on search query
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter(opt => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSearchStr = opt.searchStr ? opt.searchStr.toLowerCase().includes(query) : false;
      const matchVal = opt.value.toLowerCase().includes(query);
      return matchLabel || matchSearchStr || matchVal;
    });
  }, [options, searchQuery]);

  // 3. Helper to close dropdown and reset search states
  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery("");
    setFocusedIndex(-1);
  };

  const openDropdown = () => {
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  // 4. Focus search input when dropdown opens (no setState in this effect!)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 5. Close on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // 6. Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else {
        setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen) {
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          onChange(filteredOptions[focusedIndex].value);
          closeDropdown();
          triggerRef.current?.focus();
        } else if (filteredOptions.length === 1) {
          onChange(filteredOptions[0].value);
          closeDropdown();
          triggerRef.current?.focus();
        }
      } else {
        openDropdown();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      closeDropdown();
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const listElement = listRef.current;
      const optionElement = listElement.children[focusedIndex] as HTMLElement;
      if (optionElement) {
        const optionTop = optionElement.offsetTop;
        const optionBottom = optionTop + optionElement.offsetHeight;
        const listScrollTop = listElement.scrollTop;
        const listHeight = listElement.clientHeight;

        if (optionBottom > listScrollTop + listHeight) {
          listElement.scrollTop = optionBottom - listHeight;
        } else if (optionTop < listScrollTop) {
          listElement.scrollTop = optionTop;
        }
      }
    }
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className={clsx("relative w-full", className)}>
      {/* Hidden input for HTML form integration */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={clsx(
          "flex items-center justify-between w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 outline-none select-none text-left transition duration-200",
          disabled
            ? "cursor-not-allowed opacity-50 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
            : "cursor-pointer border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        )}
      >
        <span className={clsx("truncate flex-1 pr-2", !selectedOption && "text-slate-400 dark:text-slate-500")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {!required && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                triggerRef.current?.focus();
              }}
              className="p-0.5 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer rounded"
            >
              <FiX className="w-3.5 h-3.5" />
            </span>
          )}
          <FiChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Search box wrapper */}
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-2.5 py-2">
            <FiSearch className="text-slate-400 w-3.5 h-3.5 shrink-0 mr-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent border-none outline-none text-slate-850 dark:text-slate-150 placeholder-slate-400 dark:placeholder-slate-500 h-6"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFocusedIndex(-1);
                }}
                className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-350 p-0.5 rounded"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto max-h-56 py-1 select-none"
          >
            {loading ? (
              <div className="text-center p-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                {loadingMessage}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="text-center p-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isFocused = index === focusedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      closeDropdown();
                      triggerRef.current?.focus();
                    }}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={clsx(
                      "px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors duration-150",
                      isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold",
                      isFocused && !isSelected && "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
                      !isFocused && !isSelected && "text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold shrink-0 tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 ml-2">
                        Active
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
