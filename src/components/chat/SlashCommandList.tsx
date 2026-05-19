import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SlashCommandItem {
  name: string;
  detail?: string;
  enabled?: boolean;
  badge?: string;
}

interface SlashCommandListProps {
  icon: LucideIcon;
  title: string;
  emptyLabel: string;
  items: SlashCommandItem[];
  onDismiss: () => void;
}

export function SlashCommandList({
  icon: Icon,
  title,
  emptyLabel,
  items,
  onDismiss,
}: SlashCommandListProps) {
  const { t } = useTranslation("chat");
  return (
    <div className="chat-command-panel">
      <div className="chat-command-panel-header">
        <div className="chat-command-panel-title">
          <Icon size={12} />
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="chat-command-panel-close"
          onClick={onDismiss}
        >
          <X size={12} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="chat-command-panel-desc">{emptyLabel}</div>
      ) : (
        <div className="chat-command-panel-info-list">
          {items.map((item) => (
            <div key={item.name} className="chat-command-panel-info-item">
              <span className="chat-command-panel-info-name">
                {item.name}
              </span>
              {item.detail && (
                <span className="chat-command-panel-info-detail">
                  {item.detail}
                </span>
              )}
              {item.enabled !== undefined && (
                <span
                  className={`chat-command-panel-info-badge ${item.enabled ? "chat-command-panel-info-badge-on" : "chat-command-panel-info-badge-off"}`}
                >
                  {item.enabled ? t("slashCommands.panels.info.badgeOn") : t("slashCommands.panels.info.badgeOff")}
                </span>
              )}
              {item.badge && (
                <span className="chat-command-panel-info-badge">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}