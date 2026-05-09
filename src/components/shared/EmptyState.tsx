import React from "react";
import { FolderGit2, MessageSquare, Inbox, Search, Plus, Sparkles } from "lucide-react";

interface EmptyStateProps {
  icon?: "folder" | "messages" | "inbox" | "search" | "sparkles" | React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  style?: React.CSSProperties;
  size?: "small" | "medium" | "large";
}

const iconMap = {
  folder: FolderGit2,
  messages: MessageSquare,
  inbox: Inbox,
  search: Search,
  sparkles: Sparkles,
};
type IconName = keyof typeof iconMap;

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "inbox",
  title,
  description,
  action,
  secondaryAction,
  style,
  size = "medium",
}) => {
  const IconComponent = typeof icon === "string" ? iconMap[icon as IconName] : null;
  
  const sizeStyles = {
    small: { containerPadding: "16px 12px", iconSize: 36, fontSize: 13 },
    medium: { containerPadding: "32px 16px", iconSize: 52, fontSize: 14 },
    large: { containerPadding: "48px 24px", iconSize: 64, fontSize: 16 },
  };
  
  const sizes = sizeStyles[size];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: sizes.containerPadding,
        textAlign: "center",
        ...style,
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: sizes.iconSize,
          height: sizes.iconSize,
          borderRadius: "var(--radius-lg)",
          background: "rgba(255, 107, 107, 0.08)",
          border: "1px solid rgba(255, 107, 107, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {IconComponent ? (
          <IconComponent size={sizes.iconSize * 0.44} style={{ color: "var(--accent)", opacity: 0.7 }} />
        ) : (
          icon
        )}
      </div>

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontSize: sizes.fontSize,
          fontWeight: 500,
          color: "var(--text-2)",
        }}
      >
        {title}
      </p>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: sizes.fontSize - 1.5,
            color: "var(--text-3)",
            maxWidth: 280,
          }}
        >
          {description}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              fontSize: sizes.fontSize - 1,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {action.icon}
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "var(--text-2)",
              cursor: "pointer",
              fontSize: sizes.fontSize - 1,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
