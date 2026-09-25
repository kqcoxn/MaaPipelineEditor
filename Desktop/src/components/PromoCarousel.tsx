import { useEffect, useState } from "react";
import type { LinkItem } from "../types";
import { CarouselStory } from "./CarouselStory";

export function PromoCarousel({ slides }: { slides: LinkItem[] }) {
  const [slide, setSlide] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const index = slide % Math.max(slides.length, 1);
  const current = slides[index];
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (hovered || focused || reduced || slides.length < 2) return;
    const id = setInterval(
      () => setSlide((n) => (n + 1) % slides.length),
      8000,
    );
    return () => clearInterval(id);
  }, [hovered, focused, reduced, slides.length]);
  if (!current) return null;
  return (
    <section
      className="home-carousel"
      aria-label="MPE 动态"
      aria-roledescription="轮播"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="carousel-story-slot">
        <CarouselStory slides={slides} requested={current} reduced={reduced} />
      </div>
      {slides.length > 1 && (
        <div className="slide-controls" aria-label="宣传内容切换">
          {slides.map((item, i) => (
            <button
              key={`${item.title}-${i}`}
              className="slide-dot"
              aria-label={`展示：${item.title}`}
              aria-current={i === index}
              onClick={() => setSlide(i)}
            >
              <span />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
