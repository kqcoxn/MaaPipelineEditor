import { describe, expect, it } from "vitest";
import {
  carouselTransition,
  slideKey,
  type CarouselTransition,
} from "./carousel";
import type { LinkItem } from "../types";

const slide = (title: string): LinkItem => ({
  title,
  description: "",
  url: `https://example.com/${title}`,
  image: `${title}.png`,
});
const a = slide("A"),
  b = slide("B"),
  c = slide("C");
const request = (state: CarouselTransition, value: LinkItem, reduced = false) =>
  carouselTransition(state, { type: "request", slide: value, reduced });
const finish = (state: CarouselTransition, value: LinkItem) =>
  carouselTransition(state, { type: "finish", key: slideKey(value) });

describe("carousel opaque base", () => {
  it("keeps the old frame beneath the new one until the fade completes", () => {
    const initial = request({}, a);
    expect(initial.base).toBe(a);
    const fading = request(initial, b);
    expect(fading.base).toBe(a);
    expect(fading.incoming).toBe(b);
    expect(finish(fading, b)).toEqual({ base: b });
  });

  it("does not replace a partially visible frame during rapid selection", () => {
    const fading = request(request({}, a), b);
    expect(request(fading, c)).toBe(fading);
    const next = request(finish(fading, b), c);
    expect(next).toEqual({ base: b, incoming: c });
    expect(finish(next, b)).toBe(next); // An obsolete timer/animation cannot commit C early.
  });

  it("can return to the original slide after an in-progress fade", () => {
    const fading = request(request({}, a), b);
    expect(request(fading, a)).toBe(fading);
    expect(request(finish(fading, b), a)).toEqual({ base: b, incoming: a });
  });

  it("settles immediately for reduced motion and ignores late completion", () => {
    const fading = request(request({}, a), b);
    const settled = request(fading, c, true);
    expect(settled).toEqual({ base: c });
    expect(finish(settled, b)).toBe(settled);
  });

  it("does not animate when selecting the current slide again", () => {
    const initial = request({}, a);
    expect(request(initial, { ...a })).toBe(initial);
  });
});
