"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
type Client = {
  clientId: string;
  label: string;
  resource: string;
  readEnabled: boolean;
  writeEnabled: boolean;
  consented: boolean;
};
export default function McpWriteAccess() {
  const [db] = useState(browserSupabase);
  const [clients, setClients] = useState<Client[]>([]);
  const [identity, setIdentity] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    if (!db) throw new Error("Sign in to the owner dashboard first.");
    const user = await db.auth.getUser();
    if (!user.data.user)
      throw new Error("Sign in to the owner dashboard first.");
    const result = await db.rpc("hs_mcp_owner_clients");
    if (result.error)
      throw new Error(
        "An active owner session is required; write-access setup may be unavailable.",
      );
    setIdentity(user.data.user.email || user.data.user.id);
    setClients(result.data);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [db]);
  const decide = async (clientId: string, allow: boolean) => {
    if (!db) return;
    setBusy(true);
    setError("");
    try {
      const result = await db.rpc("hs_mcp_consent_write", {
        p_client_id: clientId,
        p_allow: allow,
      });
      if (result.error)
        throw new Error("Consent could not be saved. Reload and retry.");
      setConfirmed(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mcp-consent">
      <section>
        <p className="eyebrow">HORIZON STRINGS</p>
        <h1>Connected account write access</h1>
        <p>
          <Link href="/settings">Return to owner settings</Link>
        </p>
        {identity && (
          <p>
            Horizon owner: <strong>{identity}</strong>
          </p>
        )}
        <p>
          Only approve the registered connection belonging to your intended
          ChatGPT account and workspace. Check its client ID and resource
          against that account’s existing plugin connection.
        </p>
        <p>
          Operational writes can create events and update event facts, contacts,
          notes, recorded milestones, workflow information, individual event
          tasks, communication history, musician assignments, repertoire,
          musician and repertoire directories, and workflow settings. Existing
          read access includes private contacts and financial information.
        </p>
        <p>
          Writes cannot edit finances, musician fees or payment status, manage
          People or general business tasks, delete, archive or restore records,
          convert website enquiries, download files, or send messages. Recording
          a communication does not send it.
        </p>
        <p>
          Consent is separate from release activation. Writes also require the
          application switch, database switch and administrator’s per-client
          grant. Revoking consent immediately blocks writes while preserving
          approved reads.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I have checked the intended connected account and understand this
          operational write scope.
        </label>
        {clients.map((c) => (
          <article key={c.clientId}>
            <h2>{c.label}</h2>
            <p>
              Client: {c.clientId}
              <br />
              Resource: {c.resource}
            </p>
            <p>
              Read grant: {c.readEnabled ? "enabled" : "disabled"}. Write grant:{" "}
              {c.writeEnabled ? "enabled" : "disabled"}. Owner consent:{" "}
              {c.consented ? "recorded" : "not recorded"}.
            </p>
            <button
              disabled={busy || !confirmed || !c.readEnabled}
              onClick={() => void decide(c.clientId, true)}
            >
              Allow operational write scope
            </button>{" "}
            <button
              className="secondary"
              disabled={busy || !c.consented}
              onClick={() => void decide(c.clientId, false)}
            >
              Revoke write consent
            </button>
          </article>
        ))}
        {identity && clients.length === 0 && (
          <p>No registered connections for this owner.</p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
