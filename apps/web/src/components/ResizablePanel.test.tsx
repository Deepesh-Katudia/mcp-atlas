import type { ComponentProps } from "react";
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

function renderPanel(props: Partial<ComponentProps<typeof ResizablePanel>> = {}) {
  return render(
    <ResizablePanel
      panelId="summary"
      label="summary panel"
      defaultSize={{ width: 520, height: 320 }}
      minSize={{ width: 360, height: 240 }}
      maxSize={{ width: 980, height: 640 }}
      {...props}
    >
      <div>Summary body</div>
    </ResizablePanel>,
  );
}

describe("ResizablePanel", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("renders resize handles only on desktop", () => {
    renderPanel();

    expect(screen.getByTestId("resizable-panel-summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel height")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize summary panel width and height")).toBeInTheDocument();
  });

  it("falls back safely when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    });

    renderPanel();

    expect(screen.getByTestId("resizable-panel-summary")).toBeInTheDocument();
    expect(screen.queryByLabelText("Resize summary panel width")).not.toBeInTheDocument();
  });

  it("does not render resize handles outside desktop breakpoints", () => {
    mockMatchMedia(false);

    renderPanel();

    expect(screen.queryByLabelText("Resize summary panel width")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Resize summary panel height")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Resize summary panel width and height")).not.toBeInTheDocument();
  });

  it("updates width and height while dragging the corner handle", () => {
    const onResizeEnd = vi.fn();
    renderPanel({ onResizeEnd });

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width and height");
    const dragTarget = window;

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(dragTarget, { clientX: 620, clientY: 410 });
    fireEvent.mouseUp(dragTarget, { clientX: 620, clientY: 410 });

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(panel).toHaveStyle({ width: "620px", height: "410px" });
  });

  it("cleans up active drag listeners when the panel unmounts mid-drag", () => {
    const onResizeEnd = vi.fn();
    const { unmount } = renderPanel({ onResizeEnd });

    const handle = screen.getByLabelText("Resize summary panel width and height");
    const dragTarget = window;

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    unmount();
    fireEvent.mouseMove(dragTarget, { clientX: 620, clientY: 410 });
    fireEvent.mouseUp(dragTarget, { clientX: 620, clientY: 410 });

    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it("cancels an active drag when the window blurs", () => {
    const onResizeEnd = vi.fn();
    renderPanel({ onResizeEnd });

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width and height");

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent(window, new Event("blur"));
    fireEvent.mouseMove(window, { clientX: 620, clientY: 410 });
    fireEvent.mouseUp(window, { clientX: 620, clientY: 410 });

    expect(onResizeEnd).not.toHaveBeenCalled();
    expect(panel).toHaveStyle({ width: "520px", height: "320px" });
  });

  it("removes the blur listener after a completed drag", () => {
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");
    renderPanel();

    const handle = screen.getByLabelText("Resize summary panel width and height");

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(window, { clientX: 620, clientY: 410 });
    fireEvent.mouseUp(window, { clientX: 620, clientY: 410 });

    expect(removeListenerSpy).toHaveBeenCalledWith("blur", expect.any(Function));
  });

  it("resizes width only from the east handle", () => {
    renderPanel();

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width");

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(window, { clientX: 700, clientY: 480 });
    fireEvent.mouseUp(window, { clientX: 700, clientY: 480 });

    expect(panel).toHaveStyle({ width: "700px", height: "320px" });
  });

  it("resizes height only from the south handle", () => {
    renderPanel();

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel height");

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(window, { clientX: 780, clientY: 500 });
    fireEvent.mouseUp(window, { clientX: 780, clientY: 500 });

    expect(panel).toHaveStyle({ width: "520px", height: "500px" });
  });

  it("clamps the resized dimensions to the configured bounds", () => {
    renderPanel();

    const panel = screen.getByTestId("resizable-panel-summary");
    const handle = screen.getByLabelText("Resize summary panel width and height");

    fireEvent.mouseDown(handle, { clientX: 520, clientY: 320 });
    fireEvent.mouseMove(window, { clientX: 1200, clientY: 900 });
    fireEvent.mouseUp(window, { clientX: 1200, clientY: 900 });
    expect(panel).toHaveStyle({ width: "980px", height: "640px" });

    fireEvent.mouseDown(handle, { clientX: 980, clientY: 640 });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window, { clientX: 100, clientY: 100 });
    expect(panel).toHaveStyle({ width: "360px", height: "240px" });
  });
});
