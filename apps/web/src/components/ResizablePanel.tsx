import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, Ref } from "react";
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
  onResize,
  onResizeEnd,
  as = "div",
  className = "",
  children,
}: {
  panelId: string;
  label: string;
  defaultSize?: Size;
  minSize: Size;
  maxSize: Size;
  onResize?: (size: Size) => void;
  onResizeEnd?: (size: Size) => void;
  as?: "div" | "article";
  className?: string;
  children: ReactNode;
}) {
  const isDesktop = useDesktopResize();
  const [size, setSize] = useState<Size | null>(defaultSize ?? null);
  const [dragging, setDragging] = useState<ResizeMode | null>(null);
  const sizeRef = useRef<Size | null>(defaultSize ?? null);
  const panelRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const panelStyle = useMemo(
    () =>
      size
        ? {
            width: `${size.width}px`,
            height: `${size.height}px`,
          }
        : undefined,
    [size],
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || size || !panelRef.current) {
      return;
    }

    const nextSize = {
      width: Math.round(panelRef.current.getBoundingClientRect().width),
      height: Math.round(panelRef.current.getBoundingClientRect().height),
    };

    sizeRef.current = nextSize;
    setSize(nextSize);
  }, [isDesktop, size]);

  const startResize =
    (mode: ResizeMode) =>
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!isDesktop) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const currentSize =
        sizeRef.current ??
        (panelRef.current
          ? {
              width: Math.round(panelRef.current.getBoundingClientRect().width),
              height: Math.round(panelRef.current.getBoundingClientRect().height),
            }
          : minSize);
      const startWidth = currentSize.width;
      const startHeight = currentSize.height;

      setDragging(mode);
      cleanupRef.current?.();
      sizeRef.current = currentSize;
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

      const onMove: EventListener = (moveEvent) => {
        if (!(moveEvent instanceof MouseEvent)) {
          return;
        }

        const nextSize = getNextSize(moveEvent.clientX, moveEvent.clientY);

        sizeRef.current = nextSize;
        if (panelRef.current) {
          panelRef.current.style.width = `${nextSize.width}px`;
          panelRef.current.style.height = `${nextSize.height}px`;
        }
        setSize(nextSize);
        onResize?.(nextSize);
      };

      const removeDragListeners = () => {
        dragTarget.removeEventListener("mousemove", onMove);
        dragTarget.removeEventListener("mouseup", onUp);
      };

      const removeListeners = () => {
        window.removeEventListener("blur", onCancel);
        removeDragListeners();
        cleanupRef.current = null;
      };

      const onUp: EventListener = (upEvent) => {
        if (!(upEvent instanceof MouseEvent)) {
          return;
        }

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

      const onCancel = () => {
        setDragging(null);
        removeListeners();
      };

      dragTarget.addEventListener("mousemove", onMove);
      dragTarget.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onCancel, { once: true });
      cleanupRef.current = removeListeners;
    };

  const resizeHandles = isDesktop ? (
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
  ) : null;

  const panelClassName = `resizable-panel ${dragging ? "resizable-panel-dragging" : ""} ${className}`.trim();
  const panelTestId = `resizable-panel-${panelId}`;

  if (as === "article") {
    return (
      <article
        ref={panelRef as Ref<HTMLElement>}
        data-testid={panelTestId}
        className={panelClassName}
        style={isDesktop ? panelStyle : undefined}
      >
        {children}
        {resizeHandles}
      </article>
    );
  }

  return (
    <div
      ref={panelRef as Ref<HTMLDivElement>}
      data-testid={panelTestId}
      className={panelClassName}
      style={isDesktop ? panelStyle : undefined}
    >
      {children}
      {resizeHandles}
    </div>
  );
}
