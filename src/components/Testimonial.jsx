import { testimonialImage } from "../data/content";

export default function Testimonial() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-100/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden bg-accent-100 h-[520px]">
              <img
                alt="Amara Joseph portrait"
                title="Amara Joseph — Owner, Cocoa Palm Bistro"
                className="w-full h-full object-cover object-top"
                src={testimonialImage}
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="text-xs text-foreground-500 font-label mb-4">
              (Voices from the community)
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light leading-tight text-foreground-950">
              What locals actually <span className="text-foreground-400 italic">say.</span>
            </h2>
            <blockquote className="mt-10 text-base md:text-lg text-foreground-800 font-light leading-relaxed max-w-2xl">
              "We doubled reservations in the first month. The Classified spotlight puts real
              people at our tables — not just clicks."
            </blockquote>
            <p className="mt-8 text-sm text-foreground-950">
              <span className="font-semibold">— Amara Joseph</span>{" "}
              <span className="text-foreground-600 font-label">· Owner, Cocoa Palm Bistro</span>
            </p>
            <div className="mt-10 flex items-center gap-3">
              <button
                aria-label="Previous testimonial"
                type="button"
                className="w-11 h-11 flex items-center justify-center rounded-full border border-background-300 text-foreground-700 hover:bg-background-200/60 cursor-pointer"
              >
                <i className="ri-arrow-left-line" />
              </button>
              <button
                aria-label="Next testimonial"
                type="button"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground-950 text-background-50 hover:bg-foreground-800 cursor-pointer"
              >
                <i className="ri-arrow-right-line" />
              </button>
              <div className="ml-3 text-xs text-foreground-500 font-label">01 / 03</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
