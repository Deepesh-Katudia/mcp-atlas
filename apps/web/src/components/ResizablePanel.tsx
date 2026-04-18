import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useDesktopResize } from "./useDesktopResize";

type Size = {
  width: number;
  height: number;
};

type ResizeMode = "width" | "height" | "both";

export function ResizablePanel({
  panelId,
  label,
  defaultSize,
  minSize,
  maxSize,
  onResizeEnd,
  className = "",
  children,
}: {
  panelId: string;
  label: string;
  defaultSize: Size;
  minSize: Size;
  maxSize: Size;
  onResizeEnd?: (size: Size) => void;
  className?: string;
  children: ReactNode;
}) {
  const isDesktop = useDesktopResize();
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState<ResizeMode | null>(null);
  const sizeRef = useRef(defaultSize);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const panelStyle = useMemo(
    () => ({
      width: `${size.width}px`,
      height: `${size.height}px`,
    }),
    [size],
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startResize =
    (mode: ResizeMode) =>
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!isDesktop) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = sizeRef.current.width;
      const startHeight = sizeRef.current.height;

      setDragging(mode);
      cleanupRef.current?.();
      const ownerDocument = event.currentTarget.ownerDocument;
      const dragTarget = ownerDocument.defaultView ?? ownerDocument;
      const getNextSize = (clientX: number, clientY: number) => ({
        width:
          mode === "height"
            ? startWidth
            : Math.min(maxSize.width, Math.max(minSize.width, startWidth + clientX - startX)),
        height:
          mode === "width"
            ? startHeight
            : Math.min(maxSize.height, Math.max(minSize.height, startHeight + clientY - startY)),
      });

      const onMove = (moveEvent: MouseEvent) => {
        const nextSize = getNextSize(moveEvent.clientX, moveEvent.clientY);

        sizeRef.current = nextSize;
        if (panelRef.current) {
          panelRef.current.style.width = `${nextSize.width}px`;
          panelRef.current.style.height = `${nextSize.height}px`;
        }
        setSize(nextSize);
      };

      const removeListeners = () => {
        dragTarget.removeEventListener("mousemove", onMove);
        dragTarget.removeEventListener("mouseup", onUp);
        cleanupRef.current = null;
      };

      const onUp = (upEvent: MouseEvent) => {
        const nextSize = getNextSize(upEvent.clientX, upEvent.clientY);
        sizeRef.current = nextSize;
        if (panelRef.current) {
          panelRef.current.style.width = `${nextSize.width}px`;
          panelRef.current.style.height = `${nextSize.height}px`;
        }
        setSize(nextSize);
        setDragging(null);
        onResizeEnd?.(sizeRef.current);
        removeListeners();
      };

      cleanupRef.current = removeListeners;
      dragTarget.addEventListener("mousemove", onMove);
      dragTarget.addEventListener("mouseup", onUp);
    };

  return (
    <div
      ref={panelRef}
      data-testid={`resizable-panel-${panelId}`}
      className={`resizable-panel ${dragging ? "resizable-panel-dragging" : ""} ${className}`.trim()}
      style={isDesktop ? panelStyle : undefined}
    >
      {children}
      {isDesktop ? (
        <>
          <button
            type="button"
            className="resize-handle resize-handle-east"
            aria-label={`Resize ${label} width`}
            onMouseDown={startResize("width")}
          />
          <button
            type="button"
            className="resize-handle resize-handle-south"
            aria-label={`Resize ${label} height`}
            onMouseDown={startResize("height")}
          />
          <button
            type="button"
            className="resize-handle resize-handle-corner"
            aria-label={`Resize ${label} width and height`}
            onMouseDown={startResize("both")}
          />
        </>
      ) : null}
    </div>
  );
}
