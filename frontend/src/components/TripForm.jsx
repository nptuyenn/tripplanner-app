import { useEffect, useState } from "react";

const emptyTrip = {
  destination: "",
  startDate: "",
  endDate: "",
  notes: "",
  status: "planned",
};

function dateInputValue(value) {
  return value ? value.slice(0, 10) : "";
}

export function TripForm({ trip, onSave, onCancel, saving }) {
  const [form, setForm] = useState(emptyTrip);

  useEffect(() => {
    setForm(
      trip
        ? {
            destination: trip.destination,
            startDate: dateInputValue(trip.startDate),
            endDate: dateInputValue(trip.endDate),
            notes: trip.notes ?? "",
            status: trip.status ?? "planned",
          }
        : emptyTrip,
    );
  }, [trip]);

  function update(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    await onSave(form);
    if (!trip) setForm(emptyTrip);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="eyebrow">{trip ? "Edit itinerary" : "New adventure"}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
          {trip ? "Refine your plan" : "Where to next?"}
        </h2>
      </div>

      <label className="field">
        <span>Destination</span>
        <input
          name="destination"
          value={form.destination}
          onChange={update}
          placeholder="Kyoto, Japan"
          maxLength="120"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Start date</span>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={update}
            required
          />
        </label>
        <label className="field">
          <span>End date</span>
          <input
            type="date"
            name="endDate"
            min={form.startDate}
            value={form.endDate}
            onChange={update}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Status</span>
        <select name="status" value={form.status} onChange={update}>
          <option value="planned">Planned</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          name="notes"
          value={form.notes}
          onChange={update}
          rows="4"
          maxLength="1000"
          placeholder="Places, food, tiny details worth remembering…"
        />
      </label>

      <div className="flex gap-3">
        <button className="button-primary flex-1" disabled={saving}>
          {saving ? "Saving…" : trip ? "Save changes" : "Add trip"}
        </button>
        {trip && (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
