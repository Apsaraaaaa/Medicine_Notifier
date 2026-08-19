import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container, Field, Button, Alert } from "../components/ui";
import { Logo } from "../components/Logo";
import { api, auth, ApiError } from "../lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await api.register(form.name.trim(), form.email.trim(), form.password);
      // See Login: the account is what matters here, not a browser session.
      auth.clear();
      navigate("/confirmed", { state: { email: res.user.email, created: true } });
    } catch (err) {
      const e2 = err as ApiError;
      setErrors(e2.fields ?? {});
      setMessage(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="flex justify-center py-14 sm:py-20">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-4 text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-base text-body">
            One account for the website and the mobile app.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="rounded-panel border border-line bg-white p-6 shadow-card sm:p-8"
        >
          <div className="space-y-5">
            {message && <Alert tone="error">{message}</Alert>}

            <Field
              id="signup-name"
              label="Name"
              autoComplete="name"
              value={form.name}
              error={errors.name}
              onChange={set("name")}
            />
            <Field
              id="signup-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              error={errors.email}
              onChange={set("email")}
            />
            <Field
              id="signup-password"
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters"
              value={form.password}
              error={errors.password}
              onChange={set("password")}
            />
            <Field
              id="signup-confirm"
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              error={errors.confirm}
              onChange={set("confirm")}
            />

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Creating account…" : "Sign Up"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-base text-body">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-ink hover:underline">
            Login
          </Link>
        </p>
      </div>
    </Container>
  );
}
