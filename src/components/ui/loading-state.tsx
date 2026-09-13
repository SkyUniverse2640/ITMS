import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-40 items-center justify-center", className)}
      role="status"
      aria-live="polite"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
