"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { callbackUrl } from "@/lib/mcp/consent";

export default function OAuthConsent() {
  const [supabase] = useState(browserSupabase);
  const [id, setId] = useState("");
  const [client, setClient] = useState("");
  const [scope, setScope] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const finish = (url: string) => window.location.assign(callbackUrl(url));
  const load = async (authorizationId: string) => {
    if (!supabase) throw new Error("Dashboard sign-in is not configured.");
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) {
      setSignedIn(false);
      return;
    }
    const owner = await supabase
      .from("hs_owners")
      .select("user_id")
      .eq("user_id", user.data.user.id)
      .maybeSingle();
    if (owner.error || !owner.data)
      throw new Error("This account is not an authorised Horizon owner.");
    setSignedIn(true);
    const { data, error } =
      await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data)
      throw new Error("The connection request is invalid or expired.");
    if ("redirect_url" in data) {
      finish(data.redirect_url);
      return;
    }
    setClient(data.client.name || "Unnamed connection");
    setScope(data.scope || "");
  };
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.search).get("authorization_id") || "";
    setId(value);
    if (!value || value.length > 200)
      setError("Missing or invalid connection request.");
    else
      void load(value).catch(() =>
        setError(
          "Could not load the connection. Sign in with an authorised Horizon account and retry.",
        ),
      );
    // The Supabase instance and the request URL are stable for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);
  const decide = async (approve: boolean) => {
    if (!supabase || !id || !client) return;
    setBusy(true);
    setError("");
    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(id, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(id, {
            skipBrowserRedirect: true,
          });
      if (result.error || !result.data)
        throw new Error("Could not finish the connection.");
      finish(result.data.redirect_url);
    } catch {
      setError("Could not finish the connection. Please retry.");
      setBusy(false);
    }
  };
  return (
    <main className="mcp-consent">
      <section>
        <p className="eyebrow">HORIZON STRINGS</p>
        <h1>Connect your dashboard</h1>
        {!signedIn ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!supabase) return;
              setBusy(true);
              setError("");
              try {
                const result = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                setPassword("");
                if (result.error) throw result.error;
                await load(id);
              } catch {
                setError(
                  "Sign-in or connection failed. Check your Horizon owner account and retry.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>Sign in with your Horizon Strings dashboard account.</p>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy || !id || !supabase}>Sign in</button>
          </form>
        ) : (
          <>
            <p>
              <strong>{client || "Loading connection…"}</strong> is requesting
              read access to Horizon Strings.
            </p>
            <p>
              This includes events and client contacts, saved notes and
              communications, tasks, musicians, repertoire, finance, workflow
              settings and website enquiries. Information retrieved can be
              included in conversations in the connected account.
            </p>
            <p>
              This connection cannot edit or delete records, convert enquiries,
              send messages or download linked files. Only allow a connection
              and ChatGPT account you trust.
            </p>
            <p>Identity scopes: {scope || "Loading…"}</p>
            <div className="row-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy || !client}
                onClick={() => void decide(false)}
              >
                Deny
              </button>
              <button
                type="button"
                disabled={busy || !client}
                onClick={() => void decide(true)}
              >
                Allow read access
              </button>
            </div>
          </>
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
