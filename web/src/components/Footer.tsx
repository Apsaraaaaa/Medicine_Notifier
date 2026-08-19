import { Link } from "react-router-dom";
import { Container } from "./ui";
import { Logo } from "./Logo";

const columns = [
  {
    heading: "Product",
    links: [
      { to: "/", label: "Home" },
      { to: "/features", label: "Features" },
      { to: "/how-it-works", label: "How It Works" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-2">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5 font-bold text-ink">
              <Logo size={26} />
              <span>Medicine Notifier</span>
            </div>
            <p className="mt-3 max-w-xs text-base text-body">
              Simple reminders for better medication management.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-base text-body hover:text-brand-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          © {new Date().getFullYear()} Medicine Notifier. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
