import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Page width limiter used by every section. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

/** Alternating page band; `tint` gives the soft grey background. */
export function Section({
  children,
  tint = false,
  id,
  className,
}: {
  children: ReactNode;
  tint?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cx("py-14 sm:py-20", tint && "bg-paper-2 border-y border-line", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  center?: boolean;
}) {
  return (
    <div className={cx("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-ink">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg text-body">{intro}</p>}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "lg";
  className?: string;
};

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-line bg-white text-ink hover:border-brand hover:text-brand-ink",
  quiet: "text-brand-ink hover:bg-brand-soft",
};

const sizes = {
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-3.5 text-lg",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors";

export function ButtonLink({
  to,
  children,
  variant = "primary",
  size = "md",
  className,
}: ButtonProps & { to: string }) {
  return (
    <Link to={to} className={cx(buttonBase, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        buttonBase,
        variants[variant],
        sizes[size],
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-paper p-6 shadow-card transition-shadow hover:shadow-lift",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Tinted square holding one line icon. */
export function IconBadge({
  icon: Icon,
  tone = "brand",
}: {
  icon: (props: { className?: string }) => ReactNode;
  tone?: "brand" | "care";
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl",
        tone === "brand" ? "bg-brand-soft text-brand-ink" : "bg-care-soft text-care"
      )}
    >
      <Icon />
    </span>
  );
}

/** Labelled form field with inline error text. */
export function Field({
  label,
  error,
  hint,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...props}
        className={cx(
          "w-full rounded-card border bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-brand",
          error ? "border-bad" : "border-line"
        )}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={cx("mt-1.5 text-sm", error ? "text-bad" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-card px-4 py-3 text-base",
        tone === "error" ? "bg-[#fdeceb] text-bad" : "bg-ok-soft text-ok"
      )}
    >
      {children}
    </p>
  );
}
