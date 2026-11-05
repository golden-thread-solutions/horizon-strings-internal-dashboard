import { boardCards, eventCard, type BoardCard } from "./board";
import type { ActiveStage } from "./board-moves";
import type { Dataset, EventRecord, WebsiteEnquiry } from "./model";
import { isLostEnquiry } from "./lost-enquiries";

export type MoveDestination =
  | ""
  | ActiveStage
  | "Lost enquiries"
  | "Active board";
export type MoveDraft = {
  card: BoardCard;
  target: MoveDestination;
  lost: boolean;
  reason: string;
};
export type MoveReview = {
  draft: MoveDraft;
  event?: EventRecord;
  enquiry?: WebsiteEnquiry;
  blocker: string;
};

// Loading a candidate is not accepting it or retrying a save. The dialog keeps
// its draft until the owner explicitly accepts the displayed saved version.
export function reviewBoardMove(
  draft: MoveDraft,
  data: Dataset,
  today: string,
): MoveReview {
  const enquiry =
    draft.card.kind === "enquiry"
      ? data.websiteEnquiries.find((q) => q.id === draft.card.id)
      : undefined;
  const event = data.events.find(
    (e) =>
      e.id ===
      (draft.card.kind === "event" ? draft.card.id : enquiry?.dashboardEventId),
  );
  const card = event
    ? eventCard(event, data.settings, today)
    : boardCards(data, today).find(
        (c) => c.kind === draft.card.kind && c.id === draft.card.id,
      );
  let blocker = "";
  if (!card)
    blocker =
      "This record is no longer available for this move. Review its workspace before continuing.";
  else if (event?.deletedAt)
    blocker = "This event is now in Trash. It cannot be moved here.";
  else if (event?.finance.depositReceived)
    blocker =
      "This is now a booked event. It cannot be moved as a lost enquiry.";
  else if (draft.target === "Active board" && (!event || !isLostEnquiry(event)))
    blocker = "This enquiry is no longer in Lost. No reopen is needed.";
  else if (draft.target === "Lost enquiries" && event?.archived)
    blocker =
      "This enquiry is already in Lost. Its saved reason is retained; no further move is needed.";
  return {
    draft: { ...draft, card: card || draft.card },
    event,
    enquiry,
    blocker,
  };
}

export function acceptBoardMoveReview(
  review: MoveReview,
  data: Dataset,
  today: string,
): MoveDraft {
  if (review.blocker) throw new Error(review.blocker);
  const current = reviewBoardMove(review.draft, data, today);
  if (current.blocker) throw new Error(current.blocker);
  if (
    current.draft.card.kind !== review.draft.card.kind ||
    current.draft.card.id !== review.draft.card.id ||
    current.event?.revision !== review.event?.revision ||
    (!current.event &&
      JSON.stringify(current.enquiry) !== JSON.stringify(review.enquiry))
  ) {
    throw new Error(
      "This record changed again during review. Reload and review the new version before retrying.",
    );
  }
  return current.draft;
}
