"use client";
import { useId, type ReactNode } from "react";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  required = false,
  hint,
  readOnly = false,
  suggestions,
  step,
  showZero = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  required?: boolean;
  hint?: string;
  readOnly?: boolean;
  suggestions?: readonly (string | number)[];
  step?: number | string;
  showZero?: boolean;
}) {
  const suggestionId = useId();
  const displayValue =
    type === "number" && value === 0 && !showZero ? "" : value;
  return (
    <label>
      {label}
      <input
        type={type}
        value={displayValue}
        min={min}
        max={max}
        step={step ?? (type === "number" ? "any" : undefined)}
        required={required}
        readOnly={readOnly}
        list={suggestions?.length ? suggestionId : undefined}
        onInput={
          type === "date" ? (e) => onChange(e.currentTarget.value) : undefined
        }
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions?.length ? (
        <datalist id={suggestionId}>
          {suggestions.map((suggestion) => (
            <option value={suggestion} key={suggestion} />
          ))}
        </datalist>
      ) : null}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((v) => (
          <option value={v} key={v}>
            {v || "Choose…"}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function Notes({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error)
    return (error.issues as { path: unknown[]; message: string }[])
      .map((i) => `${i.path.join(" · ")}: ${i.message}`)
      .join("; ");
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}
