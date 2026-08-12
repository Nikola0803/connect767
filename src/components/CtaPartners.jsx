import { Link } from "react-router-dom";
import { partners } from "../data/content";

export default function CtaPartners() {
  const track = [...partners, ...partners];
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-50">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-6">
          <i className="ri-plug-line" />
          Integrations, ready when you are
        </div>
        <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight max-w-3xl mx-auto">
          One brand shell. <span className="italic text-primary-700">Every tool your shop needs.</span>
        </h2>
        <p className="mt-4 text-foreground-700 text-base md:text-lg font-light max-w-2xl mx-auto">
          Print-on-demand, shipping labels, marketplace sync, sale banners — plug them in when
          you're ready. We'll wire them up.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            to="/auth/register"
          >
            Create free account
            <i className="ri-arrow-right-line" />
          </Link>
          <Link
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-background-300 bg-background-50 text-foreground-950 text-sm font-semibold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
            to="/listings"
          >
            Browse the directory
          </Link>
        </div>

        <div className="mt-16 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-background-50 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-background-50 to-transparent z-10" />
          <div className="marquee-track flex items-center gap-14 whitespace-nowrap">
            {track.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="inline-flex items-center gap-2 text-foreground-500 font-heading text-2xl md:text-3xl font-light"
              >
                {name}
                <span className="text-foreground-300">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
