import { Container, Section, ButtonLink, SectionHeading } from "../components/ui";
import { ReminderPreview } from "../components/ReminderPreview";
import { STEPS } from "../content";

export default function HowItWorks() {
  return (
    <>
      <section className="border-b border-line py-14 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-ink">
              How it works
            </p>
            <h1 className="text-4xl font-bold sm:text-5xl">Four steps, then it runs itself</h1>
            <p className="mt-5 text-lg text-body">
              Setting up a medicine takes a minute. After that, Medicine Notifier does the
              reminding and the record-keeping.
            </p>
          </div>
        </Container>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          {/* numbered because the order genuinely matters */}
          <ol className="space-y-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-xl font-semibold">{step.title}</h2>
                  <p className="mt-1.5 text-base text-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <ReminderPreview />
        </div>
      </Section>

      <Section tint>
        <SectionHeading
          center
          title="Start with your first medicine"
          intro="You can change the dose, the times or the end date whenever your prescription changes."
        />
        <div className="mt-8 flex justify-center">
          <ButtonLink to="/signup" size="lg">
            Get Started
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
