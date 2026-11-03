import test from "node:test";
import assert from "node:assert/strict";
import {
  newEvent,
  defaultSettings,
  type Dataset,
  type EventRecord,
  type WebsiteEnquiry,
} from "../lib/model";
import { boardCards, eventCard } from "../lib/board";
import {
  reviewBoardMove,
  acceptBoardMoveReview,
  type MoveDraft,
} from "../lib/board-recovery";
import {
  isCompletedArchive,
  isLostEnquiry,
  moveEnquiryToLost,
  reopenLostEnquiry,
} from "../lib/lost-enquiries";

const today = "2026-11-04";
function dataset(
  events: EventRecord[],
  websiteEnquiries: WebsiteEnquiry[] = [],
): Dataset {
  return {
    events,
    websiteEnquiries,
    settings: defaultSettings,
    musicians: [],
    pieces: [],
  };
}
function draft(event: EventRecord, reopen = false): MoveDraft {
  return {
    card: eventCard(event, defaultSettings, today),
    target: reopen ? "Active board" : "Lost enquiries",
    lost: reopen,
    reason:
      "Kept draft — chose another ensemble\nPlease retain this explanation.",
  };
}
function persistence(initial: EventRecord) {
  let saved = structuredClone(initial),
    writes = 0;
  return {
    current: () => saved,
    edit: (patch: Partial<EventRecord>) => {
      saved = { ...saved, ...patch, revision: saved.revision + 1 };
    },
    writes: () => writes,
    save: async (candidate: EventRecord) => {
      if (candidate.revision !== saved.revision)
        throw new Error("Event changed in another tab");
      writes++;
      saved = { ...candidate, revision: candidate.revision + 1 };
      return saved;
    },
  };
}

test("conflict → reload → explicit review → retry retains reason, new revision and another editor's changes", async () => {
  const event = { ...newEvent("Synthetic recovery", today), revision: 1 };
  const original = draft(event),
    db = persistence(event);
  let loaded = dataset([event]);
  const deps = {
    event: (id: string) => loaded.events.find((e) => e.id === id),
    enquiry: () => undefined,
    convert: async () => {
      throw new Error("Must not convert an event");
    },
    save: db.save,
  };
  db.edit({ notes: "Other editor's notes", area: "Bellingen" });
  await assert.rejects(
    moveEnquiryToLost(original.card, original.reason, deps),
    /changed/,
  );
  loaded = dataset([db.current()]);
  const review = reviewBoardMove(original, loaded, today);
  assert.equal(
    original.card.revision,
    1,
    "reload alone does not accept a newer revision",
  );
  assert.equal(review.draft.reason, original.reason);
  assert.equal(review.draft.target, original.target);
  assert.equal(review.event?.notes, "Other editor's notes");
  assert.equal(db.writes(), 0, "reload and review never write automatically");
  const accepted = acceptBoardMoveReview(review, loaded, today);
  assert.equal(accepted.card.revision, 2);
  assert.equal(accepted.reason, original.reason);
  const lost = await moveEnquiryToLost(accepted.card, accepted.reason, deps);
  assert.equal(lost.archiveReason, original.reason);
  assert.equal(lost.notes, "Other editor's notes");
  assert.equal(lost.area, "Bellingen");
  assert.equal(lost.archived, true);
  assert.equal(db.writes(), 1);

  const second = draft({ ...lost, archived: false });
  loaded = dataset([{ ...lost, archived: false }]);
  const laterReview = reviewBoardMove(second, loaded, today);
  const laterAcceptance = acceptBoardMoveReview(laterReview, loaded, today);
  db.edit({ notes: "Changed again after acceptance", archived: false });
  await assert.rejects(
    moveEnquiryToLost(laterAcceptance.card, laterAcceptance.reason, deps),
    /changed/,
  );
  assert.equal(db.current().notes, "Changed again after acceptance");
  assert.equal(
    db.writes(),
    1,
    "a second conflict still cannot overwrite newer facts",
  );
  assert.throws(
    () => acceptBoardMoveReview(laterReview, dataset([db.current()]), today),
    /changed again/,
  );
});

test("stale reopen recovers through review with the saved Lost reason and fresh notes intact", async () => {
  const event = {
    ...newEvent("Synthetic lost", today),
    revision: 3,
    archived: true,
    archiveReason: "Original saved reason",
  };
  const original = draft(event, true),
    db = persistence(event);
  let loaded = dataset([event]);
  const deps = {
    event: (id: string) => loaded.events.find((e) => e.id === id),
    save: db.save,
  };
  db.edit({ notes: "Concurrent update to lost enquiry" });
  await assert.rejects(reopenLostEnquiry(original.card, deps), /changed/);
  loaded = dataset([db.current()]);
  const review = reviewBoardMove(original, loaded, today);
  assert.equal(review.draft.target, "Active board");
  assert.equal(db.writes(), 0);
  const accepted = acceptBoardMoveReview(review, loaded, today);
  assert.equal(accepted.card.revision, 4);
  const reopened = await reopenLostEnquiry(accepted.card, deps);
  assert.equal(reopened.archived, false);
  assert.equal(reopened.archiveReason, "Original saved reason");
  assert.equal(reopened.notes, "Concurrent update to lost enquiry");
  db.edit({ archived: true });
  await assert.rejects(reopenLostEnquiry(accepted.card, deps), /changed/);
  assert.equal(db.writes(), 1);
});

