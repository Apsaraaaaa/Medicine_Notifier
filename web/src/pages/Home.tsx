import { Container, Section, SectionHeading, ButtonLink, Card, IconBadge } from "../components/ui";
import { ReminderPreview } from "../components/ReminderPreview";
import { FEATURES } from "../content";
import { ICONS } from "../components/icons";

export default function Home() {
  return (
    <>
      {/* hero */}
      <section className="border-b border-line bg-paper py-14 sm:py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">
              Medication reminders made simple
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">Never Miss Your Medicine</h1>
            <p className="mt-5 max-w-xl text-lg text-body">
              Medicine Notifier helps you remember your medicines with simple, reliable reminders
              and easy-to-use medication tracking.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/signup" size="lg">
                Get Started
              </ButtonLink>
              <ButtonLink to="/how-it-works" size="lg" variant="secondary">
                Learn More
              </ButtonLink>
            </div>
            <p className="mt-6 text-base text-muted">
              Free to use · Works on phone and computer · No medical data leaves your account
            </p>
          </div>

          <ReminderPreview />
        </Container>
      </section>

      {/* features */}
      <Section tint>
        <SectionHeading
          center
          eyebrow="Features"
          title="Everything you need to stay on schedule"
          intro="Set a medicine once and Medicine Notifier takes care of the reminding, the recording and the reporting."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 6).map((f) => (
            <Card key={f.title}>
              <IconBadge icon={ICONS[f.icon]} tone={f.tone} />
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-base text-body">{f.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink to="/features" variant="secondary">
            See all features
          </ButtonLink>
        </div>
      </Section>

      {/* closing call to action */}
      <Section>
        <div className="rounded-panel border border-line bg-brand-soft px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-bold sm:text-4xl">Start tracking your medicines today</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-body">
            Create an account, add your medicines, and let the reminders do the remembering.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/signup" size="lg">
              Get Started
            </ButtonLink>
            <ButtonLink to="/about" size="lg" variant="secondary">
              Learn More
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
