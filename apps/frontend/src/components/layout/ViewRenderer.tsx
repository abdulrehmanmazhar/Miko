import { getViewMeta, type ViewRef } from "@/utils/views";
import { createElement } from "react";

interface ViewRendererProps {
  viewRef: ViewRef | null | undefined;
}

function ViewRenderer({ viewRef }: ViewRendererProps) {
  if (!viewRef) return null;
  const { component } = getViewMeta(viewRef);
  return createElement(component);
}

export default ViewRenderer;
