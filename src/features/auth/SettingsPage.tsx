import { useState } from "react";
import type { FormEvent } from "react";
import { Check, LockKeyhole, UserRound } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await updateProfile(name.trim());
      setMessage("Your profile has been updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="content-page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>Settings</h1>
          <p>A space that feels like you.</p>
        </div>
      </div>
      <section className="settings-card">
        <h2>
          <UserRound size={19} />
          Your profile
        </h2>
        <form onSubmit={submit}>
          <label className="field">
            Display name
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Email address
            <input readOnly value={user?.email ?? ""} />
          </label>
          <p className="muted">
            Account role: {user?.role === "ADMIN" ? "Administrator" : "Student"}
          </p>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="alert alert-success" role="status">
              <Check size={16} />
              {message}
            </p>
          )}
          <button disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
      <section className="settings-card">
        <h2>
          <LockKeyhole size={19} />
          About this demo
        </h2>
        <p>
          Each demo account has a separate personal library, annotations, and
          reading progress. Data is stored locally in this browser and will be
          lost if you clear site storage.
        </p>
        <p>
          This frontend simulates access rules. Production authentication,
          private file storage, and server-side authorization require the
          planned Spring Boot backend.
        </p>
        <p>
          Supported uploads: selectable PDFs up to 25 MB and 1000 pages. Scans
          can be read; they need an existing text layer for highlighting.
        </p>
      </section>
    </div>
  );
}
