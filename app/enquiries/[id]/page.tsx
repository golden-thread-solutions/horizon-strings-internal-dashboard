"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/Workspace";
import { errorMessage } from "@/components/Controls";
import { formatDate } from "@/lib/workflow";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, convertWebsiteEnquiry } = useWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const enquiry = data.websiteEnquiries.find((e) => e.id === id);
  if (!enquiry)
    return (
      <>
        <h1>Enquiry unavailable</h1>
        <Link href="/">Back to the board</Link>
      </>
    );
  async function convert() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const event = await convertWebsiteEnquiry(id);
      router.push(`/clients/${event.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <div>
          <Link className="back-link" href="/">
            ← Events & enquiries
          </Link>
          <h1>{enquiry.name}</h1>
          <p>Website enquiry · {formatDate(enquiry.eventDate)}</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {enquiry.dashboardStatus === "converted" ? (
        <p>
          This enquiry has already been handled.{" "}
          {enquiry.dashboardEventId && (
            <Link href={`/clients/${enquiry.dashboardEventId}`}>
              Open event
            </Link>
          )}
        </p>
      ) : (
        <button disabled={busy} onClick={convert}>
          {busy ? "Adding…" : "Add to event workspace"}
        </button>
      )}
      <dl className="enquiry-details">
        <dt>Contact</dt>
        <dd>
          <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>
          {enquiry.phone && (
            <p>
              <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>
            </p>
          )}
          <p>Prefers {enquiry.preferredContact}</p>
        </dd>
        <dt>Area / venue</dt>
        <dd>
          {enquiry.area || "Area TBC"}
          <p>{enquiry.venue}</p>
        </dd>
        <dt>Package / ensemble</dt>
        <dd>
          {[enquiry.weddingPackage, enquiry.requestedEnsemble]
            .filter(Boolean)
            .join(" · ") || "TBC"}
        </dd>
        <dt>Message</dt>
        <dd className="preserve-lines">
          {enquiry.message || "No message supplied"}
        </dd>
        <dt>Inbox notification</dt>
        <dd>{enquiry.emailStatus === "sent" ? "Sent" : "Needs attention"}</dd>
      </dl>
    </>
  );
}
