import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container, Field, Button, Alert } from "../components/ui";
import { Logo } from "../components/Logo";
import { api, auth, ApiError } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await api.login(email.trim(), password);
      // Deliberately not auth.save(): there is no web app to stay signed in
      // to, and a marketing site holding a JWT is a risk with no benefit. The
      // call still proves the credentials work, which is the useful part.
      auth.clear();
      navigate("/confirmed", { state: { email: res.user.email, created: false } });
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
          <h1 className="mt-4 text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-base text-body">Log in to see today's medicines.</p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="rounded-panel border border-line bg-white p-6 shadow-card sm:p-8"
        >
          <div className="space-y-5">
            {message && <Alert tone="error">{message}</Alert>}

            <Field
              id="login-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Logging in…" : "Login"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-base text-body">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-brand-ink hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </Container>
  );
}
