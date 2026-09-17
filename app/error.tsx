"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert">
      <h1>This view could not open.</h1>
      <p>
        Your saved records have not been changed. Retry the view, or reload to
        reconnect to your workspace.
      </p>
      <button onClick={reset}>Retry view</button>
    </div>
  );
}
