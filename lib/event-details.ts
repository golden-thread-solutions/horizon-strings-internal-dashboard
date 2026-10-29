import { type EventRecord, type DetailKey, detailLabels } from "./model";

type OperationalField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time";
  multiline?: boolean;
  calculated?: boolean;
  suggestions?: readonly (string | number)[];
};
export const timeSuggestions = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
export const shortDurationSuggestions = Array.from(
  { length: 8 },
  (_, index) => (index + 1) * 15,
);
export const playingDurationSuggestions = Array.from(
  { length: 17 },
  (_, index) => 60 + index * 15,
);
export const feeSuggestions = Array.from(
  { length: 50 },
  (_, index) => (index + 1) * 100,
);
export const performanceFeeSuggestions = Array.from(
  { length: 46 },
  (_, index) => 500 + index * 100,
);
export const operationalFields: Record<
  keyof typeof detailLabels,
  OperationalField[]
> = {
  timing: [
    {
      key: "arrivalTime",
      label: "Arrival time",
      type: "time",
      calculated: true,
    },
    {
      key: "playStartTime",
      label: "Playing starts",
      type: "time",
      calculated: true,
    },
    {
      key: "preCeremonyMinutes",
      label: "Pre-ceremony music (minutes)",
      type: "number",
      suggestions: shortDurationSuggestions,
    },
    {
      key: "ceremonyStartTime",
      label: "Ceremony starts",
      type: "time",
      suggestions: timeSuggestions,
    },
    {
      key: "ceremonyDurationMinutes",
      label: "Ceremony duration (minutes)",
      type: "number",
      suggestions: shortDurationSuggestions,
    },
    {
      key: "remainingPlayMinutes",
      label: "Remaining playing time (minutes)",
      type: "number",
      calculated: true,
    },
    {
      key: "postCeremonyDetails",
      label: "Post-ceremony timing and details",
      multiline: true,
    },
    {
      key: "otherStartTime",
      label: "Other playing starts",
      type: "time",
      suggestions: timeSuggestions,
    },
    {
      key: "otherFinishTime",
      label: "Other playing finishes",
      type: "time",
      suggestions: timeSuggestions,
    },
  ],
  venueSetup: [
    { key: "insideOutside", label: "Inside / outside" },
    {
      key: "playingPosition",
      label: "Playing position at venue",
      multiline: true,
    },
    { key: "arrivalAddress", label: "Arrival / setup address" },
    { key: "secondLocation", label: "Second location or venue" },
    { key: "secondAddress", label: "Second address" },
    {
      key: "movementDetails",
      label: "Movement and setup notes",
      multiline: true,
    },
  ],
  wetWeather: [
    { key: "plan", label: "Wet-weather plan", multiline: true },
    { key: "alternativeArea", label: "Alternative area / room" },
    { key: "alternativeAddress", label: "Alternative address" },
    { key: "rainCallTime", label: "Rain decision time", type: "time" },
    { key: "decisionMaker", label: "Who makes the weather call" },
    {
      key: "shelterDetails",
      label: "Shelter and weather notes",
      multiline: true,
    },
  ],
  onDayContact: [
    { key: "name", label: "On-the-day contact name" },
    { key: "role", label: "Role" },
    { key: "phone", label: "Phone" },
    { key: "notes", label: "Contact notes", multiline: true },
  ],
  repertoireBrief: [
    { key: "genrePreference", label: "General genre preference" },
    { key: "ceremonyNotes", label: "Ceremony music notes", multiline: true },
    { key: "groomsmenEntry", label: "Groomsmen entry" },
    { key: "bridalPartyEntry", label: "Bridal party / processional" },
    { key: "registerSigning", label: "Register signing" },
    { key: "recessional", label: "Recessional" },
    { key: "receptionEntrance", label: "Reception entrance" },
    { key: "firstDance", label: "First dance" },
    { key: "otherRequests", label: "Other music requests", multiline: true },
  ],
  rehearsal: [
    { key: "date", label: "Rehearsal date", type: "date" },
    { key: "location", label: "Rehearsal location" },
    { key: "participants", label: "Participants" },
    { key: "travelDetails", label: "Travel details" },
    { key: "notes", label: "Rehearsal notes", multiline: true },
  ],
  logistics: [
    { key: "secretSignal", label: "Secret / ceremony signal" },
    { key: "chairs", label: "Chairs" },
    { key: "shelter", label: "Gazebo / shelter" },
    { key: "dressCode", label: "Dress code" },
    { key: "amplification", label: "Amplification" },
    { key: "guestCount", label: "Guest count", type: "number" },
    { key: "other", label: "Other logistics", multiline: true },
  ],
  runSheet: [
    { key: "details", label: "Confirmed running order", multiline: true },
    { key: "notes", label: "Running-order notes", multiline: true },
  ],
};

// Keep applicability metadata alongside retained values in the existing JSON.
const naKey = (key: string) => `__notApplicable:${key}`;
export function fieldNotApplicable(
  event: EventRecord,
  group: DetailKey,
  key: string,
) {
  return event.operational[group][naKey(key)] === "true";
}
export function setFieldNotApplicable(
  event: EventRecord,
  group: DetailKey,
  key: string,
  checked: boolean,
) {
  if (checked) event.operational[group][naKey(key)] = "true";
  else delete event.operational[group][naKey(key)];
  syncDetailState(event, group);
}
export function hasOperationalInfo(event: EventRecord, group: DetailKey) {
  const fields = operationalFields[group];
  return (
    fields.some(
      (field) =>
        !fieldNotApplicable(event, group, field.key) &&
        (typeof event.operational[group][field.key] === "number"
          ? Number(event.operational[group][field.key]) > 0
          : String(event.operational[group][field.key] ?? "").trim().length >
            0),
    ) || fields.every((field) => fieldNotApplicable(event, group, field.key))
  );
}
export function detailState(event: EventRecord, group: DetailKey) {
  const state = event.details[group].state;
  return state === "Unknown" &&
    (event.details[group].value.trim() || hasOperationalInfo(event, group))
    ? "Filled"
    : state;
}
export function syncDetailState(event: EventRecord, group: DetailKey) {
  if (["Unknown", "Filled"].includes(event.details[group].state)) {
    event.details[group].state =
      event.details[group].value.trim() || hasOperationalInfo(event, group)
        ? "Filled"
        : "Unknown";
  }
}
