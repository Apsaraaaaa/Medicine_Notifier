import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Container, ButtonLink } from "./components/ui";
import Home from "./pages/Home";
import About from "./pages/About";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Confirmed from "./pages/Confirmed";
import { Privacy, Terms } from "./pages/Legal";

/** Every route change should start at the top of the new page. */
function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: window.scrollTo() resolves to a Promise in current Chrome, and
  // returning it would make React treat it as this effect's clean-up function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-body">
        The page you were looking for doesn't exist or has moved.
      </p>
      <div className="mt-8">
        <ButtonLink to="/" size="lg">
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Link to="#main" className="skip-link">
        Skip to content
      </Link>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          <Route path="/confirmed" element={<Confirmed />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
