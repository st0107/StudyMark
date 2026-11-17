import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Highlighter,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { Logo } from "../../shared/ui/Logo";
import { useAuth } from "./AuthProvider";

export default function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const destination =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//")
      ? location.state.from
      : "/library";
  if (auth.user) return <Navigate to={destination} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (register)
        await auth.register({
          displayName: name.trim(),
          email: email.trim(),
          password,
        });
      else await auth.login({ email: email.trim(), password });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function demo(account: string) {
    setBusy(true);
    setError("");
    try {
      await auth.login({
        email: `${account}@studymark.app`,
        password: "StudyMark123!",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start demo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Logo light />
        <div className="auth-story-content">
          <span className="eyebrow">
            <Sparkles size={14} /> A LITTLE FOCUS. A LOT OF POSSIBILITY.
          </span>
          <h1>
            Make every
            <br />
            page <em>count.</em>
          </h1>
          <p>
            A quieter place to read deeply, connect ideas, and make knowledge
            your own.
          </p>
          <div className="auth-paper">
            <div className="paper-topline">
              <BookOpen size={18} />
              <span>YOUR NEXT LIGHTBULB MOMENT</span>
              <span>01</span>
            </div>
            <h3>Learning that stays with you.</h3>
            <p>
              The best ideas deserve more than a passing glance.{" "}
              <mark>Highlight what matters.</mark> Leave a thought for your
              future self.
            </p>
            <div className="paper-note">
              <Highlighter size={16} />
              <span>“Come back to this before the exam.”</span>
              <Check size={14} />
            </div>
          </div>
          <div className="auth-benefits">
            <span>
              <Check size={16} /> Your notes, always private
            </span>
            <span>
              <Check size={16} /> All your PDFs, one place
            </span>
          </div>
        </div>
        <p className="auth-footer">
          A little more understanding, one page at a time.
        </p>
      </section>
      <section className="auth-form-panel">
        <div className="mobile-auth-brand">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="small-icon">
            <BookOpen size={24} />
          </span>
          <h2>{register ? "Start your next chapter" : "Welcome back"}</h2>
          <p>
            {register
              ? "Create your own space for focused learning."
              : "Your next great idea is waiting on the page."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {register && (
              <label className="field">
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="field">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              Password
              <span className="password-input">
                <input
                  type={visible ? "text" : "password"}
                  required
                  minLength={register ? 8 : 1}
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    register ? "At least 8 characters" : "Enter your password"
                  }
                />
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {(error || auth.error) && (
              <p className="alert alert-error" role="alert">
                {error || auth.error}
              </p>
            )}
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {busy
                ? "Opening your workspace…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to StudyMark?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="demo-divider">
            <span>EXPLORE THE DEMO</span>
          </div>
          <div className="demo-accounts">
            <button
              disabled={busy}
              onClick={() => demo("alex")}
              className="btn btn-secondary"
            >
              Alex · Student
            </button>
            <button
              disabled={busy}
              onClick={() => demo("sam")}
              className="btn btn-secondary"
            >
              Sam · Student
            </button>
            <button
              disabled={busy}
              onClick={() => demo("admin")}
              className="btn btn-secondary"
            >
              Administrator
            </button>
          </div>
          <p className="demo-disclaimer">
            <LockKeyhole size={14} />
            Local demo. Accounts, PDFs, and notes stay in this browser. Use a
            demo password, not a real one.
          </p>
        </div>
      </section>
    </main>
  );
}
