import { Link } from "react-router-dom";

export default function CtaPartners() {
  return (
    <section className="w-full border-t border-background-200/70 bg-background-50 px-4 py-10 md:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3">
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
    </section>
  );
}
