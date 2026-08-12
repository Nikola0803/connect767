import { Link } from "react-router-dom";
import { uniformImage } from "../data/content";
import { sports } from "../data/uniforms";

const checklist = [
  "Shirt, shorts and socks — all in one live 3D preview",
  "Predefined templates or start from a blank mockup",
  "Upload your own transparent PNG artwork",
  "Roster table for sizes, names, and numbers",
];

export default function Studio() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-primary-950 text-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/10 border border-background-50/20 text-background-50 text-xs font-medium mb-6">
              <i className="ri-t-shirt-line" />
              3D Uniform Studio
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light leading-tight mb-6">
              Kit up the whole squad — <span className="italic text-accent-400">in one window.</span>
            </h2>
            <p className="text-background-50/80 text-base md:text-lg font-light leading-relaxed mb-8 max-w-xl">
              Rotate a full 3D uniform, swap crew or V-neck, long or short sleeves, recolor every
              panel, and drop logos anywhere. Print for the team, or grab a fan jersey — same
              design, shirt only.
            </p>
            <ul className="space-y-3 mb-8">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-background-50/90">
                  <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">
                    <i className="ri-check-line text-xs" />
                  </span>
                  <span className="font-label">{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
                to="/uniforms"
              >
                Open the studio
                <i className="ri-arrow-right-line" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-background-50/30 text-background-50 text-sm font-semibold hover:bg-background-50/10 transition-colors cursor-pointer whitespace-nowrap"
                to="/uniforms?mode=scratch"
              >
                Design from scratch
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {sports.map((sport) => (
                <Link
                  key={sport.slug}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/10 hover:bg-background-50/20 border border-background-50/15 text-xs font-medium cursor-pointer whitespace-nowrap"
                  to={`/uniforms?sport=${sport.slug}`}
                >
                  <i className={sport.icon} />
                  {sport.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 relative">
            <div className="relative rounded-3xl overflow-hidden bg-background-50/5 border border-background-50/10">
              <div className="w-full h-[520px]">
                <img
                  alt="3D uniform preview with jersey, shorts and socks"
                  title="Full 3D uniform preview — jersey, shorts, socks"
                  className="w-full h-full object-cover object-top"
                  src={uniformImage}
                />
              </div>
              <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/95 text-foreground-950 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                Live 3D preview
              </div>
              <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-background-50/95 text-foreground-950 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-foreground-600 font-label mb-1">
                    Collar
                  </div>
                  <div className="text-sm font-semibold">V-Neck</div>
                </div>
                <div className="rounded-xl bg-background-50/95 text-foreground-950 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-foreground-600 font-label mb-1">
                    Sleeve
                  </div>
                  <div className="text-sm font-semibold">Short</div>
                </div>
                <div className="rounded-xl bg-accent-500 text-background-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-background-50/80 font-label mb-1">
                    Fan Jersey
                  </div>
                  <div className="text-sm font-semibold">Enabled</div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden md:flex items-center gap-3 px-4 py-3 rounded-2xl bg-background-50 text-foreground-950">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-shield-check-line text-lg" />
              </div>
              <div>
                <div className="text-xs font-semibold">Screenshot deterrents</div>
                <div className="text-[10px] text-foreground-600 font-label">On for guests</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
