import { useState } from "react";
import { Link } from "react-router-dom";

const faqs = [
  {
    q: "How is my personal information handled?",
    a: "We strictly use your information for intended purposes only and never share it with third parties. We do not sell or give away any lists or data we retain.",
  },
  {
    q: "How long does it take to ship my order?",
    a: "Orders ship within 3–5 business days after payment verification. US orders go out via USPS; international orders may take up to 10 business days depending on the country.",
  },
  {
    q: "What shipping methods do you use?",
    a: "All continental US orders are shipped via United States Postal Service (USPS) unless otherwise instructed at checkout.",
  },
  {
    q: "What should I do if my order is delayed?",
    a: "Contact us immediately if you experience delays, and we'll help confirm the status of your order.",
  },
  {
    q: "Can I return an item?",
    a: "Yes — we accept returns on eligible domestic orders received within 15 days from the day the order was placed. Items must be unwashed, unworn, and include original packaging.",
  },
  {
    q: "Who covers the return shipping cost?",
    a: "Original shipping charges are non-refundable, and the buyer is responsible for return shipping costs.",
  },
];

const sections = [
  {
    icon: "ri-shield-check-line",
    title: "Help & Support Guidelines",
    body: "General statement of principles: any information we gather is strictly for our intended use and is not shared with any other entity, public or private, for any reason. We will not sell or give away any lists or other data that we may retain, and we do not purchase such information from other sources.",
  },
  {
    icon: "ri-truck-line",
    title: "Shipping",
    body: "Orders will be shipped within three (3) to five (5) business days after payment verification. All continental US orders will be shipped via United States Postal Service (USPS) unless instructed otherwise. International orders may take up to ten (10) business days depending on the country and method of shipping chosen at checkout. If you experience delays, contact us immediately and we will help confirm the status of your order.",
  },
  {
    icon: "ri-arrow-go-back-line",
    title: "Returns & Exchange",
    body: "We accept returns on eligible domestic orders that are received within 15 days from the day the order was placed. All returns must be unwashed and unworn and include all original packaging. Connect767 reserves the right to deny credit for any returned goods that don't meet the requirements of our return policy — please treat our pieces with lots of TLC! Original shipping charges are non-refundable and the buyer must pay return shipping costs. Once we've received the item(s), we'll process your refund or store credit within 5–7 business days and email you to let you know.",
  },
  {
    icon: "ri-star-line",
    title: "Featured Professional",
    body: "To be a featured professional, sign up and edit your directory information in your account settings, then purchase the Featured Professional package. Submit a short biography to info@connect767.com with a subject line using your directory entry name as a reference.",
  },
  {
    icon: "ri-vip-crown-line",
    title: "Featured Business",
    body: "To be a featured business, sign up and edit your directory information in your account settings, then purchase the Featured Professional package.",
  },
];

const deliveryIssues = [
  {
    title: "Damaged Items",
    body: "We take such matters very seriously and will look into individual cases thoroughly. Any orders that arrive damaged should not be thrown away before taking a photo of the damaged item as proof and emailing the pictures to us at info@connect767.com.",
  },
  {
    title: "Lost Mail",
    body: "In the event of lost mail, we will open a formal inquiry — and if there's a clear indication that your order is indeed lost, we'll re-send it to you at no cost, subject to availability.",
  },
];

export default function HelpPage() {
  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-b border-background-200/70 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
            <i className="ri-question-answer-line" />
            Help Center
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground-950 leading-tight mb-4">
            Find answers, <span className="italic text-primary-700">fast.</span>
          </h1>
          <p className="text-foreground-600 font-label">
            Learn more about our policies, shipping, returns, and privacy practices.
          </p>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-4xl mx-auto space-y-5">
          {sections.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-background-200/70 bg-background-50 p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 flex-shrink-0">
                  <i className={`${s.icon} text-lg`} />
                </div>
                <h2 className="font-heading text-xl font-medium text-foreground-950">
                  {s.title}
                </h2>
              </div>
              <p className="text-sm text-foreground-600 leading-relaxed">{s.body}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-background-200/70 bg-background-50 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 flex-shrink-0">
                <i className="ri-alert-line text-lg" />
              </div>
              <h2 className="font-heading text-xl font-medium text-foreground-950">
                What happens if there's been a delivery mishap?
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {deliveryIssues.map((d) => (
                <div key={d.title}>
                  <h3 className="text-sm font-semibold text-foreground-900 mb-1.5">{d.title}</h3>
                  <p className="text-sm text-foreground-600 leading-relaxed">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-t border-background-200/70">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
              <i className="ri-list-check-2" />
              Frequently Asked Questions
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
              Quick answers to <span className="italic text-primary-700">common questions.</span>
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 bg-primary-950 text-background-50 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-light mb-3">Still need help?</h2>
        <p className="text-background-50/75 text-sm font-label mb-6 max-w-md mx-auto">
          Our support team is ready to assist you with any questions or concerns you may have.
        </p>
        <a
          href="mailto:info@connect767.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 transition-colors cursor-pointer"
        >
          <i className="ri-mail-send-line" />
          info@connect767.com
        </a>
        <p className="mt-6 text-xs text-background-50/50 font-label">
          <Link to="/privacy" className="hover:text-background-50/80">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-background-200/70 bg-background-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-foreground-900">{question}</span>
        <i
          className={`ri-arrow-down-s-line text-foreground-500 transition-transform flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-foreground-600 leading-relaxed font-label">
          {answer}
        </div>
      )}
    </div>
  );
}
