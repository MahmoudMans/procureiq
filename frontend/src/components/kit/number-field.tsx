"use client";

import { Field } from "@/components/kit";

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
}

/** Labelled number input with inline error, for forms that keep their values as strings. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  min,
  max,
  step,
  disabled,
}: NumberFieldProps) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input
        id={id}
        className="kit-field-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Returns an error message for a typed number, or undefined when the value is acceptable. */
export function numberError(raw: string, rule: NumberRule = {}): string | undefined {
  const { min = 0, max, integer = false } = rule;
  const text = raw.trim();

  if (text === "") {
    return "Enter a value.";
  }

  const value = Number(text);

  if (!Number.isFinite(value)) {
    return "Enter a valid number.";
  }

  if (integer && !Number.isInteger(value)) {
    return "Use a whole number.";
  }

  if (value < min || (max !== undefined && value > max)) {
    return max !== undefined ? `Enter a value from ${min} to ${max}.` : `Enter ${min} or more.`;
  }

  return undefined;
}
