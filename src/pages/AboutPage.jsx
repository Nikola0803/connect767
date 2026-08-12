import Button from "../components/ui/Button";

const team = [
  {
    name: "Sadick Eustache",
    role: "Founder & Chief Executive Officer",
    bio: "Sadick was raised in Petite Soufrière, a small village on the east coast of Dominica. He attended Castle Bruce Secondary School and later pursued higher education at Dominica State College, where he earned an associate degree in Building and Civil Engineering. After gaining experience in the construction and engineering industry in Dominica, Sadick migrated to New York, where he earned two additional undergraduate degrees, a Master's degree in Engineering & Technology Management, and a Professional Certificate in Building Designs with a concentration in Plumbing from New York University.",
    avatar:
      "https://readdy.ai/api/search-image?query=Professional%20confident%20Caribbean%20businessman%20portrait%2C%20natural%20light%2C%20cream%20shirt%2C%20clean%20warm%20terracotta%20background%2C%20editorial%20headshot%2C%20soft%20shadows%2C%20highly%20detailed&width=400&height=400&seq=connect767-team-sadick&orientation=squarish",
  },
  {
    name: "Macazar Prosper",
    role: "Chief Technical Officer",
    bio: "Macazar, originally from Petite Soufrière, studied Electrical Engineering at the University of Technology Jamaica. He has since gained extensive experience working in the e-commerce and financial services industries. Always passionate about improving the lives of others, Prosper began his journey with 'TeckworkDA,' a brief venture focused on mobile services and repairs, among other offerings.",
    avatar:
      "https://readdy.ai/api/search-image?query=Professional%20confident%20Caribbean%20businessman%20portrait%2C%20natural%20light%2C%20cream%20shirt%2C%20clean%20warm%20green%20background%2C%20editorial%20headshot%2C%20soft%20shadows%2C%20highly%20detailed&width=400&height=400&seq=connect767-team-macazar&orientation=squarish",
  },
];

const services = [
  {
    icon: "ri-lightbulb-flash-line",
    title: "Consulting Services",
    text: "With over a decade of experience in the manufacturing industry, our aim is to help organizations solve problems, improve performance, or achieve specific goals. We use our knowledge, skills, and expertise to offer advice, guidance, and recommendations in areas such as business strategy, management, and operations.",
  },
  {
    icon: "ri-t-shirt-2-line",
    title: "Manufacturing Services",
    text: "This includes the design and production of sports and work uniforms, or any other clothing based on specific customer requirements. Our quality control process includes stringent quality assurance to ensure products meet regulatory standards and customer specifications.",
  },
  {
    icon: "ri-handshake-line",
    title: "Partnership Programs",
    text: "We're open to collaborating with businesses or organizations that aim to achieve common goals, share resources, and leverage each other's strengths for mutual benefit. We believe strategic partnership fosters long-term cooperation and shared success.",
  },
  {
    icon: "ri-links-line",
    title: "Strategic Alliances",
    text: "Build long-term collaborations focused on shared goals and growth — the same principle behind everything on Connect767, from directory listings to the Uniform Studio.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-16 md:pt-20">
      {/* Hero */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-primary-950 text-background-50 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/10 border border-background-50/20 text-xs font-medium mb-5">
            <i className="ri-team-line" />
            About Connect767
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light leading-tight mb-5">
            We believe in the <span className="italic text-accent-400">power of connections.</span>
          </h1>
          <p className="text-background-50/75 text-base md:text-lg font-label">
            Our platform brings together individuals, businesses, and communities to create
            meaningful relationships and opportunities for growth.
          </p>
        </div>
      </div>

      {/* Mission / Vision */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
              <i className="ri-flag-line" />
              Our Mission
            </div>
            <p className="text-foreground-700 leading-relaxed">
              Connect767 was created to serve as a marketplace, connecting the public with
              businesses and professionals of Dominican heritage. Our vision is to build and
              maintain a free digital directory that connects Dominican experts with those who
              seek their services.
            </p>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-4">
              <i className="ri-eye-line" />
              Our Vision
            </div>
            <p className="text-foreground-700 leading-relaxed">
              As a small community with a global impact, we aim to foster economic development
              among Dominicans at home and abroad. With integrity at the heart of our mission, we
              take pride in inspiring the next generation of entrepreneurs — collaborating with
              industry-leading organizations to deliver exceptional value and create lasting
              impact across the Caribbean and beyond.
            </p>
          </div>
        </div>
      </div>

      {/* Management */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20 bg-background-100/50 border-y border-background-200/70">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
              <i className="ri-user-star-line" />
              Our Management
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
              Built by people from <span className="italic text-primary-700">here.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {team.map((person) => (
              <div
                key={person.name}
                className="rounded-2xl bg-background-50 border border-background-200/70 p-6 md:p-8"
              >
                <div className="flex items-center gap-4 mb-5">
                  <img
                    src={person.avatar}
                    alt={person.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <h3 className="font-heading text-lg font-medium text-foreground-950">
                      {person.name}
                    </h3>
                    <p className="text-xs text-primary-700 font-label font-semibold">
                      {person.role}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground-600 leading-relaxed">{person.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Professional Networking */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
            <i className="ri-node-tree" />
            Professional Networking
          </div>
          <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-5">
            More than a directory —{" "}
            <span className="italic text-primary-700">a network.</span>
          </h2>
          <p className="text-foreground-600 leading-relaxed">
            The Connect767 platform aims to build and maintain relationships with professionals or
            businesses in similar or related industries, as well as those with whom you can share
            knowledge, opportunities, and resources. We think our directory can play a crucial
            role in career development, business growth, and personal branding — exchanging
            information, insights, and support to advance professional interests, whether for job
            opportunities, business partnerships, or personal growth.
          </p>
        </div>
      </div>

      {/* Services */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20 bg-background-100/50 border-t border-background-200/70">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-4">
              <i className="ri-briefcase-4-line" />
              What we offer
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
              Beyond the <span className="italic text-primary-700">directory.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl bg-background-50 border border-background-200/70 p-6"
              >
                <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary-500 text-background-50 mb-4">
                  <i className={`${s.icon} text-lg`} />
                </div>
                <h3 className="font-heading text-lg font-medium text-foreground-950 mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-foreground-600 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 bg-primary-950 text-background-50 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-light mb-4">
          Ready to be part of the network?
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button to="/listings/submit" variant="accent" size="lg" icon="ri-arrow-right-line">
            List your business
          </Button>
          <Button to="/listings" variant="outline-light" size="lg">
            Browse the directory
          </Button>
        </div>
      </div>
    </div>
  );
}
