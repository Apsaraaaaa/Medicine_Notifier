import { Container, Section, Card, IconBadge, ButtonLink, SectionHeading } from "../components/ui";
import { FEATURES } from "../content";
import { ICONS } from "../components/icons";

export default function Features() {
  return (
    <>
      <section className="border-b border-line py-14 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-ink">
              Features
            </p>
            <h1 className="text-4xl font-bold sm:text-5xl">
              Built around one question: was this dose taken?
            </h1>
            <p className="mt-5 text-lg text-body">
              Every feature exists to make that question easy to answer and easy to look back on.
            </p>
          </div>
        </Container>
      </section>

      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <IconBadge icon={ICONS[f.icon]} tone={f.tone} />
              <h2 className="text-xl font-semibold">{f.title}</h2>
              <p className="mt-2 text-base text-body">{f.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tint>
        <SectionHeading
          center
          title="Ready when you are"
          intro="Create an account and add your first medicine in under a minute."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/signup" size="lg">
            Get Started
          </ButtonLink>
          <ButtonLink to="/how-it-works" size="lg" variant="secondary">
            See how it works
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
