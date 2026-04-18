import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MasonryWorkspace } from "./MasonryWorkspace";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(min-width: 1024px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const items = [
  {
    id: "hero",
    label: "hero panel",
    className: "panel",
    defaultSize: { width: 520, height: 240 },
    minSize: { width: 360, height: 220 },
    maxSize: { width: 1200, height: 520 },
    content: <div>Hero</div>,
  },
  {
    id: "anomalies",
    label: "anomalies panel",
    className: "panel",
    defaultSize: { width: 320, height: 220 },
    minSize: { width: 280, height: 200 },
    maxSize: { width: 900, height: 420 },
    content: <div>Anomalies</div>,
  },
];

describe("MasonryWorkspace", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("positions cards absolutely on desktop and exposes workspace height", () => {
    render(<MasonryWorkspace workspaceId="overview" items={items} />);

    expect(screen.getByTestId("masonry-workspace-overview")).toBeInTheDocument();
    expect(screen.getByTestId("masonry-card-overview-hero")).toHaveStyle({
      position: "absolute",
      left: "0px",
      top: "0px",
    });
    expect(screen.getByTestId("masonry-card-overview-anomalies")).toHaveStyle({
      left: "540px",
      top: "0px",
    });
    expect(screen.getByTestId("masonry-workspace-overview")).toHaveStyle({ height: "240px" });
  });

  it("falls back to normal document flow outside desktop breakpoints", () => {
    mockMatchMedia(false);

    render(<MasonryWorkspace workspaceId="overview" items={items} />);

    expect(screen.getByTestId("masonry-workspace-overview")).toHaveClass("masonry-workspace-static");
    expect(screen.queryByTestId("masonry-card-overview-hero")).not.toBeInTheDocument();
    expect(screen.getByText("Hero")).toBeInTheDocument();
    expect(screen.getByText("Anomalies")).toBeInTheDocument();
  });
});
