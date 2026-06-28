export function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-950/15">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.4" />
        </svg>
      </div>
      {!compact && (
        <div>
          <p className="font-display text-lg font-semibold leading-none text-slate-950">
            TripPlanner
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Go thoughtfully
          </p>
        </div>
      )}
    </div>
  );
}
