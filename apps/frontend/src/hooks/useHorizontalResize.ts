import { useEffect, useRef, useState } from "react";

type TResizeSide = "start" | "end";

interface IUseHorizontalResize {
  side: TResizeSide;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function useHorizontalResize({
  side,
  initialWidth = 300,
  minWidth = 180,
  maxWidth = 400,
}: IUseHorizontalResize) {
  const [width, setWidth] = useState(initialWidth);

  const isResizing = useRef(false);

  const startMouseX = useRef(0);
  const startWidth = useRef(initialWidth);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing.current) return;

      const direction = panelRef.current
        ? getComputedStyle(panelRef.current).direction
        : "ltr";

      const isRTL = direction === "rtl";

      const deltaX = event.clientX - startMouseX.current;

      let newWidth: number;

      if (side === "start") {
        const directionMultiplier = isRTL ? -1 : 1;

        newWidth = startWidth.current + deltaX * directionMultiplier;
      } else {
        const directionMultiplier = isRTL ? 1 : -1;

        newWidth = startWidth.current + deltaX * directionMultiplier;
      }

      setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      isResizing.current = false;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  const handleMouseDown = (event: React.MouseEvent) => {
    isResizing.current = true;

    startMouseX.current = event.clientX;
    startWidth.current = width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return {
    width,
    panelRef,
    handleMouseDown,
  };
}
