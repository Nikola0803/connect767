import Hero from "../components/Hero";
import Featured from "../components/Featured";
import Categories from "../components/Categories";
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
      <div className="[content-visibility:auto] [contain-intrinsic-size:850px]">
        <Categories />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:900px]">
        <HowItWorks />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:850px]">
        <ShopTeaser />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:850px]">
        <Pricing />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:750px]">
        <Blog />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:520px]">
        <CtaPartners />
      </div>
    </>
  );
}
