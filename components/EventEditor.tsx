"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "./Workspace";
import { Field, Select, Check, Notes, Section, errorMessage } from "./Controls";
import {
  detailKeys,
  detailLabels,
  type EventRecord,
  type Resolution,
} from "@/lib/model";
import {
  balance,
  businessToday,
  canArchive,
  deferredDate,
  deriveStage,
  eventActions,
  formatDate,
  missingDetails,
  money,
  playerCount,
  profit,
  readiness,
  received,
  totalFee,
  weeksBefore,
} from "@/lib/workflow";
import { ActionTable } from "./ActionQueue";

const milestoneLabels: Record<keyof EventRecord["milestones"], string> = {
  responded: "Enquiry response sent",
  welcomeSent: "Welcome / deposit email sent",
  finalConfirmed: "Final event details confirmed",
  thankYouSent: "Post-event thank you sent",
  reviewRequested: "Review requested",
};
const detailsHints: Record<keyof typeof detailLabels, string> = {
  timing:
    "Arrival, play start, pre-ceremony music, ceremony start / length, post-ceremony music and finish.",
  venueSetup:
    "Exact playing position, indoor / outdoor, movement and any second address.",
  wetWeather:
    "Alternative location, decision time, shelter and who makes the call.",
  onDayContact:
    "Name, phone and role. Full contacts can also be entered above.",
  repertoireBrief:
    "Genre, entrances, signing, recessional, first dance and other requests.",
  rehearsal: "Date, place, participants and whether a rehearsal is required.",
  logistics:
    "Chairs, shelter, dress, amplification, guests, ceremony signal and other requirements.",
  runSheet:
    "Confirmed sequence and timing of the day. Defer to Final Details if appropriate.",
};
type OperationalField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time";
  multiline?: boolean;
};
const operationalFields: Record<keyof typeof detailLabels, OperationalField[]> =
  {
    timing: [
      { key: "arrivalTime", label: "Arrival time", type: "time" },
      { key: "playStartTime", label: "Playing starts", type: "time" },
      {
        key: "preCeremonyMinutes",
        label: "Pre-ceremony music (minutes)",
        type: "number",
      },
      { key: "ceremonyStartTime", label: "Ceremony starts", type: "time" },
      {
        key: "ceremonyDurationMinutes",
        label: "Ceremony duration (minutes)",
        type: "number",
      },
      {
        key: "remainingPlayMinutes",
        label: "Remaining playing time (minutes)",
        type: "number",
      },
      {
        key: "postCeremonyDetails",
        label: "Post-ceremony timing and details",
        multiline: true,
      },
      { key: "otherStartTime", label: "Other playing starts", type: "time" },
      { key: "otherFinishTime", label: "Other playing finishes", type: "time" },
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
function hasOperationalInfo(values: Record<string, string | number>) {
  return Object.values(values).some((value) =>
    typeof value === "number" ? value > 0 : value.trim().length > 0,
  );
}
export function EventEditor({ event }: { event: EventRecord }) {
  const { data, saveEvent, refresh } = useWorkspace();
  const [draft, setDraft] = useState(() => structuredClone(event));
  const [saved, setSaved] = useState(() => JSON.stringify(event));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(draft) !== saved;
  const today = businessToday();
  const settings = data.settings;
  const change = (fn: (copy: EventRecord) => void) => {
    setDraft((current) => {
      const copy = structuredClone(current);
      fn(copy);
      return copy;
    });
    setNotice("");
  };
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        a?.getAttribute("href")?.startsWith("/") &&
        !window.confirm("You have unsaved event changes. Leave this page?")
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (
        draft.archived &&
        draft.finance.depositReceived &&
        !canArchive({ ...draft, archived: false }, settings, today)
      )
        throw new Error(
          "Resolve all post-event actions before archiving a booked event.",
        );
      if (
        draft.archived &&
        !draft.finance.depositReceived &&
        !draft.archiveReason.trim()
      )
        throw new Error("Add a reason for closing this enquiry.");
      const result = await saveEvent(draft);
      setDraft(result);
      setSaved(JSON.stringify(result));
      setNotice("Saved. Workflow and action dates updated.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const stage = deriveStage(draft, settings, today);
  const missing = missingDetails(draft);
  const blockers = readiness(draft, settings);
  return (
    <form onSubmit={submit}>
      <header className="page-head">
        <div>
          <Link className="back-link" href="/clients">
            ← Events & enquiries
          </Link>
          <h1>{draft.name}</h1>
          <p>
            {draft.code} · {formatDate(draft.eventDate)} ·{" "}
            {draft.area || "Area to be confirmed"}
          </p>
        </div>
        <span className="stage">
          {draft.archived ? "Archived · " : ""}
          {stage}
        </span>
      </header>
      <div className="save-bar">
        <span>
          {busy ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                dirty &&
                !window.confirm(
                  "Discard unsaved edits and load the latest saved event?",
                )
              )
                return;
              try {
                await refresh();
                setNotice(
                  "Latest data loaded. Reopen this event if another owner changed it.",
                );
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Reload saved data
          </button>
          <button disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save event"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      <nav className="section-nav">
        {[
          ["main", "Main details"],
          ["contacts", "Contacts"],
          ["details", "Event details"],
          ["musicians", "Musicians"],
          ["repertoire", "Repertoire"],
          ["finance", "Finance"],
          ["communications", "Communications"],
          ["tasks", "Actions"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <div className="workflow-note">
        <strong>
          {missing.length
            ? `${missing.length} details still unknown`
            : "Initial details resolved"}
        </strong>
        <span>
          {stage === "Details Pending" && !missing.length
            ? `Internal Organisation starts ${formatDate(weeksBefore(draft, settings.internalWeeks))}.`
            : "Stage updates from saved facts, dates and payment state."}
        </span>
        <details>
          <summary>
            Event Ready requirements · {blockers.length} outstanding
          </summary>
          {blockers.length ? (
            <ul>
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p>All critical pre-event requirements are resolved.</p>
          )}
        </details>
      </div>
      <Section id="main" title="Main details">
        <div className="field-grid">
          <Field
            label="Event / client name"
            required
            value={draft.name}
            onChange={(v) =>
              change((e) => {
                e.name = v;
              })
            }
          />
          <Field
            label="Event date"
            type="date"
            value={draft.eventDate}
            onChange={(v) =>
              change((e) => {
                e.eventDate = v;
              })
            }
          />
          <Field
            label="Event type"
            value={draft.eventType}
            onChange={(v) =>
              change((e) => {
                e.eventType = v;
              })
            }
          />
          <Select
            label="Ensemble"
            value={draft.ensemble}
            options={[
              "",
              "Solo",
              "Duo",
              "Trio",
              "Quartet",
              "Quintet",
              "Sextet",
            ]}
            onChange={(v) =>
              change((e) => {
                e.ensemble = v as EventRecord["ensemble"];
              })
            }
          />
          <Field
            label="Playing duration (minutes)"
            type="number"
            min={0}
            max={1440}
            value={draft.durationMinutes}
            onChange={(v) =>
              change((e) => {
                e.durationMinutes = Number(v);
              })
            }
          />
          <Field
            label="Enquiry source / medium"
            value={draft.source}
            onChange={(v) =>
              change((e) => {
                e.source = v;
              })
            }
          />
          <Field
            label="Area"
            value={draft.area}
            hint="Town or region, separate from the address."
            onChange={(v) =>
              change((e) => {
                e.area = v;
              })
            }
          />
          <Field
            label="Address"
            value={draft.address}
            onChange={(v) =>
              change((e) => {
                e.address = v;
              })
            }
          />
        </div>
        <Notes
          label="General notes"
          value={draft.notes}
          onChange={(v) =>
            change((e) => {
              e.notes = v;
            })
          }
        />
      </Section>
      <Section
        id="contacts"
        title="Contacts"
        aside={
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change((e) => {
                e.contacts.push({
                  id: crypto.randomUUID(),
                  role: e.contacts.length ? "Other" : "Main contact",
                  name: "",
                  phone: "",
                  email: "",
                  notes: "",
                });
              })
            }
          >
            Add contact
          </button>
        }
      >
        {draft.contacts.length === 0 && (
          <p className="empty">
            Add the main booker and any day-of, venue or celebrant contacts.
          </p>
        )}
        {draft.contacts.map((c, i) => (
          <div className="editable-row" key={c.id}>
            <div className="field-grid">
              <Select
                label="Contact role"
                value={c.role}
                options={[
                  "Main contact",
                  "On-the-day contact",
                  "Celebrant",
                  "Venue / coordinator",
                  "Couple member",
                  "Other",
                ]}
                onChange={(v) =>
                  change((e) => {
                    e.contacts[i].role = v;
                  })
                }
              />
              <Field
                label="Contact name"
                value={c.name}
                onChange={(v) =>
                  change((e) => {
                    e.contacts[i].name = v;
                  })
                }
              />
              <Field
                label="Email"
                type="email"
                value={c.email}
                onChange={(v) =>
                  change((e) => {
                    e.contacts[i].email = v;
                  })
                }
              />
              <Field
                label="Phone"
                type="tel"
                value={c.phone}
                onChange={(v) =>
                  change((e) => {
                    e.contacts[i].phone = v;
                  })
                }
              />
            </div>
            <Field
              label="Contact notes"
              value={c.notes}
              onChange={(v) =>
                change((e) => {
                  e.contacts[i].notes = v;
                })
              }
            />
            <div className="row-actions">
              {c.email && (
                <a
                  href={`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(`Horizon Strings — ${draft.name}`)}`}
                >
                  Open email
                </a>
              )}
              <button
                type="button"
                className="text-button danger"
                onClick={() =>
                  change((e) => {
                    e.contacts.splice(i, 1);
                  })
                }
              >
                Remove contact
              </button>
            </div>
          </div>
        ))}
      </Section>
      <Section id="details" title="Event details & unresolved information">
        <p className="section-intro">
          Mark each detail Filled, Not Applicable, or Deferred. Deferred details
          need a date or a workflow trigger and remain visible in your actions.
        </p>
        {detailKeys.map((k) => (
          <div
            className={`resolution-row state-${draft.details[k].state.toLowerCase().replace(" ", "-")}`}
            key={k}
          >
            <div className="resolution-heading">
              <div>
                <strong>{detailLabels[k]}</strong>
                <p className="muted">{detailsHints[k]}</p>
              </div>
              <Check
                label="N/A"
                checked={draft.details[k].state === "Not Applicable"}
                onChange={(checked) =>
                  change((e) => {
                    e.details[k].state = checked
                      ? "Not Applicable"
                      : hasOperationalInfo(e.operational[k]) ||
                          Boolean(e.details[k].value.trim())
                        ? "Filled"
                        : "Unknown";
                  })
                }
              />
            </div>
            {draft.details[k].state !== "Not Applicable" && (
              <div className="resolution-body">
                <Select
                  label={`${detailLabels[k]} status`}
                  value={draft.details[k].state}
                  options={["Unknown", "Filled", "Not Applicable", "Deferred"]}
                  onChange={(v) =>
                    change((e) => {
                      e.details[k].state = v as Resolution["state"];
                    })
                  }
                />
                <div className="field-grid two operational-fields">
                  {operationalFields[k].map((field) => {
                    const current = draft.operational[k][field.key] ?? "";
                    const update = (value: string) =>
                      change((e) => {
                        e.operational[k][field.key] =
                          field.type === "number" ? Number(value) : value;
                        const hasInfo =
                          hasOperationalInfo(e.operational[k]) ||
                          Boolean(e.details[k].value.trim());
                        if (e.details[k].state === "Unknown" && hasInfo)
                          e.details[k].state = "Filled";
                        if (e.details[k].state === "Filled" && !hasInfo)
                          e.details[k].state = "Unknown";
                      });
                    return field.multiline ? (
                      <Notes
                        key={field.key}
                        label={field.label}
                        value={String(current)}
                        onChange={update}
                      />
                    ) : (
                      <Field
                        key={field.key}
                        label={field.label}
                        type={field.type}
                        min={field.type === "number" ? 0 : undefined}
                        value={current}
                        onChange={update}
                      />
                    );
                  })}
                </div>
                <Notes
                  label="Additional notes"
                  value={draft.details[k].value}
                  onChange={(v) =>
                    change((e) => {
                      e.details[k].value = v;
                      if (e.details[k].state === "Unknown" && v.trim())
                        e.details[k].state = "Filled";
                      if (
                        e.details[k].state === "Filled" &&
                        !v.trim() &&
                        !hasOperationalInfo(e.operational[k])
                      )
                        e.details[k].state = "Unknown";
                    })
                  }
                />
                {draft.details[k].state === "Deferred" && (
                  <>
                    <div className="field-grid two">
                      <Field
                        label="Resolve on date"
                        type="date"
                        value={draft.details[k].dueDate}
                        onChange={(v) =>
                          change((e) => {
                            e.details[k].dueDate = v;
                            if (v) e.details[k].trigger = "";
                          })
                        }
                      />
                      <Select
                        label="Or resolve at stage"
                        value={draft.details[k].trigger}
                        options={["", "Internal Organisation", "Final Details"]}
                        onChange={(v) =>
                          change((e) => {
                            e.details[k].trigger = v as Resolution["trigger"];
                            if (v) e.details[k].dueDate = "";
                          })
                        }
                      />
                    </div>
                    <p className="muted">
                      {deferredDate(draft, k, settings)
                        ? `Due ${formatDate(deferredDate(draft, k, settings))}`
                        : "Choose a date or stage. A stage trigger also needs an event date to calculate its due date."}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </Section>
      <Section
        id="musicians"
        title="Musicians"
        aside={
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change((e) => {
                e.musicians.push({
                  id: crypto.randomUUID(),
                  musicianId: "",
                  name: "",
                  instrument: "",
                  confirmed: false,
                  musicSent: false,
                  contractRequired: false,
                  signed: false,
                  paid: false,
                  fee: 0,
                  notes: "",
                });
              })
            }
          >
            Add player
          </button>
        }
      >
        <p className="section-intro">
          {playerCount(draft.ensemble) || "Choose an ensemble to set"} players
          required · {draft.musicians.filter((m) => m.confirmed).length}{" "}
          confirmed · Due{" "}
          {formatDate(weeksBefore(draft, settings.musiciansWeeks))}
        </p>
        {draft.musicians.map((m, i) => (
          <div key={m.id} className="editable-row">
            <div className="field-grid">
              <label>
                Use musician directory
                <select
                  value={m.musicianId}
                  onChange={(event) =>
                    change((e) => {
                      const found = data.musicians.find(
                        (p) => p.id === event.target.value,
                      );
                      e.musicians[i].musicianId = event.target.value;
                      if (found) {
                        e.musicians[i].name = found.name;
                        e.musicians[i].instrument = found.instrument;
                      }
                    })
                  }
                >
                  <option value="">Enter manually</option>
                  {data.musicians.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.instrument}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Musician name"
                value={m.name}
                onChange={(v) =>
                  change((e) => {
                    e.musicians[i].name = v;
                  })
                }
              />
              <Field
                label="Instrument / role"
                value={m.instrument}
                onChange={(v) =>
                  change((e) => {
                    e.musicians[i].instrument = v;
                  })
                }
              />
              <Field
                label="Player fee (AUD)"
                type="number"
                min={0}
                value={m.fee}
                onChange={(v) =>
                  change((e) => {
                    e.musicians[i].fee = Number(v);
                  })
                }
              />
            </div>
            <div className="checks">
              {(
                [
                  ["confirmed", "Confirmed"],
                  ["musicSent", "Music provided"],
                  ["contractRequired", "Contract required"],
                  ["signed", "Contract signed"],
                  ["paid", "Paid"],
                ] as const
              ).map(([key, label]) => (
                <Check
                  key={key}
                  label={label}
                  checked={m[key]}
                  onChange={(v) =>
                    change((e) => {
                      e.musicians[i][key] = v;
                    })
                  }
                />
              ))}
            </div>
            <Field
              label="Musician notes"
              value={m.notes}
              onChange={(v) =>
                change((e) => {
                  e.musicians[i].notes = v;
                })
              }
            />
            <button
              type="button"
              className="text-button danger"
              onClick={() =>
                change((e) => {
                  e.musicians.splice(i, 1);
                })
              }
            >
              Remove player
            </button>
          </div>
        ))}
      </Section>
      <Section
        id="repertoire"
        title="Repertoire & arrangements"
        aside={
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change((e) => {
                e.repertoire.push({
                  id: crypto.randomUUID(),
                  pieceId: "",
                  title: "",
                  moment: "",
                  status: "Requested",
                  notes: "",
                });
              })
            }
          >
            Add piece
          </button>
        }
      >
        <p className="section-intro">
          Setlist due {formatDate(weeksBefore(draft, settings.repertoireWeeks))}{" "}
          · Arrangements due{" "}
          {formatDate(weeksBefore(draft, settings.arrangementsWeeks))}
        </p>
        {draft.repertoire.map((r, i) => (
          <div key={r.id} className="editable-row">
            <div className="field-grid">
              <label>
                Use repertoire catalogue
                <select
                  value={r.pieceId}
                  onChange={(event) =>
                    change((e) => {
                      const piece = data.pieces.find(
                        (p) => p.id === event.target.value,
                      );
                      e.repertoire[i].pieceId = event.target.value;
                      if (piece) e.repertoire[i].title = piece.title;
                    })
                  }
                >
                  <option value="">New / custom request</option>
                  {data.pieces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {p.artist}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Piece title"
                value={r.title}
                onChange={(v) =>
                  change((e) => {
                    e.repertoire[i].title = v;
                  })
                }
              />
              <Field
                label="Moment / purpose"
                value={r.moment}
                hint="Processional, signing, recessional, first dance…"
                onChange={(v) =>
                  change((e) => {
                    e.repertoire[i].moment = v;
                  })
                }
              />
              <Select
                label="Piece status"
                value={r.status}
                options={[
                  "Requested",
                  "Needs arranging",
                  "Available",
                  "Approved",
                  "Not Applicable",
                ]}
                onChange={(v) =>
                  change((e) => {
                    e.repertoire[i].status =
                      v as EventRecord["repertoire"][number]["status"];
                  })
                }
              />
            </div>
            <Field
              label="Arrangement / piece notes"
              value={r.notes}
              onChange={(v) =>
                change((e) => {
                  e.repertoire[i].notes = v;
                })
              }
            />
            <button
              type="button"
              className="text-button danger"
              onClick={() =>
                change((e) => {
                  e.repertoire.splice(i, 1);
                })
              }
            >
              Remove piece
            </button>
          </div>
        ))}
      </Section>
      <Section id="finance" title="Finance">
        <div className="finance-line">
          <span>
            Total fee <strong>{money(totalFee(draft))}</strong>
          </span>
          <span>
            Received <strong>{money(received(draft))}</strong>
          </span>
          <span>
            Outstanding <strong>{money(balance(draft))}</strong>
          </span>
          <span>
            Estimated profit <strong>{money(profit(draft))}</strong>
          </span>
        </div>
        <div className="finance-group">
          <h3>Deposit</h3>
          <div className="field-grid">
            <Field
              label="Deposit requested (AUD)"
              type="number"
              min={0}
              value={draft.finance.depositRequired}
              onChange={(v) =>
                change((e) => {
                  e.finance.depositRequired = Number(v);
                })
              }
            />
            <Field
              label="Deposit received amount (AUD)"
              type="number"
              min={0}
              value={draft.finance.depositAmount}
              onChange={(v) =>
                change((e) => {
                  e.finance.depositAmount = Number(v);
                })
              }
            />
            <Field
              label="Deposit received date"
              type="date"
              value={draft.finance.depositDate}
              onChange={(v) =>
                change((e) => {
                  e.finance.depositDate = v;
                })
              }
            />
          </div>
          <Check
            label="Deposit received — booking confirmed"
            checked={draft.finance.depositReceived}
            onChange={(v) =>
              change((e) => {
                e.finance.depositReceived = v;
                if (v && !e.finance.depositDate) e.finance.depositDate = today;
              })
            }
          />
        </div>
        <div className="finance-group">
          <h3>Client fees</h3>
          <div className="field-grid">
            {(
              [
                ["performance", "Performance fee"],
                ["travel", "Travel fee"],
                ["arrangements", "Arrangement fee"],
                ["otherCharges", "Other client charges"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={`${label} (AUD)`}
                type="number"
                min={0}
                value={draft.finance[key]}
                onChange={(v) =>
                  change((e) => {
                    e.finance[key] = Number(v);
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="finance-group">
          <h3>Balance & invoice</h3>
          <div className="field-grid">
            <Field
              label="Other / final payments received (AUD)"
              type="number"
              min={0}
              value={draft.finance.finalReceived}
              onChange={(v) =>
                change((e) => {
                  e.finance.finalReceived = Number(v);
                })
              }
            />
            <Field
              label="Final payment date"
              type="date"
              value={draft.finance.finalDate}
              onChange={(v) =>
                change((e) => {
                  e.finance.finalDate = v;
                })
              }
            />
            <Field
              label="Invoice reference"
              value={draft.finance.invoiceReference}
              onChange={(v) =>
                change((e) => {
                  e.finance.invoiceReference = v;
                })
              }
            />
          </div>
          <Check
            label="Final invoice sent"
            checked={draft.finance.invoiceSent}
            onChange={(v) =>
              change((e) => {
                e.finance.invoiceSent = v;
              })
            }
          />
        </div>
        <div className="finance-group">
          <h3>Internal costs</h3>
          <div className="field-grid">
            <Field
              label="Other event expenses (AUD)"
              type="number"
              min={0}
              value={draft.finance.otherCosts}
              onChange={(v) =>
                change((e) => {
                  e.finance.otherCosts = Number(v);
                })
              }
            />
          </div>
        </div>
        <p className="muted">
          Player fees are recorded in Musicians above. Record only payments
          actually received; overpayments remain visible in received totals.
        </p>
      </Section>
      <Section id="communications" title="Communications & key actions">
        <p className="section-intro">
          Send messages through your usual email or phone, then record what
          happened here. Nothing is sent automatically.
        </p>
        <div className="milestones">
          {(
            Object.keys(milestoneLabels) as (keyof EventRecord["milestones"])[]
          ).map((key) => (
            <div key={key}>
              <Field
                label={milestoneLabels[key]}
                type="date"
                value={draft.milestones[key]}
                onChange={(v) =>
                  change((e) => {
                    e.milestones[key] = v;
                  })
                }
              />
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  change((e) => {
                    e.milestones[key] = e.milestones[key] ? "" : today;
                  })
                }
              >
                {draft.milestones[key] ? "Clear" : "Record today"}
              </button>
            </div>
          ))}
        </div>
        <div className="section-heading">
          <h3>Contact history</h3>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change((e) => {
                e.communicationLog.push({
                  id: crypto.randomUUID(),
                  date: today,
                  recipient: "",
                  summary: "",
                });
              })
            }
          >
            Add contact note
          </button>
        </div>
        {draft.communicationLog.map((log, i) => (
          <div className="editable-row" key={log.id}>
            <div className="field-grid two">
              <Field
                label="Contact date"
                type="date"
                value={log.date}
                onChange={(v) =>
                  change((e) => {
                    e.communicationLog[i].date = v;
                  })
                }
              />
              <Field
                label="Recipient / contact"
                value={log.recipient}
                onChange={(v) =>
                  change((e) => {
                    e.communicationLog[i].recipient = v;
                  })
                }
              />
            </div>
            <Notes
              label="Contact summary"
              value={log.summary}
              onChange={(v) =>
                change((e) => {
                  e.communicationLog[i].summary = v;
                })
              }
            />
            <button
              type="button"
              className="text-button danger"
              onClick={() =>
                change((e) => {
                  e.communicationLog.splice(i, 1);
                })
              }
            >
              Remove note
            </button>
          </div>
        ))}
      </Section>
      <Section
        id="tasks"
        title="Event actions"
        aside={
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change((e) => {
                e.tasks.push({
                  id: crypto.randomUUID(),
                  title: "",
                  kind: "Task",
                  dueDate: today,
                  assignee: "",
                  recipient: "",
                  notes: "",
                  done: false,
                  completedAt: "",
                });
              })
            }
          >
            Add action
          </button>
        }
      >
        <h3>Generated from event facts</h3>
        <ActionTable
          actions={eventActions(draft, settings, today).filter(
            (a) => a.origin === "Generated",
          )}
          today={today}
        />
        <p className="muted">
          Resolve the underlying event detail to complete a generated action.
        </p>
        <h3>Manual actions</h3>
        {draft.tasks.map((task, i) => (
          <div className="editable-row" key={task.id}>
            <div className="field-grid">
              <Field
                label="Action title"
                value={task.title}
                onChange={(v) =>
                  change((e) => {
                    e.tasks[i].title = v;
                  })
                }
              />
              <Select
                label="Action kind"
                value={task.kind}
                options={["Task", "Communication"]}
                onChange={(v) =>
                  change((e) => {
                    e.tasks[i].kind = v as "Task" | "Communication";
                  })
                }
              />
              <Field
                label="Action due date"
                type="date"
                value={task.dueDate}
                onChange={(v) =>
                  change((e) => {
                    e.tasks[i].dueDate = v;
                  })
                }
              />
              <Field
                label="Assignee"
                value={task.assignee}
                hint="Leave blank for either owner."
                onChange={(v) =>
                  change((e) => {
                    e.tasks[i].assignee = v;
                  })
                }
              />
              {task.kind === "Communication" && (
                <Field
                  label="Recipient"
                  value={task.recipient}
                  onChange={(v) =>
                    change((e) => {
                      e.tasks[i].recipient = v;
                    })
                  }
                />
              )}
            </div>
            <Field
              label="Action notes"
              value={task.notes}
              onChange={(v) =>
                change((e) => {
                  e.tasks[i].notes = v;
                })
              }
            />
            <div className="row-actions">
              <Check
                label={`Complete: ${task.title || "new action"}`}
                checked={task.done}
                onChange={(v) =>
                  change((e) => {
                    e.tasks[i].done = v;
                    e.tasks[i].completedAt = v ? today : "";
                  })
                }
              />
              <button
                type="button"
                className="text-button danger"
                onClick={() =>
                  change((e) => {
                    e.tasks.splice(i, 1);
                  })
                }
              >
                Remove action
              </button>
            </div>
          </div>
        ))}
      </Section>
      <Section id="archive" title="Close-out">
        <p className="muted">
          Booked events can be archived after the event and once all generated
          and manual actions are resolved. Enquiries that do not proceed can be
          closed with a reason.
        </p>
        <Field
          label="Archive / non-sale reason"
          value={draft.archiveReason}
          onChange={(v) =>
            change((e) => {
              e.archiveReason = v;
            })
          }
        />
        <Check
          label="Archive this event"
          checked={draft.archived}
          onChange={(v) =>
            change((e) => {
              e.archived = v;
            })
          }
        />
      </Section>
      <div className="bottom-save">
        <button disabled={busy || !dirty}>Save event</button>
      </div>
    </form>
  );
}
