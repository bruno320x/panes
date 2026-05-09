import React from "react";

interface SkeletonProps {
  variant?: "rectangular" | "circular" | "text";
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangular",
  width,
  height,
  borderRadius,
  className,
  style = {},
}) => {
  const variantStyles: Record<NonNullable<SkeletonProps["variant"]>, React.CSSProperties> = {
    rectangular: {
      width: width ?? "100%",
      height: height ?? 20,
      borderRadius: borderRadius ?? 4,
    },
    circular: {
      width: width ?? 40,
      height: height ?? 40,
      borderRadius: "50%",
    },
    text: {
      width: width ?? "100%",
      height: height ?? 16,
      borderRadius: borderRadius ?? 4,
    },
  };

  return (
    <div
      className={`skeleton ${variant} ${className ?? ""}`}
      style={{
        ...variantStyles[variant],
        background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-highlight) 50%, var(--skeleton-base) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite linear",
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export const SkeletonGroup: React.FC<{
  count?: number;
  height?: number | string;
  gap?: number;
  children?: React.ReactNode;
}> = ({ count = 3, height = 40, gap = 8, children }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {children ??
        Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={height} />
        ))}
    </div>
  );
};

export const SidebarSkeleton: React.FC = () => {
  return (
    <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Nav items skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Skeleton variant="rectangular" height={28} borderRadius={6} />
        <Skeleton variant="rectangular" height={28} borderRadius={6} />
        <Skeleton variant="rectangular" height={28} borderRadius={6} />
      </div>
      
      {/* Workspace section */}
      <div style={{ marginTop: 8 }}>
        <Skeleton variant="text" width={80} height={12} />
      </div>
      
      {/* Project threads skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton variant="rectangular" height={32} borderRadius={6} />
        <SkeletonGroup count={4} height={28} gap={4} />
      </div>
      
      {/* Another project */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton variant="rectangular" height={32} borderRadius={6} />
        <SkeletonGroup count={2} height={28} gap={4} />
      </div>
    </div>
  );
};

export const ChatSkeleton: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px" }}>
      {/* Welcome header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={14} style={{ marginTop: 4 }} />
        </div>
      </div>
      
      {/* Message bubbles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton variant="rectangular" width="70%" height={60} borderRadius={12} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Skeleton variant="rectangular" width="85%" height={80} borderRadius={12} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton variant="rectangular" width="55%" height={48} borderRadius={12} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Skeleton variant="rectangular" width="75%" height={64} borderRadius={12} />
        </div>
      </div>
      
      {/* Input area */}
      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <Skeleton variant="rectangular" height={44} borderRadius={22} />
      </div>
    </div>
  );
};

// CSS for animation - add to global styles
export const skeletonStyles = `
@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

:root {
  --skeleton-base: rgba(255, 255, 255, 0.06);
  --skeleton-highlight: rgba(255, 255, 255, 0.12);
}

[data-theme="light"] {
  --skeleton-base: rgba(0, 0, 0, 0.06);
  --skeleton-highlight: rgba(0, 0, 0, 0.1);
}
`;

// Enhanced Sidebar Skeleton with shimmer animation
export const EnhancedSidebarSkeleton: React.FC = () => {
  return (
    <div className="sb-skeleton">
      {/* Nav items skeleton */}
      <div className="sb-skeleton-nav">
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 6 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 6 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 6 }} />
      </div>
      
      {/* Workspace section */}
      <div className="sb-skeleton-workspace-header">
        <div className="skeleton-line" style={{ width: 80, height: 12 }} />
      </div>
      
      {/* Project threads skeleton */}
      <div className="sb-skeleton-threads">
        <div className="skeleton-item" style={{ width: "100%", height: 32, borderRadius: 6 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 4 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 4 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 4 }} />
      </div>
      
      {/* Another project */}
      <div className="sb-skeleton-threads">
        <div className="skeleton-item" style={{ width: "100%", height: 32, borderRadius: 6 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 4 }} />
        <div className="skeleton-item" style={{ width: "100%", height: 28, borderRadius: 4 }} />
      </div>
    </div>
  );
};