test("reload rechecks booking, archive, Trash, missing records and linked website conversion", () => {
  const event = { ...newEvent("Synthetic eligibility", today), revision: 1 };
  const original = draft(event);
  for (const changed of [
    {
      ...event,
      revision: 2,
      finance: { ...event.finance, depositReceived: true },
    },
    {
      ...event,
      revision: 2,
      archived: true,
      archiveReason: "Already lost elsewhere",
    },
    { ...event, revision: 2, deletedAt: `${today}T12:00:00Z` },
  ]) {
    const review = reviewBoardMove(original, dataset([changed]), today);
    assert.ok(review.blocker);
    assert.equal(review.draft.reason, original.reason);
    assert.throws(() =>
      acceptBoardMoveReview(review, dataset([changed]), today),
    );
  }
  assert.ok(reviewBoardMove(original, dataset([]), today).blocker);
  const lost = { ...event, archived: true };
  for (const changed of [
    event,
    { ...lost, deletedAt: today },
    { ...lost, finance: { ...lost.finance, depositReceived: true } },
  ]) {
    assert.ok(
      reviewBoardMove(draft(lost, true), dataset([changed]), today).blocker,
    );
  }
  const enquiry: WebsiteEnquiry = {
    id: crypto.randomUUID(),
    createdAt: `${today}T00:00:00Z`,
    name: "Synthetic website enquiry",
    email: "test@example.com",
    phone: "",
    preferredContact: "email",
    eventDate: "",
    venue: "",
    area: "",
    message: "",
    weddingPackage: "",
    requestedEnsemble: "",
    emailStatus: "sent",
    dashboardStatus: "new",
    dashboardEventId: "",
  };
  const websiteDraft = {
    ...original,
    card: boardCards(dataset([], [enquiry]), today)[0],
  };
  const rawReview = reviewBoardMove(
    websiteDraft,
    dataset([], [enquiry]),
    today,
  );
  assert.equal(
    acceptBoardMoveReview(rawReview, dataset([], [enquiry]), today).reason,
    original.reason,
  );
  const linked = {
    ...enquiry,
    dashboardStatus: "converted" as const,
    dashboardEventId: event.id,
  };
  const convertedData = dataset(
    [{ ...event, revision: 5, notes: "Conversion already succeeded" }],
    [linked],
  );
  assert.throws(
    () => acceptBoardMoveReview(rawReview, convertedData, today),
    /changed again/,
  );
  const review = reviewBoardMove(websiteDraft, convertedData, today);
  const accepted = acceptBoardMoveReview(review, convertedData, today);
  assert.equal(accepted.card.kind, "event");
  assert.equal(accepted.card.id, event.id);
  assert.equal(accepted.card.revision, 5);
  assert.equal(accepted.reason, original.reason);
  assert.ok(
    reviewBoardMove(
      websiteDraft,
      dataset([], [{ ...linked, dashboardEventId: "" }]),
      today,
    ).blocker,
  );
});

test("Lost, completed Archive, Trash and reopened records have separate visibility without data loss", () => {
  const lost = {
    ...newEvent("Lost enquiry", today),
    archived: true,
    archiveReason: "Did not proceed",
  };
  const complete = {
    ...newEvent("Completed booked archive", today),
    archived: true,
    archiveReason: "Completed",
  };
  complete.finance.depositReceived = true;
  const trashedLost = { ...lost, id: crypto.randomUUID(), deletedAt: today };
  const trashedComplete = {
    ...complete,
    id: crypto.randomUUID(),
    deletedAt: today,
  };
  const reopened = { ...lost, id: crypto.randomUUID(), archived: false };
  const data = dataset([
    lost,
    complete,
    trashedLost,
    trashedComplete,
    reopened,
  ]);
  const before = structuredClone(data);
  assert.deepEqual(
    data.events.filter(isLostEnquiry).map((e) => e.id),
    [lost.id],
  );
  assert.deepEqual(
    data.events.filter(isCompletedArchive).map((e) => e.id),
    [complete.id],
  );
  assert.deepEqual(
    data.events.filter((e) => e.deletedAt).map((e) => e.id),
    [trashedLost.id, trashedComplete.id],
  );
  assert.deepEqual(
    boardCards(data, today).map((c) => c.id),
    [reopened.id],
  );
  assert.equal(reopened.archiveReason, lost.archiveReason);
  assert.deepEqual(data, before);
});
