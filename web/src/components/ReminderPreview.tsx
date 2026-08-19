import { Logo } from "./Logo";

/**
 * A plain, calm illustration of the core idea: a dose is due, and one tap
 * answers it. Built from markup rather than an image so it stays crisp and
 * readable at any size.
 */
export function ReminderPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-panel border border-line bg-white p-5 shadow-lift">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted">
          <Logo size={22} />
          Medicine Notifier
          <span className="ml-auto tabular-nums">8:00 PM</span>
        </div>

        <div className="mt-4 rounded-card bg-brand-soft p-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-ink">
            Dose due now
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">Aspirin</p>
          <p className="text-base text-body">1 tablet (500 mg)</p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-base font-semibold text-white">
            <span aria-hidden>✓</span> I've taken this dose
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold text-body">
              Snooze 15 min
            </div>
            <div className="rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold text-body">
              Skip
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-semibold text-muted">Today</p>
          <ul className="mt-2 space-y-2">
            {[
              { time: "8:00 AM", name: "Aspirin", state: "Taken", tone: "ok" },
              { time: "2:00 PM", name: "Metformin", state: "Taken", tone: "ok" },
              { time: "8:00 PM", name: "Aspirin", state: "Due", tone: "due" },
            ].map((row) => (
              <li key={row.time} className="flex items-center gap-3 text-base">
                <span className="tabular-nums text-muted">{row.time}</span>
                <span className="font-medium text-ink">{row.name}</span>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    row.tone === "ok" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-ink"
                  }`}
                >
                  {row.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
