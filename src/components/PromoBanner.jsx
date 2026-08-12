import { useState } from "react";

export default function PromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="bg-accent-500 text-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 flex items-center justify-center gap-3 py-2 md:h-11 md:py-0">
        <p className="text-xs md:text-sm font-medium text-center whitespace-normal md:whitespace-nowrap">
          Summer Kickoff — 20% off all surf &amp; beach gear with code SUMMER767
        </p>
        <button
          aria-label="Dismiss banner"
          type="button"
          onClick={() => setVisible(false)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-accent-600 transition-colors cursor-pointer flex-shrink-0"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>
    </div>
  );
}
