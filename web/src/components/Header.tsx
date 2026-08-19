import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Container, ButtonLink, cx } from "./ui";
import { Logo } from "./Logo";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // close the mobile menu whenever the route changes
  useEffect(() => setOpen(false), [pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      "rounded-full px-3 py-2 text-base font-medium transition-colors",
      isActive ? "text-brand-ink" : "text-body hover:text-ink"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-3 sm:h-[4.5rem]">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-ink">
          <Logo />
          <span className="text-lg">Medicine Notifier</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass} end={l.to === "/"}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/login" className={navLinkClass}>
            Login
          </NavLink>
          <ButtonLink to="/signup" className="ml-2">
            Sign Up
          </ButtonLink>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink lg:hidden"
        >
          <span aria-hidden className="text-xl">
            {open ? "✕" : "☰"}
          </span>
        </button>
      </Container>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-line bg-white lg:hidden"
        >
          <Container className="flex flex-col py-3">
            {[...links, { to: "/login", label: "Login" }].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  cx(
                    "rounded-card px-3 py-3 text-lg font-medium",
                    isActive ? "bg-brand-soft text-brand-ink" : "text-body"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <ButtonLink to="/signup" size="lg" className="mt-3">
              Sign Up
            </ButtonLink>
          </Container>
        </nav>
      )}
    </header>
  );
}
