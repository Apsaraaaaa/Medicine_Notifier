import { Container, Section, SectionHeading, Card, ButtonLink, IconBadge } from "../components/ui";
import { UserIcon, PillIcon, UsersIcon, StethoscopeIcon } from "../components/icons";

const AUDIENCE = [
  {
    icon: UserIcon,
    title: "Older adults",
    body: "Large text, plain wording and one clear action per reminder — no menus to hunt through.",
  },
  {
    icon: PillIcon,
    title: "Anyone on several medicines",
    body: "Different doses at different times of day stay organised in one daily schedule.",
  },
  {
    icon: UsersIcon,
    title: "Family and carers",
    body: "A shared history makes it easy to check what was taken without asking every day.",
  },
  {
    icon: StethoscopeIcon,
    title: "People managing a course",
    body: "Antibiotics and short courses finish properly, with a record of what was missed.",
  },
];

export default function About() {
  return (
    <>
      <section className="border-b border-line py-14 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-ink">
              About
            </p>
            <h1 className="text-4xl font-bold sm:text-5xl">
              Medication management, without the mental load
            </h1>
            <p className="mt-5 text-lg text-body">
              Medicine Notifier is a reminder and tracking tool for people who take medicine on a
              schedule. It holds the day's doses, alerts you when each one is due, and records what
              you answered — so nobody has to keep score in their head.
            </p>
          </div>
        </Container>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Why it exists</h2>
            <p className="mt-4 text-lg text-body">
              Missing a dose is rarely about not caring. It's about a busy afternoon, a changed
              routine, or simply not being sure whether the tablet was already taken. Paper charts
              and phone alarms fall short: an alarm tells you it's time but doesn't remember your
              answer.
            </p>
            <p className="mt-4 text-lg text-body">
              Medicine Notifier closes that loop. Every reminder ends in a recorded answer — taken,
              skipped, or missed — so the schedule reflects what actually happened.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">What it does</h2>
            <ul className="mt-4 space-y-3 text-lg text-body">
              {[
                "Keeps every medicine with its dose, frequency and reminder times.",
                "Alerts you at each scheduled time with an on-screen reminder and alarm.",
                "Records taken, skipped and missed doses as they happen.",
                "Shows consistency for the week or month, grouped by day.",
                "Works on the web and as a mobile app using the same account.",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden className="mt-1 text-brand-ink">
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tint>
        <SectionHeading center title="Who it's designed for" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {AUDIENCE.map((a) => (
            <Card key={a.title}>
              <IconBadge icon={a.icon} />
              <h3 className="text-xl font-semibold">{a.title}</h3>
              <p className="mt-2 text-base text-body">{a.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink to="/signup" size="lg">
            Get Started
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
