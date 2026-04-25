import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { packMasonryItems } from "./masonry-layout";
import { ResizablePanel } from "./ResizablePanel";
import { useDesktopResize } from "./useDesktopResize";

type Size = {
  width: number;
  height: number;
};

export type MasonryWorkspaceItem = {
  id: string;
  label: string;
  className?: string;
  as?: "div" | "article";
  defaultSize: Size;
  minSize: Size;
  maxSize: Size;
  onResizeEnd?: (size: Size) => void;
  content: ReactNode;
};

const DEFAULT_WORKSPACE_WIDTH = 1200;
const MASONRY_GUTTER = 20;

export function MasonryWorkspace({
  workspaceId,
  items,
  className = "",
}: {
  workspaceId: string;
  items: MasonryWorkspaceItem[];
  className?: string;
}) {
  const isDesktop = useDesktopResize();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizedItemIdsRef = useRef(new Set<string>());
  const [containerWidth, setContainerWidth] = useState(DEFAULT_WORKSPACE_WIDTH);
  const [sizes, setSizes] = useState<Record<string, Size>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.defaultSize])),
  );

  useEffect(() => {
    setSizes((current) => {
      const nextSizes = Object.fromEntries(
        items.map((item) => [
          item.id,
          resizedItemIdsRef.current.has(item.id) ? current[item.id] ?? item.defaultSize : item.defaultSize,
        ]),
      );

      return haveSameSizes(current, nextSizes) ? current : nextSizes;
    });
  }, [items]);

  useEffect(() => {
    if (!isDesktop || !containerRef.current) {
      return;
    }

    const measure = () => {
      const nextWidth = Math.round(containerRef.current?.getBoundingClientRect().width ?? 0);

      if (nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [isDesktop]);

  const packedItems = useMemo(
    () =>
      packMasonryItems(
        items.map((item) => ({
          id: item.id,
          ...(sizes[item.id] ?? item.defaultSize),
        })),
        { width: containerWidth, gutter: MASONRY_GUTTER },
      ),
    [containerWidth, items, sizes],
  );

  if (!isDesktop) {
    return (
      <div
        ref={containerRef}
        data-testid={`masonry-workspace-${workspaceId}`}
        className={`masonry-workspace masonry-workspace-static dashboard-grid ${className}`.trim()}
      >
        {items.map((item) => (
          <ResizablePanel
            key={item.id}
            as={item.as}
            panelId={item.id}
            label={item.label}
            className={item.className}
            defaultSize={item.defaultSize}
            minSize={item.minSize}
            maxSize={item.maxSize}
            onResizeEnd={item.onResizeEnd}
          >
            {item.content}
          </ResizablePanel>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid={`masonry-workspace-${workspaceId}`}
      className={`masonry-workspace ${className}`.trim()}
      style={{ height: `${packedItems.height}px` }}
    >
      {items.map((item) => {
        const layout = packedItems.find((entry) => entry.id === item.id);
        const size = sizes[item.id] ?? item.defaultSize;

        if (!layout) {
          return null;
        }

        return (
          <div
            key={item.id}
            data-testid={`masonry-card-${workspaceId}-${item.id}`}
            className="masonry-card"
            style={{
              position: "absolute",
              left: `${layout.x}px`,
              top: `${layout.y}px`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
            }}
          >
            <ResizablePanel
              as={item.as}
              panelId={item.id}
              label={item.label}
              className={item.className}
              defaultSize={size}
              minSize={item.minSize}
              maxSize={item.maxSize}
              onResize={(nextSize) => {
                resizedItemIdsRef.current.add(item.id);
                setSizes((current) => ({ ...current, [item.id]: nextSize }));
              }}
              onResizeEnd={(nextSize) => {
                resizedItemIdsRef.current.add(item.id);
                setSizes((current) => ({ ...current, [item.id]: nextSize }));
                item.onResizeEnd?.(nextSize);
              }}
            >
              {item.content}
            </ResizablePanel>
          </div>
        );
      })}
    </div>
  );
}

function haveSameSizes(left: Record<string, Size>, right: Record<string, Size>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return rightKeys.every((key) => left[key]?.width === right[key].width && left[key]?.height === right[key].height);
}
