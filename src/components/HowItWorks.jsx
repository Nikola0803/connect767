import { steps, stats } from "../data/content";

export default function HowItWorks() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-50">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-16">
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative rounded-2xl bg-background-100/60 border border-background-200/70 p-6 md:p-7 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
                  <i className={`${step.icon} text-xl`} />
                </div>
                <span className="font-heading text-3xl font-light text-foreground-300">
                  {step.num}
                </span>
              </div>
              <h3 className="font-heading text-xl font-medium text-foreground-950 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-foreground-700 font-label leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-secondary-100 border border-secondary-200 px-6 md:px-10 py-10 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="font-heading text-4xl md:text-5xl font-light text-foreground-950 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-secondary-900 font-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
