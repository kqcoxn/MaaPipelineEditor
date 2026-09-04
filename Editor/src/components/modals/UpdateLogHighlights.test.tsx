import { render, screen } from "@testing-library/react";
import type {
  FeaturedNewsItem,
  PinnedNotice,
} from "../../data/updateLogs";
import UpdateLogHighlights from "./UpdateLogHighlights";

const notice: PinnedNotice = {
  title: "置顶公告",
  content: ["第一条公告", "第二条公告", "第三条公告"],
  type: "info",
};

const news: FeaturedNewsItem[] = [
  {
    title: "性能工程白皮书",
    summary: "性能优化方法与结果。",
    category: "技术报告",
    date: "2026-09-04",
    url: "https://example.com/performance-report",
  },
];

describe("UpdateLogHighlights", () => {
  it("renders every notice without an expand control", () => {
    render(<UpdateLogHighlights notice={notice} news={news} />);

    expect(screen.getByText("第一条公告")).toBeInTheDocument();
    expect(screen.getByText("第二条公告")).toBeInTheDocument();
    expect(screen.getByText("第三条公告")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders featured content as an external link", () => {
    render(<UpdateLogHighlights notice={notice} news={news} />);

    expect(screen.getByRole("link", { name: /性能工程白皮书/ })).toHaveAttribute(
      "href",
      news[0].url,
    );
  });
});
