import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export function AuthPage({ mode }) {
  const registering = mode === "register";
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (registering) await register(form);
      else await login({ email: form.email, password: form.password });
    } catch (requestError) {
      setError(
        requestError.details?.length
          ? requestError.details.join(". ")
          : requestError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] p-4 sm:p-6">
      <div className="auth-shell">
        <section className="auth-story">
          <Brand />
          <div className="relative z-10 mt-auto max-w-xl">
            <p className="eyebrow text-teal-200">Plan less. Experience more.</p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-7xl">
              Every great trip starts with a little room to dream.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Keep dates, ideas, and the small details together—then leave enough
              space for the unexpected.
            </p>
          </div>
          <div className="route-line" aria-hidden="true" />
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <p className="eyebrow">{registering ? "Begin the journey" : "Welcome back"}</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950">
              {registering ? "Create your travel space." : "Your next trip is waiting."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {registering
                ? "One account for every place on your list."
                : "Sign in to pick up where you left off."}
            </p>

            <form onSubmit={submit} className="mt-9 space-y-5">
              {registering && (
                <label className="field">
                  <span>Name</span>
                  <input
                    name="name"
                    autoComplete="name"
                    value={form.name}
                    onChange={update}
                    placeholder="Lan Nguyen"
                    required
                  />
                </label>
              )}
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength="8"
                  value={form.password}
                  onChange={update}
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              {error && <div className="error-banner">{error}</div>}

              <button className="button-primary w-full" disabled={submitting}>
                {submitting
                  ? "Just a moment…"
                  : registering
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              {registering ? "Already planning with us?" : "New to TripPlanner?"}{" "}
              <Link
                className="font-semibold text-teal-700 hover:text-teal-800"
                to={registering ? "/login" : "/register"}
              >
                {registering ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
