import { useState } from "react";
import { Container, Field, Button, Alert, Card } from "../components/ui";
import { api, ApiError } from "../lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    if (form.message.trim().length < 10) next.message = "Please write at least a sentence.";
    setErrors(next);
    setStatus(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.sendMessage(form.name.trim(), form.email.trim(), form.message.trim());
      setStatus({ tone: "success", text: "Thanks — your message has been sent." });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setStatus({ tone: "error", text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-ink">
          Contact
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">Get in touch</h1>
        <p className="mt-5 text-lg text-body">
          Questions, problems or feedback about Medicine Notifier — send a message and we'll reply
          by email.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={submit}
          noValidate
          className="rounded-panel border border-line bg-white p-6 shadow-card sm:p-8"
        >
          <div className="space-y-5">
            {status && <Alert tone={status.tone}>{status.text}</Alert>}

            <Field
              id="contact-name"
              label="Name"
              autoComplete="name"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              id="contact-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <div>
              <label htmlFor="contact-message" className="mb-1.5 block text-base font-semibold text-ink">
                Message
              </label>
              <textarea
                id="contact-message"
                rows={5}
                value={form.message}
                aria-invalid={errors.message ? true : undefined}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={`w-full rounded-card border bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-brand ${
                  errors.message ? "border-bad" : "border-line"
                }`}
                placeholder="How can we help?"
              />
              {errors.message && <p className="mt-1.5 text-sm text-bad">{errors.message}</p>}
            </div>

            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>

        <Card className="h-fit">
          <h2 className="text-xl font-semibold">Contact information</h2>
          <dl className="mt-4 space-y-4 text-base">
            <div>
              <dt className="font-semibold text-ink">Email</dt>
              <dd>
                <a href="mailto:support@medicinenotifier.app" className="text-brand-ink hover:underline">
                  support@medicinenotifier.app
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Support hours</dt>
              <dd className="text-body">Monday to Friday, 9:00 – 17:00</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Response time</dt>
              <dd className="text-body">Usually within two working days</dd>
            </div>
          </dl>
          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
            Medicine Notifier is a reminder tool, not a medical service. For advice about your
            medication, speak to your doctor or pharmacist.
          </p>
        </Card>
      </div>
    </Container>
  );
}
