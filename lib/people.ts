import type { Person } from "./model";
export function assignedPerson(people: Person[], value: string) {
  return (
    people.find((p) => p.id === value) ||
    people.find(
      (p) =>
        p.name.toLocaleLowerCase("en-AU") ===
        value.trim().toLocaleLowerCase("en-AU"),
    )
  );
}
