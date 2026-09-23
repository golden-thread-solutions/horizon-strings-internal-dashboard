import test from "node:test";
import assert from "node:assert/strict";
import {
  newEvent,
  defaultSettings,
  eventSchema,
  resolutionSchema,
  settingsSchema,
  detailKeys,
} from "../lib/model";
import {
  addDays,
  businessToday,
  deriveStage,
  eventActions,
  canArchive,
  balance,
  profit,
  readiness,
  received,
  weeksBefore,
  nextThursday,
  ceremonyTiming,
  DEFAULT_DEPOSIT_AMOUNT,
  finalInvoiceAmount,
} from "../lib/workflow";
const today = "2026-09-18";
function booked(days = 60) {
  const e = newEvent("Test event", today);
  e.eventDate = addDays(today, days);
  e.area = "Coffs Harbour";
  e.address = "Test address";
  e.ensemble = "Solo";
  e.durationMinutes = 60;
  e.finance.depositReceived = true;
  e.finance.depositAmount = 100;
  e.finance.depositDate = today;
  e.finance.performance = 100;
  e.contacts = [
    {
      id: crypto.randomUUID(),
      role: "Main contact",
      name: "Test",
      phone: "0400000000",
      email: "",
      notes: "",
    },
  ];
  for (const key of detailKeys)
    e.details[key] = {
      state: "Not Applicable",
      value: "",
      dueDate: "",
      trigger: "",
    };
  return e;
}
test("name-only enquiry creates one outbound response action", () => {
  const e = newEvent("Jane", today);
  assert.equal(eventSchema.safeParse(e).success, true);
  assert.equal(deriveStage(e, defaultSettings, today), "New Enquiry");
  const actions = eventActions(e, defaultSettings, today);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "Communication");
  assert.equal(actions[0].dueDate, "2026-09-19");
});
test("response, welcome and deposit derive canonical stages", () => {
  const e = newEvent("Jane", today);
  e.milestones.responded = today;
  assert.equal(deriveStage(e, defaultSettings, today), "Pending Enquiry");
  e.milestones.welcomeSent = today;
  assert.equal(deriveStage(e, defaultSettings, today), "Pending Booking");
  e.finance.depositReceived = true;
  assert.equal(deriveStage(e, defaultSettings, today), "Details Pending");
  e.milestones.responded = "";
  e.milestones.welcomeSent = "";
  assert.equal(deriveStage(e, defaultSettings, today), "Details Pending");
  assert.ok(
    !eventActions(e, defaultSettings, today).some((a) =>
      a.id.endsWith(":welcome"),
    ),
  );
});
test("deferred information requires a date or trigger; structured fields may satisfy filled details", () => {
  assert.equal(
    resolutionSchema.safeParse({
      state: "Deferred",
      value: "",
      dueDate: "",
      trigger: "",
    }).success,
    false,
  );
  assert.equal(
    resolutionSchema.safeParse({
      state: "Filled",
      value: " ",
      dueDate: "",
      trigger: "",
    }).success,
    true,
  );
  assert.equal(
    resolutionSchema.safeParse({
      state: "Deferred",
      value: "",
      dueDate: "",
      trigger: "Final Details",
    }).success,
    true,
  );
});
test("completed early details wait for internal threshold", () => {
  const e = booked(240);
  assert.equal(deriveStage(e, defaultSettings, today), "Details Pending");
  assert.equal(
    deriveStage(e, defaultSettings, weeksBefore(e, 12)),
    "Internal Organisation",
  );
});
test("deferred action due date follows settings and concrete dates override triggers", () => {
  const e = booked(60);
  e.details.wetWeather = {
    state: "Deferred",
    value: "",
    dueDate: "",
    trigger: "Final Details",
  };
  const find = (s: typeof defaultSettings) =>
    eventActions(e, s, today).find((a) =>
      a.id.endsWith(":deferred:wetWeather"),
    )!;
  assert.equal(find(defaultSettings).dueDate, addDays(e.eventDate, -28));
  assert.equal(
    find({ ...defaultSettings, finalWeeks: 3 }).dueDate,
    addDays(e.eventDate, -21),
  );
  e.details.wetWeather.dueDate = "2026-09-20";
  assert.equal(find(defaultSettings).dueDate, "2026-09-20");
  assert.ok(readiness(e, defaultSettings).some((b) => b.includes("deferred")));
});
test("timing changes move generated actions but preserve manual due dates", () => {
  const e = booked();
  e.tasks.push({
    id: crypto.randomUUID(),
    title: "Manual",
    kind: "Task",
    dueDate: today,
    assignee: "",
    recipient: "",
    notes: "",
    done: false,
    completedAt: "",
  });
  const result = eventActions(
    e,
    { ...defaultSettings, musiciansWeeks: 8 },
    today,
  );
  assert.equal(
    result.find((a) => a.id.endsWith(":musicians"))?.dueDate,
    addDays(e.eventDate, -56),
  );
  assert.equal(result.find((a) => a.origin === "Manual")?.dueDate, today);
});
test("post-event review follows the next Thursday after the thank-you message", () => {
  const e = booked(0);
  e.milestones.thankYouSent = "2026-09-21";
  const actions = eventActions(e, defaultSettings, "2026-09-22");
  assert.equal(nextThursday("2026-09-21"), "2026-09-24");
  assert.equal(
    actions.find((a) => a.id.endsWith(":thanks"))?.dueDate,
    undefined,
  );
  assert.equal(
    actions.find((a) => a.id.endsWith(":review"))?.dueDate,
    "2026-09-24",
  );
});
test("Event Ready requires full ensemble, music access, final confirmation and selected payment gate", () => {
  const e = booked(7);
  assert.equal(deriveStage(e, defaultSettings, today), "Final Details");
  e.musicians.push({
    id: crypto.randomUUID(),
    musicianId: "",
    name: "Player",
    instrument: "Violin",
    confirmed: true,
    musicSent: true,
    contractRequired: false,
    signed: false,
    paid: true,
    fee: 0,
    notes: "",
  });
  e.milestones.finalConfirmed = today;
  assert.equal(deriveStage(e, defaultSettings, today), "Event Ready");
  e.ensemble = "Duo";
  assert.notEqual(deriveStage(e, defaultSettings, today), "Event Ready");
  e.ensemble = "Solo";
  e.finance.performance = 500;
  assert.equal(deriveStage(e, defaultSettings, today), "Event Ready");
  assert.equal(
    deriveStage(e, { ...defaultSettings, readyRequiresPayment: true }, today),
    "Final Details",
  );
});
test("date drives Event Day and Post-event; archival cannot hide unresolved work", () => {
  const e = booked(0);
  assert.equal(deriveStage(e, defaultSettings, today), "Event Day");
  assert.equal(
    deriveStage(e, defaultSettings, addDays(today, 1)),
    "Post-event",
  );
  e.archived = true;
  assert.equal(canArchive(e, defaultSettings, addDays(today, 1)), false);
  e.archived = false;
  e.musicians.push({
    id: crypto.randomUUID(),
    musicianId: "",
    name: "Player",
    instrument: "Violin",
    confirmed: true,
    musicSent: true,
    contractRequired: false,
    signed: false,
    paid: true,
    fee: 0,
    notes: "",
  });
  e.milestones.finalConfirmed = today;
  e.milestones.thankYouSent = today;
  e.milestones.reviewRequested = today;
  assert.equal(canArchive(e, defaultSettings, addDays(today, 1)), true);
});
test("finance includes fees, received final payments and musician costs", () => {
  const e = booked();
  e.finance.performance = 1500;
  e.finance.travel = 100;
  e.finance.arrangements = 50;
  e.finance.depositAmount = 400;
  e.finance.finalReceived = 1000;
  e.finance.otherCosts = 30;
  e.musicians.push({
    id: crypto.randomUUID(),
    musicianId: "",
    name: "Player",
    instrument: "Violin",
    confirmed: true,
    musicSent: true,
    contractRequired: false,
    signed: false,
    paid: false,
    fee: 200,
    notes: "",
  });
  assert.equal(balance(e), 250);
  assert.equal(profit(e), 1420);
  e.finance.finalReceived = 2000;
  assert.equal(balance(e), 0);
});
test("ceremony timing follows the spreadsheet calculations", () => {
  assert.deepEqual(ceremonyTiming("15:00", 20, 30, 75), {
    playStartTime: "14:40",
    arrivalTime: "14:10",
    remainingPlayMinutes: 25,
  });
  assert.deepEqual(ceremonyTiming("00:15", 30, 30, 60), {
    playStartTime: "23:45",
    arrivalTime: "23:15",
    remainingPlayMinutes: 0,
  });
  assert.deepEqual(ceremonyTiming("", undefined, undefined, 75), {
    playStartTime: "",
    arrivalTime: "",
    remainingPlayMinutes: 0,
  });
});
test("deposit and final invoice use the fixed four-hundred-dollar deposit", () => {
  const e = booked();
  e.finance.performance = 1500;
  e.finance.travel = 100;
  e.finance.depositAmount = 50;
  assert.equal(DEFAULT_DEPOSIT_AMOUNT, 400);
  assert.equal(finalInvoiceAmount(e), 1200);
  assert.equal(received(e), 400);
  const fresh = newEvent("New enquiry", today);
  assert.equal(fresh.finance.depositRequired, 400);
  assert.equal(fresh.finance.depositAmount, 400);
});
test("Sydney calendar day and DST-safe offsets", () => {
  assert.equal(businessToday(new Date("2026-09-17T15:00:00Z")), "2026-09-18");
  assert.equal(addDays("2026-10-04", -7), "2026-09-27");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
});
test("impossible dates, negative money and reversed stage thresholds are rejected", () => {
  const e = booked();
  e.eventDate = "2026-02-30";
  assert.equal(eventSchema.safeParse(e).success, false);
  e.eventDate = today;
  e.finance.travel = -1;
  assert.equal(eventSchema.safeParse(e).success, false);
  assert.equal(
    settingsSchema.safeParse({
      ...defaultSettings,
      internalWeeks: 1,
      finalWeeks: 2,
    }).success,
    false,
  );
});
