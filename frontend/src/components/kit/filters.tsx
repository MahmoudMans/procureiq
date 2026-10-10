"use client";

/**
 * Filter controls used above list pages:
 *   SearchField      search box with clear button and an optional "/" shortcut
 *   SelectField      compact labelled dropdown
 *   SegmentedFilter  pill group for a handful of mutually exclusive values
 *   FilterChips      removable chips for the filters that are currently active
 */
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export type SelectOption = FilterOption;
export type SegmentedOption = FilterOption;

/* ------------------------------------------------------------------ */

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  /** Pressing "/" anywhere on the page focuses this field. Use on one field per page. */
  shortcut?: boolean;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  shortcut = false,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Ignore while a dialog is open or while the user is typing somewhere.
      if (document.body.dataset.kitLocks) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcut]);

  return (
    <div className="kit-search">
      <Search size={16} aria-hidden="true" />

      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
      />

      {value ? (
        <button
          type="button"
          className="kit-search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      ) : shortcut ? (
        <kbd className="kbd kit-search__hint" aria-hidden="true">
          /
        </kbd>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="kit-select">
      <span className="kit-select__label">{label}</span>

      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown size={14} className="kit-select__chevron" aria-hidden="true" />
    </label>
  );
}

/* ------------------------------------------------------------------ */

interface SegmentedFilterProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function SegmentedFilter({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedFilterProps) {
  return (
    <div className="kit-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
}

export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="kit-chips" aria-label="Active filters">
      {chips.map((chip) => (
        <span key={chip.key} className="kit-chip">
          {chip.label}

          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.onRemove}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {chips.length > 1 ? (
        <button type="button" className="kit-chips__clear" onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}
