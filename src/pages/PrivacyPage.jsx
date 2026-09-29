const sections = [
  {
    title: "Statistical Data",
    body: "Our servers (as most) track IP addresses and referring pages to help with site maintenance and improvements. This data is viewed only as anonymous statistics to show the busiest times of the day or week, pages with errors, and how effective our advertising has been. This information will not be used for any other purpose.",
  },
  {
    title: "Personal Information Collected",
    body: 'We do not store any type of sales information. Except for payment, we store the information from our "Directory" section to help develop our digital directory of "Professionals" and "Business." It also allows us to track consulting issues or refer to a previous order to help provide customer service. However, if you choose, you have the option of having your information removed from this system by emailing us with your request.',
  },
  {
    title: "Information Correction or Removal",
    body: "If you wish to correct, update, or remove any information about you that may be in our records, please send us an email with the details of your request. If you wish to contact us further, please find complete contact information on our contact page.",
  },
  {
    title: "Cookies",
    body: 'Cookies are files with a small amount of data, which may include a unique anonymous identifier. Cookies are sent to your browser from a website and stored on your computer\'s hard drive. We use "cookies" to store your cart contents for you. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use the checkout section of our site.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-b border-background-200/70 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
            <i className="ri-lock-line" />
            Privacy Policy
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground-950 leading-tight mb-4">
            How we handle <span className="italic text-primary-700">your data.</span>
          </h1>
          <p className="text-foreground-600 font-label text-sm">Last updated: February 2, 2019</p>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-3xl mx-auto space-y-10">
          <p className="text-sm text-foreground-600 leading-relaxed">
            This Privacy Policy is effective as of February 2, 2019, and will remain in effect
            except concerning any changes in its provisions in the future, which will be in
            effect immediately after being posted on this page.
          </p>

          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="font-heading text-xl font-medium text-foreground-950 mb-3">
                {s.title}
              </h2>
              <p className="text-sm text-foreground-600 leading-relaxed">{s.body}</p>
            </div>
          ))}

          <div className="pt-8 border-t border-background-200/70">
            <h2 className="font-heading text-xl font-medium text-foreground-950 mb-3">
              Changes to This Privacy Policy
            </h2>
            <p className="text-sm text-foreground-600 leading-relaxed">
              This Privacy Policy is effective as of February 2, 2019, and any future changes
              will be posted on this page.
            </p>
          </div>

          <div className="rounded-2xl bg-background-100/60 border border-background-200/70 p-6 text-center">
            <p className="text-sm text-foreground-700 mb-3">
              Questions about how your data is handled?
            </p>
            <a
              href="mailto:info@connect767.com"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              <i className="ri-mail-send-line" />
              info@connect767.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
