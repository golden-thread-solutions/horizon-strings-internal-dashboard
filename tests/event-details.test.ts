import test from "node:test";
import assert from "node:assert/strict";
import {
  newEvent,
  defaultSettings,
  detailKeys,
  eventSchema,
} from "../lib/model";
import {
  fieldNotApplicable,
  setFieldNotApplicable,
  detailState,
  operationalFields,
  syncDetailState,
} from "../lib/event-details";
import {
  deriveStage,
  missingDetails,
  eventActions,
  timingCalculation,
  addDays,
} from "../lib/workflow";

const today = "2026-09-18";
function privateEvent() {
  const e = newEvent("Synthetic private reception", today);
  Object.assign(e, {
    eventType: "Private event",
    eventDate: addDays(today, 60),
    area: "Coffs Harbour",
    address: "Synthetic venue",
    ensemble: "Solo",
    durationMinutes: 90,
  });
  e.finance.depositReceived = true;
  e.finance.depositDate = today;
  e.contacts.push({
    id: crypto.randomUUID(),
    role: "Main contact",
    name: "Example",
    phone: "0400000000",
    email: "",
    notes: "",
  });
  for (const key of detailKeys) e.details[key].state = "Not Applicable";
  e.details.timing.state = "Unknown";
  e.details.venueSetup.state = "Unknown";
  return e;
}
test("private event progresses with applicable times and venue, without ceremony or second-location fields", () => {
  const e = privateEvent();
  for (const key of [
    "preCeremonyMinutes",
    "ceremonyStartTime",
    "ceremonyDurationMinutes",
    "remainingPlayMinutes",
    "postCeremonyDetails",
  ])
    setFieldNotApplicable(e, "timing", key, true);
  e.operational.timing.otherStartTime = "18:00";
  e.operational.timing.otherFinishTime = "19:30";
  setFieldNotApplicable(e, "venueSetup", "secondLocation", true);
  setFieldNotApplicable(e, "venueSetup", "secondAddress", true);
  e.operational.venueSetup.playingPosition = "Inside, beside the stage";
  assert.equal(detailState(e, "timing"), "Filled");
  assert.equal(detailState(e, "venueSetup"), "Filled");
  assert.deepEqual(missingDetails(e), []);
  assert.equal(deriveStage(e, defaultSettings, today), "Internal Organisation");
  assert.equal(
    eventActions(e, defaultSettings, today).some((a) =>
      a.id.endsWith(":details"),
    ),
    false,
  );
  assert.deepEqual(timingCalculation(e), { arrivalTime: "17:30" });
  assert.equal(eventSchema.safeParse(e).success, true);
});
test("N/A retains values, is reversible, and one hidden field cannot resolve an otherwise empty group", () => {
  const e = privateEvent();
  e.operational.venueSetup.secondAddress = "Retained synthetic address";
  setFieldNotApplicable(e, "venueSetup", "secondAddress", true);
  assert.equal(e.details.venueSetup.state, "Unknown");
  assert.equal(fieldNotApplicable(e, "venueSetup", "secondAddress"), true);
  assert.ok(missingDetails(e).includes("Position and setup at venue"));
  const saved = eventSchema.parse(JSON.parse(JSON.stringify(e)));
  setFieldNotApplicable(saved, "venueSetup", "secondAddress", false);
  assert.equal(
    saved.operational.venueSetup.secondAddress,
    "Retained synthetic address",
  );
  assert.equal(detailState(saved, "venueSetup"), "Filled");
});
test("all individual fields can be resolved N/A without hiding the group; unmarking reopens it", () => {
  const e = privateEvent();
  for (const field of operationalFields.venueSetup)
    setFieldNotApplicable(e, "venueSetup", field.key, true);
  assert.equal(e.details.venueSetup.state, "Filled");
  setFieldNotApplicable(e, "venueSetup", "playingPosition", false);
  assert.equal(e.details.venueSetup.state, "Unknown");
  e.details.venueSetup.state = "Deferred";
  e.details.venueSetup.trigger = "Final Details";
  setFieldNotApplicable(e, "venueSetup", "playingPosition", true);
  assert.equal(e.details.venueSetup.state, "Deferred");
});
test("direct playing times work and hidden ceremony values do not drive calculations", () => {
  const e = privateEvent();
  e.operational.timing = {
    playStartTime: "18:00",
    ceremonyStartTime: "15:00",
    preCeremonyMinutes: 30,
    ceremonyDurationMinutes: 30,
  };
  assert.equal(timingCalculation(e).playStartTime, "14:30");
  setFieldNotApplicable(e, "timing", "ceremonyStartTime", true);
  assert.equal(timingCalculation(e).playStartTime, undefined);
  assert.equal(timingCalculation(e).arrivalTime, "17:30");
  setFieldNotApplicable(e, "timing", "arrivalTime", true);
  assert.equal(timingCalculation(e).arrivalTime, undefined);
  e.operational.timing = { playStartTime: "18:00" };
  syncDetailState(e, "timing");
  assert.equal(detailState(e, "timing"), "Filled");
});
test("N/A does not bypass core requirements, final confirmations or payment policy", () => {
  const e = privateEvent();
  for (const field of operationalFields.timing)
    setFieldNotApplicable(e, "timing", field.key, true);
  for (const field of operationalFields.venueSetup)
    setFieldNotApplicable(e, "venueSetup", field.key, true);
  e.eventDate = addDays(today, 7);
  assert.equal(deriveStage(e, defaultSettings, today), "Final Details");
  e.address = "";
  assert.ok(missingDetails(e).includes("Address"));
  assert.equal(deriveStage(e, defaultSettings, today), "Details Pending");
});

test("direct arrival or remaining time counts as supplied timing information", () => {
  const e = privateEvent();
  e.operational.timing.arrivalTime = "17:30";
  syncDetailState(e, "timing");
  assert.equal(detailState(e, "timing"), "Filled");
  setFieldNotApplicable(e, "timing", "arrivalTime", true);
  assert.equal(detailState(e, "timing"), "Unknown");
  e.operational.timing.remainingPlayMinutes = 30;
  syncDetailState(e, "timing");
  assert.equal(detailState(e, "timing"), "Filled");
});
