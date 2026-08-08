import Hero from "../components/Hero";
import Featured from "../components/Featured";
import Categories from "../components/Categories";
import ListingsGrid from "../components/ListingsGrid";
import HowItWorks from "../components/HowItWorks";
import ShopTeaser from "../components/ShopTeaser";
import Pricing from "../components/Pricing";
import Blog from "../components/Blog";
import CtaPartners from "../components/CtaPartners";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Featured />
      <Categories />
      <ListingsGrid />
      <HowItWorks />
      <ShopTeaser />
      <Pricing />
      <Blog />
      <CtaPartners />
    </>
  );
}
