// A small spinning ring. Holds still for people who turn off motion.
export default function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin ${className}`} />
  );
}
