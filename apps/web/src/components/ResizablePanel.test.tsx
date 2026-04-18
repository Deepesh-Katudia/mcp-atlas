import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResizablePanel } from "./ResizablePanel";

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

describe("ResizablePanel", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("renders resize handles only on desktop", () => {
    render(
      <ResizablePanel
        panelId="summary"
        label="summary panel"
        defaultSize={{ width: 520, height: 320 }}
        minSize={{ width: 360, height: 240 }}
        maxSize={{ width: 980, height: 640 }}
      >
        <div>Summary body</div>
      </ResizablePanel>,
    );

    expect(screen.getByTestId("resizable-panel-summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel height")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width and height")).toBeInTheDocument();
  });

  it("does not render resize handles outside desktop breakpoints", () => {
    mockMatchMedia(false);

    render(
      <ResizablePanel
        panelId="summary"
        label="summary panel"
        defaultSize={{ width: 520, height: 320 }}
        minSize={{ width: 360, height: 240 }}
        maxSize={{ width: 980, height: 640 }}
      >
        <div>Summary body</div>
      </ResizablePanel>,
    );

    expect(screen.queryByLabelText("Resize summary panel width")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Resize summary panel height")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Resize summary panel width and height")).not.toBeInTheDocument();
  });

  it("updates width and height while dragging the corner handle", () => {
    const onResizeEnd = vi.fn();

    render(
      <ResizablePanel
        panelId="summary"
        label="summary panel"
        defaultSize={{ width: 520, height: 320 }}
        minSize={{ width: 360, height: 240 }}
        maxSize={{ width: 980, height: 640 }}
        onResizeEnd={onResizeEnd}
      >
        <div>Summary body</div>
      </ResizablePanel>,
    );

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width and height");
    const dragTarget = document.body;

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(dragTarget, { clientX: 620, clientY: 410 });
    fireEvent.mouseUp(dragTarget, { clientX: 620, clientY: 410 });

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(panel).toHaveStyle({ width: "620px", height: "410px" });
  });
});
