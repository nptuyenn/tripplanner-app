import { useEffect, useMemo, useState } from "react";
import { Brand } from "../components/Brand.jsx";
import { TripCard } from "../components/TripCard.jsx";
import { TripForm } from "../components/TripForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function DashboardPage() {
  const { session, logout } = useAuth();
  const [trips, setTrips] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTrips() {
      try {
        const payload = await api("/api/trips", { token: session.token });
        setTrips(payload.trips);
      } catch (requestError) {
        if (requestError.status === 401) logout();
        else setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    void loadTrips();
  }, [session.token]);

  const stats = useMemo(
    () => ({
      total: trips.length,
      upcoming: trips.filter((trip) => trip.status === "planned").length,
      completed: trips.filter((trip) => trip.status === "completed").length,
    }),
    [trips],
  );

  async function saveTrip(data) {
    setSaving(true);
    setError("");

    try {
      if (editing) {
        const payload = await api(`/api/trips/${editing._id}`, {
          method: "PUT",
          token: session.token,
          body: data,
        });
        setTrips((current) =>
          current.map((trip) => (trip._id === editing._id ? payload.trip : trip)),
        );
        setEditing(null);
      } else {
        const payload = await api("/api/trips", {
          method: "POST",
          token: session.token,
          body: data,
        });
        setTrips((current) => [...current, payload.trip]);
      }
    } catch (requestError) {
      setError(
        requestError.details?.length
          ? requestError.details.join(". ")
          : requestError.message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrip(trip) {
    if (!window.confirm(`Remove the trip to ${trip.destination}?`)) return;
    setDeletingId(trip._id);
    setError("");

    try {
      await api(`/api/trips/${trip._id}`, {
        method: "DELETE",
        token: session.token,
      });
      setTrips((current) => current.filter((item) => item._id !== trip._id));
      if (editing?._id === trip._id) setEditing(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{session.user.name}</p>
              <p className="text-xs text-slate-400">{session.user.email}</p>
            </div>
            <button className="button-secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Your travel desk</p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
              Make space for somewhere new.
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(stats).map(([label, value]) => (
              <div key={label} className="stat-card">
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="error-banner mt-8 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        <section className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200/80 lg:sticky lg:top-6">
            <TripForm
              trip={editing}
              onSave={saveTrip}
              onCancel={() => setEditing(null)}
              saving={saving}
            />
          </aside>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-slate-950">
                Your itineraries
              </h2>
              <span className="text-sm text-slate-400">
                {trips.length} {trips.length === 1 ? "trip" : "trips"}
              </span>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-dot" />
                <p>Gathering your plans…</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="empty-state">
                <div className="grid size-14 place-items-center rounded-full bg-teal-50 text-teal-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
                    <circle cx="12" cy="9" r="2.4" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl font-semibold text-slate-900">
                  Your map is wide open.
                </h3>
                <p className="max-w-sm text-sm leading-6 text-slate-500">
                  Add the first place on your mind. The details can grow from there.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {trips.map((trip) => (
                  <TripCard
                    key={trip._id}
                    trip={trip}
                    onEdit={setEditing}
                    onDelete={deleteTrip}
                    deleting={deletingId === trip._id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
