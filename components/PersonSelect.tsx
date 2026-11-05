"use client";
import { useWorkspace } from "./Workspace";
import { assignedPerson } from "@/lib/people";
export function PersonSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data } = useWorkspace();
  const people = data.people || [];
  const assigned = assignedPerson(people, value);
  const selected = assigned?.id || value;
  const known = Boolean(assigned);
  return (
    <label>
      Assignee
      <select
        aria-label="Assignee"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {!known && value && (
          <option value={value}>{value} (existing assignment)</option>
        )}
        {people
          .filter((p) => p.active || p.id === selected)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {!p.active ? " (inactive)" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
