import { Container } from "../components/ui";

/** Shared shell so Privacy and Terms stay consistent and short. */
function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-lg text-body">{children}</div>
      </div>
    </Container>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="August 2026">
      <section>
        <h2 className="text-xl font-semibold text-ink">What we store</h2>
        <p className="mt-2">
          Your account details (name and email), the medicines you add, and the record of doses you
          mark as taken, skipped or missed. Nothing else is collected.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">How it is used</h2>
        <p className="mt-2">
          Your data is used only to show your schedule and history inside Medicine Notifier. It is
          not sold, shared with advertisers, or used to build a profile of you.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Your control</h2>
        <p className="mt-2">
          You can edit or delete any medicine at any time, and request deletion of your account and
          its history by contacting support.
        </p>
      </section>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="August 2026">
      <section>
        <h2 className="text-xl font-semibold text-ink">Not medical advice</h2>
        <p className="mt-2">
          Medicine Notifier is a reminder and record-keeping tool. It does not provide medical
          advice, dosing guidance, or drug interaction checks. Always follow the instructions given
          by your doctor or pharmacist.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Reliability</h2>
        <p className="mt-2">
          Reminders depend on your device being switched on and the app being allowed to run. Do not
          rely on Medicine Notifier alone for medication that is critical to your health.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Your account</h2>
        <p className="mt-2">
          Keep your password private. You are responsible for activity on your account, and for the
          accuracy of the medicine details you enter.
        </p>
      </section>
    </LegalPage>
  );
}
