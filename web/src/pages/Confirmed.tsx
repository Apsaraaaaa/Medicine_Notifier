import { Link, useLocation } from "react-router-dom";
import { Container, ButtonLink } from "../components/ui";

/**
 * Where logging in and signing up land.
 *
 * There is no web version of the app — medicines, schedules and history live
 * on the phone — so the honest end of these flows is a confirmation of which
 * account exists, not a dashboard that isn't there. The point of signing up
 * here is that typing an email and a password is far easier on a keyboard than
 * on a phone, which matters when someone is setting the app up for a parent.
 */
export default function Confirmed() {
  const state = (useLocation().state ?? {}) as { email?: string; created?: boolean };
  const email = state.email;
  const created = state.created === true;

  return (
    <Container className="flex justify-center py-14 sm:py-20">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-brand-ink" aria-hidden="true">
            <path
              d="M4 12.5l5 5L20 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
          {created ? "Account created" : "That's your account"}
        </h1>

        <p className="mt-3 text-lg text-body">
          {email ? (
            <>
              Signed in as <span className="font-semibold text-ink">{email}</span>.
            </>
          ) : (
            <>Your account is ready.</>
          )}
        </p>

        <div className="mt-8 rounded-panel border border-line bg-white p-6 text-left shadow-card sm:p-8">
          <h2 className="text-xl font-bold">Next: open the app on your phone</h2>
          <ol className="mt-4 space-y-3 text-base text-body">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
                1
              </span>
              <span>Open Medicine Notifier on the Android phone that will hold the reminders.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
                2
              </span>
              <span>
                Log in with {email ? <span className="font-semibold text-ink">{email}</span> : "this email"} and the
                same password.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
                3
              </span>
              <span>Add each medicine and its times. The phone rings at every dose from then on.</span>
            </li>
          </ol>

          <p className="mt-5 border-t border-line pt-5 text-sm text-body">
            Medicines and dose history are kept in your account, so they appear on any phone you
            log in on. This website only creates the account — it does not keep you signed in.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ButtonLink to="/how-it-works" size="lg">
            See how it works
          </ButtonLink>
          <Link to="/" className="text-base font-semibold text-brand-ink hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </Container>
  );
}
