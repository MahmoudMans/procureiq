interface SkeletonProps {
  height?: number;
  width?: number | string;
  radius?: number;
}

/** Shimmering placeholder (the shimmer itself comes from .skeleton in theme.css). */
export function Skeleton({ height = 14, width = "100%", radius }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ height, width, borderRadius: radius }}
    />
  );
}
