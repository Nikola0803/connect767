import { Link } from "react-router-dom";

export default function AIMatch() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16 bg-primary-950 text-background-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-center gap-8 md:gap-10">
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/10 border border-background-50/20 text-xs font-medium mb-4">
            <i className="ri-sparkling-2-fill text-accent-400" />
            AI Matching
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-light leading-tight mb-3">
            Try our <span className="italic text-accent-400">AI Matching</span>
          </h2>
          <p className="text-background-50/75 text-sm md:text-base font-label max-w-xl mx-auto md:mx-0">
            Answer 3 quick questions. Our AI ranks the best-fit businesses for you, top to bottom
            — by category, budget, location, and what matters most.
          </p>
        </div>
        <Link
          to="/match"
          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
        >
          Get Matched
          <i className="ri-arrow-right-line" />
        </Link>
      </div>
    </section>
  );
}
