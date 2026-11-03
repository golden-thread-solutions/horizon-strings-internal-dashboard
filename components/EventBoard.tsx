"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./Workspace";
import { errorMessage } from "./Controls";
import { BoardTitle, motionReduced } from "./WorkspaceMotion";
import { newEvent } from "@/lib/model";
import {
  boardCards,
  boardStages,
  eventCard,
  type BoardCard,
} from "@/lib/board";
import { businessToday, formatDate, money } from "@/lib/workflow";
import { isLostEnquiry, moveEnquiryToLost } from "@/lib/lost-enquiries";
import { stageRequirements, type ActiveStage } from "@/lib/board-moves";

type Destination = "" | ActiveStage | "Lost enquiries" | "Active board";
type Move = { card: BoardCard; target: Destination; lost: boolean };
export function EventBoard() {
  const { data, saveEvent, convertWebsiteEnquiry, refresh } = useWorkspace();
  const latest = useRef(data);
  latest.current = data;
  const router = useRouter();
  const [today, setToday] = useState(businessToday());
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("All active records");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [move, setMove] = useState<Move | null>(null);
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const dragSource = useRef<BoardCard | null>(null);
  const suppressClick = useRef(false);
  const pending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const moveDialog = useRef<HTMLDialogElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const lostCards = useRef<HTMLDivElement>(null);
  const lostTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setToday(businessToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!move) return;
    if (!moveDialog.current?.open) moveDialog.current?.showModal();
    if (move.target === "Lost enquiries") reasonInput.current?.focus();
  }, [move]);
  useEffect(() => {
    const el = lostCards.current;
    if (!expanded || !el || motionReduced()) return;
    const animation = el.animate(
      [
        { height: "0px", opacity: 0 },
        { height: `${el.scrollHeight}px`, opacity: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    return () => animation.cancel();
  }, [expanded]);
  const matches = (c: BoardCard) =>
    `${c.name} ${c.area} ${c.code}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const cards = boardCards(data, today).filter(
    (c) =>
      matches(c) &&
      (scope === "All active records" ||
        (scope === "Enquiries"
          ? boardStages.indexOf(c.stage as ActiveStage) < 3
          : boardStages.indexOf(c.stage as ActiveStage) >= 3)),
  );
  const lost = data.events
    .filter(isLostEnquiry)
    .map((e) => eventCard(e, data.settings, today))
    .filter(matches);
  function beginMove(card: BoardCard, target: Destination, lost = false) {
    if (pending.current) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setError("");
    setReason("");
    setMove({ card, target, lost });
  }
  function closeMove() {
    if (pending.current) return;
    moveDialog.current?.close();
    setMove(null);
    setError("");
    requestAnimationFrame(() => {
      if (
        returnFocus.current?.isConnected &&
        returnFocus.current !== document.body
      )
        returnFocus.current.focus({ preventScroll: true });
      else lostTrigger.current?.focus({ preventScroll: true });
    });
  }
  function dragStart(e: DragEvent<HTMLElement>, card: BoardCard) {
    if (pending.current || (e.target as HTMLElement).closest("button")) {
      e.preventDefault();
      return;
    }
    dragSource.current = card;
    suppressClick.current = true;
    setDragging(card.id);
    setStatus("");
    e.dataTransfer.setData(
      "application/x-horizon-card",
      `${card.kind}:${card.id}`,
    );
    e.dataTransfer.effectAllowed = "move";
  }
  function dragOver(e: DragEvent<HTMLElement>, target: Destination) {
    if (!dragSource.current || pending.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  }
  function drop(e: DragEvent<HTMLElement>, target: Destination) {
    const card = dragSource.current;
    if (!card || pending.current) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget("");
    setDragging("");
    dragSource.current = null;
    beginMove(card, target);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await saveEvent(newEvent(name, today));
      dialog.current?.close();
      router.push(`/clients/${saved.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const selected =
    move?.card.kind === "event"
      ? data.events.find((e) => e.id === move.card.id)
      : data.events.find(
          (e) =>
            e.id ===
            data.websiteEnquiries.find((q) => q.id === move?.card.id)
              ?.dashboardEventId,
        );
  const booked = Boolean(selected?.finance.depositReceived);
  const plan =
    move && boardStages.includes(move.target as ActiveStage)
      ? stageRequirements(
          selected,
          data.settings,
          move.target as ActiveStage,
          today,
        )
      : null;
  const destinationHref = selected
    ? `/clients/${selected.id}${plan ? `#${plan.section}` : ""}`
    : move?.card.href;
  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    if (!move || pending.current) return;
    if (move.target !== "Lost enquiries" && move.target !== "Active board")
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (move.target === "Active board") {
        const current = latest.current.events.find(
          (e) => e.id === move.card.id,
        );
        if (
          !current ||
          !isLostEnquiry(current) ||
          current.revision !== move.card.revision
        )
          throw new Error(
            "This enquiry changed. Reload and review it before reopening.",
          );
        await saveEvent({ ...current, archived: false });
        setStatus(
          `${current.name} reopened. Its stage follows the saved facts.`,
        );
      } else {
        const saved = await moveEnquiryToLost(
          {
            kind: move.card.kind,
            id: move.card.id,
            revision: move.card.revision,
          },
          reason,
          {
            event: (id) => latest.current.events.find((e) => e.id === id),
            enquiry: (id) =>
              latest.current.websiteEnquiries.find((e) => e.id === id),
            convert: convertWebsiteEnquiry,
            save: saveEvent,
          },
        );
        setExpanded(true);
        setStatus(`${saved.name} moved to Lost enquiries.`);
      }
      moveDialog.current?.close();
      setMove(null);
      requestAnimationFrame(() =>
        lostTrigger.current?.focus({ preventScroll: true }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function renderCard(c: BoardCard, isLost = false) {
    return (
      <article
        key={`${c.kind}:${c.id}`}
        className={`board-card-shell ${dragging === c.id ? "is-dragging" : ""}`}
        draggable={!isLost && !busy}
        onDragStart={(e) => dragStart(e, c)}
        onDragEnd={() => {
          dragSource.current = null;
          setDragging("");
          setDropTarget("");
          setTimeout(() => (suppressClick.current = false), 150);
        }}
      >
        <Link
          href={c.href}
          className="board-card"
          draggable={false}
          onClick={(e) => {
            if (suppressClick.current) e.preventDefault();
          }}
        >
          <span className="board-card-date">
            {c.date ? formatDate(c.date) : "Date TBC"}
          </span>
          <strong className="board-card-name">{c.name}</strong>
          <span className="board-card-area">{c.area || "Area TBC"}</span>
          <span className="board-card-value">
            {c.value === null ? "Value TBC" : money(c.value)}
          </span>
        </Link>
        <button
          type="button"
          className="card-move-button"
          aria-label={`${isLost ? "Reopen" : "Move"} ${c.name}`}
          aria-haspopup="dialog"
          disabled={busy}
          onClick={() => beginMove(c, isLost ? "Active board" : "", isLost)}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              d="M5 12h14m-4-4 4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </article>
    );
  }
  return (
    <>
      <header className="page-head board-page-head">
        <div>
          <span className="eyebrow">THE EVENT REGISTER</span>
          <BoardTitle />
        </div>
        <button
          onClick={() => {
            setName("");
            setError("");
            dialog.current?.showModal();
          }}
        >
          ＋ New enquiry
        </button>
      </header>
      <div className="toolbar board-toolbar">
        <label className="search-label">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, event ID or area"
          />
        </label>
        <label>
          Show
          <select
            aria-label="Show records"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option>All active records</option>
            <option>Enquiries</option>
            <option>Booked events</option>
          </select>
        </label>
        <span className="muted">
          {cards.length} {cards.length === 1 ? "record" : "records"}
        </span>
        <Link className="board-archive-link" href="/archive">
          Archived events
        </Link>
        <Link href="/trash">Trash</Link>
      </div>
      <p className="board-guidance" id="board-instructions">
        Drag a card to see the next stage’s requirements, or use its move
        button. Moving to Lost asks for a reason.
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="board-status"
      >
        {status && <p>{status}</p>}
      </div>
      <div
        ref={board}
        className={`event-board ${dragging ? "has-drag" : ""}`}
        role="region"
        aria-label="Active events and enquiries Kanban"
        aria-describedby="board-instructions"
        tabIndex={0}
        onDragOver={(e) => {
          if (!dragSource.current || !board.current) return;
          const r = board.current.getBoundingClientRect();
          if (e.clientX < r.left + 30) board.current.scrollLeft -= 18;
          else if (e.clientX > r.right - 30) board.current.scrollLeft += 18;
        }}
      >
        {boardStages.map((stage, i) => {
          const items = cards.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              className={`board-column board-column-${i} ${dropTarget === stage ? "is-drop-target" : ""}`}
              aria-labelledby={`stage-${i}`}
              onDragOver={(e) => dragOver(e, stage)}
              onDragEnter={(e) => dragOver(e, stage)}
              onDrop={(e) => drop(e, stage)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setDropTarget("");
              }}
            >
              <header className="board-column-head">
                <h2 id={`stage-${i}`}>{stage}</h2>
                <span
                  className="board-count"
                  aria-label={`${items.length} records`}
                >
                  {items.length}
                </span>
              </header>
              <div className="board-column-cards">
                {items.map((c) => renderCard(c))}
                {!items.length && (
                  <p className="board-empty">
                    No{" "}
                    {search || scope !== "All active records"
                      ? "matching "
                      : ""}
                    records
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <section
        className={`lost-enquiries ${dropTarget === "Lost enquiries" ? "is-drop-target" : ""} ${dragging ? "is-receiving" : ""}`}
        aria-labelledby="lost-heading"
        onDragOver={(e) => dragOver(e, "Lost enquiries")}
        onDragEnter={(e) => dragOver(e, "Lost enquiries")}
        onDrop={(e) => drop(e, "Lost enquiries")}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDropTarget("");
        }}
      >
        <div className="lost-summary">
          <div>
            <h2 id="lost-heading">
              Lost enquiries <span>{lost.length}</span>
            </h2>
            <p>Enquiries that did not proceed. Kept separately from Trash.</p>
          </div>
          <button
            ref={lostTrigger}
            className="secondary"
            aria-expanded={expanded}
            aria-controls="lost-cards"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide enquiries" : "View enquiries"}
          </button>
        </div>
        <div
          ref={lostCards}
          id="lost-cards"
          hidden={!expanded}
          className="lost-cards"
        >
          {lost.map((c) => renderCard(c, true))}
          {!lost.length && (
            <p className="empty">
              No {search ? "matching " : ""}lost enquiries.
            </p>
          )}
        </div>
      </section>
      <dialog
        ref={moveDialog}
        className="workspace-dialog move-dialog"
        aria-labelledby="move-heading"
        onCancel={(e) => {
          e.preventDefault();
          closeMove();
        }}
      >
        {move && (
          <form onSubmit={submitMove}>
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">{move.card.name}</span>
                <h2 id="move-heading">
                  {move.lost ? "Reopen enquiry" : "Move enquiry or event"}
                </h2>
              </div>
              <button
                type="button"
                className="dialog-close secondary"
                aria-label="Close move dialog"
                disabled={busy}
                onClick={closeMove}
              >
                ×
              </button>
            </div>
            <label>
              Destination
              <select
                aria-label="Move destination"
                value={move.target}
                disabled={busy}
                onChange={(e) => {
                  setError("");
                  setMove({ ...move, target: e.target.value as Destination });
                }}
              >
                <option value="" disabled>
                  Choose destination
                </option>
                {move.lost ? (
                  <option>Active board</option>
                ) : (
                  <>
                    {boardStages.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                    <option disabled={booked}>Lost enquiries</option>
                  </>
                )}
              </select>
            </label>
            {plan && (
              <div className="move-requirements">
                <p>{plan.description}</p>
                <p className="muted">
                  Stages follow recorded facts. This move will not mark a
                  message sent, a payment received or work completed.
                </p>
                {plan.items.length > 0 ? (
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No outstanding requirements are detected for this stage.
                  </p>
                )}
              </div>
            )}
            {move.target === "Lost enquiries" && (
              <>
                <p>
                  This closes an unbooked enquiry and stops its future actions.
                  You can reopen it later.
                </p>
                <label>
                  Reason it did not proceed
                  <textarea
                    ref={reasonInput}
                    required
                    maxLength={10000}
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            {move.target === "Active board" && (
              <p>
                Reopen this enquiry on the active board. Its stage will follow
                the saved facts; its recorded lost reason is retained.
              </p>
            )}
            {booked && (
              <p className="muted">
                Booked events cannot be moved to Lost enquiries. Handle
                cancellation in the event workspace.
              </p>
            )}
            {error && (
              <div role="alert" className="error">
                <p>{error}</p>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await refresh();
                      setError(
                        "Board reloaded. Review the current event in its workspace before retrying; your reason is retained here.",
                      );
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  Reload board
                </button>
              </div>
            )}
            <div className="row-actions">
              {(move.target === "Lost enquiries" ||
                move.target === "Active board") && (
                <button disabled={busy || booked}>
                  {busy
                    ? "Saving…"
                    : move.target === "Lost enquiries"
                      ? "Move to Lost enquiries"
                      : "Reopen enquiry"}
                </button>
              )}
              {plan && destinationHref && (
                <Link
                  className="button"
                  href={destinationHref}
                  onClick={closeMove}
                >
                  Open {selected ? "event workspace" : "enquiry"}
                </Link>
              )}
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={closeMove}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={dialog}
        className="workspace-dialog"
        aria-labelledby="new-enquiry-heading"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form onSubmit={create}>
          <h2 id="new-enquiry-heading">New enquiry</h2>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={300}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="muted">
            A name is enough to start. Add other details when you know them.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button disabled={busy}>
              {busy ? "Creating…" : "Create enquiry"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
