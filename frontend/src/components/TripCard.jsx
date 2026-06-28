const statusStyles = {
  planned: "bg-amber-50 text-amber-700 ring-amber-200",
  ongoing: "bg-teal-50 text-teal-700 ring-teal-200",
  completed: "bg-slate-100 text-slate-600 ring-slate-200",
};

function readableDate(value) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function TripCard({ trip, onEdit, onDelete, deleting }) {
  return (
    <article className="trip-card group">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[trip.status]}`}
          >
            {trip.status}
          </span>
          <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight text-slate-950">
            {trip.destination}
          </h3>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 19c4.5-1 7.5-4 8-8 2 2.5 4.5 3.5 8 3" />
            <path d="m17 10 3 4-4 3" />
          </svg>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 text-sm font-medium text-slate-500">
        <svg
          viewBox="0 0 24 24"
          className="size-4 text-teal-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
        <span>
          {readableDate(trip.startDate)} — {readableDate(trip.endDate)}
        </span>
      </div>

      {trip.notes && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">
          {trip.notes}
        </p>
      )}

      <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
        <button className="card-action" onClick={() => onEdit(trip)}>
          Edit plan
        </button>
        <button
          className="card-action text-rose-600 hover:bg-rose-50"
          onClick={() => onDelete(trip)}
          disabled={deleting}
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
      </div>
    </article>
  );
}
