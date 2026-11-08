import { steps } from "../data/content";

export default function HowItWorks() {
  return (
    <section className="hidden w-full bg-background-50 px-4 py-16 md:block md:px-8 md:py-24 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
              <i className="ri-compass-3-line" />
              How it works
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight">
              A quiet system for <span className="italic text-primary-700">loud results.</span>
            </h2>
          </div>
          <p className="lg:col-span-6 lg:col-start-7 text-foreground-700 text-base md:text-lg font-light leading-relaxed">
            Four small steps take you from "just browsing" to booked, listed, or fully kitted out
            for the season. No jargon, no messy dashboards — just tools that respect your time.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.title}
              className="group/card relative min-h-[250px] rounded-[1.5rem] border border-background-200 bg-background-50 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_20px_46px_rgba(31,112,78,0.12)]"
            >
              <div className="mb-8 flex items-start gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-background-50 shadow-sm transition-transform duration-300 group-hover/card:scale-105">
                  <i className={`${step.icon} text-2xl`} />
                </span>
              </div>
              <h3 className="mb-3 font-heading text-2xl font-medium text-foreground-950">
                {step.title}
              </h3>
              <p className="font-label text-sm leading-6 text-foreground-600">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
