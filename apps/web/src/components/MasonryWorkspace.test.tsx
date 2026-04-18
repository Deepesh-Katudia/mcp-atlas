import { fireEvent, render, screen } from "@testing-library/react";
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

const repackItems = [
  {
    ...items[0],
    defaultSize: { width: 800, height: 240 },
    maxSize: { width: 1200, height: 520 },
  },
  items[1],
  {
    id: "traffic",
    label: "traffic panel",
    className: "panel",
    defaultSize: { width: 320, height: 220 },
    minSize: { width: 280, height: 200 },
    maxSize: { width: 900, height: 420 },
    content: <div>Traffic</div>,
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

  it("repacks sibling cards while a panel is being resized", () => {
    render(<MasonryWorkspace workspaceId="overview" items={repackItems} />);

    expect(screen.getByTestId("masonry-card-overview-traffic")).toHaveStyle({
      left: "820px",
      top: "240px",
    });

    fireEvent.mouseDown(screen.getByLabelText("Resize hero panel width"), { clientX: 800, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 520, clientY: 100 });

    expect(screen.getByTestId("masonry-card-overview-traffic")).toHaveStyle({
      left: "880px",
      top: "0px",
    });

    fireEvent.mouseUp(window, { clientX: 520, clientY: 100 });
  });

  it("syncs card sizes when item definitions change without preserving removed items", () => {
    const { rerender } = render(<MasonryWorkspace workspaceId="overview" items={items.slice(0, 1)} />);

    expect(screen.getByTestId("masonry-card-overview-hero")).toHaveStyle({ width: "520px" });

    rerender(
      <MasonryWorkspace
        workspaceId="overview"
        items={[
          {
            ...items[0],
            defaultSize: { width: 420, height: 240 },
          },
          items[1],
        ]}
      />,
    );

    expect(screen.getByTestId("masonry-card-overview-hero")).toHaveStyle({ width: "420px" });
    expect(screen.getByTestId("masonry-card-overview-anomalies")).toBeInTheDocument();
  });
});
