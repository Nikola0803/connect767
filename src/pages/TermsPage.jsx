const sections = [
  {
    title: "Using Connect767",
    body: "You agree to provide accurate information, use the platform lawfully, and respect listing owners, guests, service providers, and other users. You are responsible for reviewing listing details before submitting a request or payment.",
  },
  {
    title: "Listings and bookings",
    body: "Listing owners are responsible for the accuracy, availability, pricing, quality, safety, and delivery of their listings and services. Connect767 provides the marketplace and payment technology but is not the owner, operator, employer, landlord, or direct provider of third-party listings.",
  },
  {
    title: "Cancellations, refunds, and disputes",
    body: "Cancellation and refund eligibility may depend on the listing owner's stated policy and applicable law. Users should contact the listing owner promptly about changes or disputes. Payment-processing charges and the Connect767 platform fee may be non-refundable except where required by law or expressly stated otherwise.",
  },
  {
    title: "User responsibilities",
    body: "You are responsible for safeguarding your account and payment access, communicating accurate booking details, and complying with the rules, occupancy limits, schedules, and other conditions shown by the listing owner.",
  },
];

export default function TermsPage() {
  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-b border-background-200/70 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
            <i className="ri-file-list-3-line" />
            Terms and Conditions
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground-950 leading-tight mb-4">
            Clear terms for a <span className="italic text-primary-700">trusted marketplace.</span>
          </h1>
          <p className="text-foreground-600 font-label text-sm">Effective October 23, 2026</p>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-3xl mx-auto space-y-10">
          <p className="text-sm text-foreground-600 leading-relaxed">
            These Terms and Conditions govern your access to and use of Connect767. By creating an account, submitting a listing, requesting a booking, or completing a payment, you agree to these terms.
          </p>

          <section id="paid-booking" className="scroll-mt-28 rounded-2xl border border-primary-200 bg-primary-50/60 p-6 md:p-8">
            <div className="flex items-start gap-3">
              <i className="ri-secure-payment-line text-xl text-primary-700 mt-0.5" />
              <div>
                <h2 className="font-heading text-2xl font-medium text-foreground-950 mb-3">Paid Booking Terms and 10% Transaction Fee</h2>
                <div className="space-y-3 text-sm text-foreground-700 leading-relaxed">
                  <p>
                    Connect767 charges and retains a platform service fee equal to <strong>10% of every paid booking transaction</strong> processed through Connect767.
                  </p>
                  <p>
                    The fee supports marketplace operations, secure payment technology, booking administration, and customer support. The booking interface displays the booking total before payment. Any taxes, deposits, refunds, or additional charges required by a listing owner must be disclosed separately where applicable.
                  </p>
                  <p>
                    You must expressly accept these Paid Booking Terms before Connect767 will create or process a paid booking. Your acceptance, the applicable terms version, and the transaction-fee percentage are recorded with the booking.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-xl font-medium text-foreground-950 mb-3">{section.title}</h2>
              <p className="text-sm text-foreground-600 leading-relaxed">{section.body}</p>
            </section>
          ))}

          <div className="rounded-2xl bg-background-100/60 border border-background-200/70 p-6 text-center">
            <p className="text-sm text-foreground-700 mb-3">Questions about these terms?</p>
            <a href="mailto:info@connect767.com" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800">
              <i className="ri-mail-send-line" />
              info@connect767.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
