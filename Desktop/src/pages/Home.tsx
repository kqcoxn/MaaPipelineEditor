import { PromoCarousel } from "../components/PromoCarousel";
import type { LinkItem } from "../types";

export function Home({ slides }: { slides: LinkItem[] }) {
  return (
    <div className="home-content">
      <div className="hero">
        <div className="hero-copy">
          <div className="hero-message">
            <h1>连接你的想法</h1>
            <p>由您设计，由我们支持，想法之外尽在其中！</p>
          </div>
          <PromoCarousel slides={slides} />
        </div>
      </div>
    </div>
  );
}
