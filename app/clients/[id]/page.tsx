"use client";
import { use } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/Workspace";
import { EventEditor } from "@/components/EventEditor";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, refreshId } = useWorkspace();
  const event = data.events.find((e) => e.id === id);
  if (event?.deletedAt)
    return (
      <>
        <h1>This event is in Trash</h1>
        <p>Restore it before editing.</p>
        <Link href="/trash">Open Trash</Link>
      </>
    );
  return event ? (
    <EventEditor
      key={`${event.id}:${event.revision}:${refreshId}`}
      event={event}
    />
  ) : (
    <>
      <h1>Event not found</h1>
      <p>The event may be in another workspace.</p>
      <Link href="/clients">Back to events</Link>
    </>
  );
}
