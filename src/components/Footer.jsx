import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

const discoverLinks = [
  { label: "Browse Directory", href: "/listings" },
  { label: "Add a Listing", href: "/listings/submit" },
  { label: "Shop", href: "/shop" },
  { label: "Blog", href: "/blog" },
];

const companyLinks = [
  { label: "About", href: "/about", internal: true },
  { label: "Help Center", href: "/help", internal: true },
  { label: "Partners", href: "#partners" },
];

const socials = [
  { label: "Twitter", icon: "ri-twitter-x-line", href: "#twitter" },
  { label: "Instagram", icon: "ri-instagram-line", href: "#instagram" },
  { label: "Facebook", icon: "ri-facebook-line", href: "#facebook" },
  { label: "Pinterest", icon: "ri-pinterest-line", href: "#pinterest" },
];

export default function Footer() {
  return (
    <footer
      id="site-footer"
      className="px-3 sm:px-4 md:px-8 pb-4 sm:pb-8 pt-12 md:pt-16 bg-background-50"
    >
      <div className="rounded-2xl sm:rounded-3xl bg-primary-950 text-background-50 px-5 sm:px-6 md:px-12 py-10 sm:py-12 md:py-16 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Link
              aria-label="Connect767 home"
              className="group mb-6 inline-flex text-background-50 [text-shadow:0_2px_5px_rgba(0,0,0,0.35)]"
              to="/"
            >
              <BrandLogo
                markFilter="drop-shadow(1px 0 0 rgba(255,255,255,0.45)) drop-shadow(-1px 0 0 rgba(255,255,255,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.35))"
                size="large"
              />
            </Link>
            <h3 className="font-heading text-3xl md:text-4xl font-light leading-tight mb-4">
              Get the weekly digest of new listings, deals &amp; drops.
            </h3>
            <p className="text-background-50/70 text-sm mb-6 max-w-md">
              Fresh classifieds, custom uniform ideas, and shop offers — every Sunday, straight to
              your inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md">
              <input
                className="flex-1 px-4 py-3 text-sm rounded-md bg-background-50/10 border border-background-50/25 text-background-50 placeholder-background-50/50 focus:outline-none focus:border-accent-400 font-label"
                name="email"
                placeholder="you@email.com"
                required
                type="email"
              />
              <button
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-md bg-accent-500 text-background-50 hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-70"
                type="submit"
              >
                Subscribe
                <i className="ri-arrow-right-line" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold mb-4 text-background-50">Discover</h4>
            <ul className="space-y-3 text-sm text-background-50/75">
              {discoverLinks.map((l) => (
                <li key={l.label}>
                  <Link className="hover:text-background-50 cursor-pointer" to={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold mb-4 text-background-50">Company</h4>
            <ul className="space-y-3 text-sm text-background-50/75">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  {l.internal ? (
                    <Link className="hover:text-background-50 cursor-pointer" to={l.href}>
                      {l.label}
                    </Link>
                  ) : (
                    <a className="hover:text-background-50 cursor-pointer" href={l.href}>
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-sm font-semibold mb-4 text-background-50">Get in touch</h4>
            <p className="text-sm text-background-50/75">862-253-2076</p>
            <p className="text-sm text-background-50/75">Info@connect767.com</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-background-50/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                aria-label={s.label}
                href={s.href}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-background-50/10 hover:bg-background-50/20 cursor-pointer"
              >
                <i className={`${s.icon} text-sm`} />
              </a>
            ))}
          </div>
          <p className="text-xs text-background-50/60">© 2026 Connect767. Crafted with care.</p>
          <div className="flex items-center gap-5 text-xs text-background-50/70">
            <Link className="hover:text-background-50 cursor-pointer" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-background-50 cursor-pointer" to="/terms">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
