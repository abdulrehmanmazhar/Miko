import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface PanelShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const PanelShell = forwardRef<HTMLDivElement, PanelShellProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "m-px overflow-hidden rounded-lg border border-border bg-card",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

PanelShell.displayName = "PanelShell";

export default PanelShell;
