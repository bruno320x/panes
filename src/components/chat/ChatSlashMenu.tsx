import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { getEngineFeatures } from "./engineFeatureFlags";
import "./ChatSlashMenu.css";

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  codexOnly?: boolean;
  disabled?: boolean;
  engineSpecific?: boolean;
  /** Custom reason why this command is unavailable */
  unavailableReason?: string;
}

interface ChatSlashMenuProps {
  visible: boolean;
  query: string;
  commands: SlashCommand[];
  engineId?: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  activeIndex: number;
  onSelect: (commandId: string) => void;
  onDismiss: () => void;
  onActiveChange: (index: number) => void;
}

/**
 * Check if a slash command is unavailable based on feature flags
 */
function isCommandUnavailable(
  cmd: SlashCommand,
  engineId: string,
  availableSlashCommands: Set<string>,
): { unavailable: boolean; reason?: string } {
  // Explicitly disabled commands
  if (cmd.disabled) {
    return { unavailable: true, reason: cmd.unavailableReason || "This command is disabled" };
  }

  // Codex-only commands: check if command is available in feature flags
  if (cmd.codexOnly) {
    const commandKey = `/${cmd.name}`;
    if (!availableSlashCommands.has(commandKey)) {
      const reason = cmd.unavailableReason ||
        `/${cmd.name} is not available for ${engineId} engine`;
      return { unavailable: true, reason };
    }
  }

  return { unavailable: false };
}

export function ChatSlashMenu({
  visible,
  query,
  commands,
  engineId = "codex",
  anchorRef,
  activeIndex,
  onSelect,
  onDismiss,
  onActiveChange,
}: ChatSlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ bottom: 0, left: 0, width: 0 });

  // Get features for the current engine from feature flags
  const engineFeatures = useMemo(
    () => getEngineFeatures(engineId),
    [engineId]
  );
  const availableSlashCommands = new Set<string>(engineFeatures.slashCommands);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
      width: Math.min(340, rect.width),
    });
  }, [visible, anchorRef, query]);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;

    function onPointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      onDismiss();
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [visible, onDismiss]);

  // Scroll active item into view
  useEffect(() => {
    if (!visible) return;
    const activeEl = menuRef.current?.querySelector(
      `[data-slash-index="${activeIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, visible]);

  if (!visible || commands.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="slash-menu"
      style={{
        position: "fixed",
        zIndex: 1400,
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
      }}
    >
      {commands.map((cmd, i) => {
        const Icon = cmd.icon;
        const isActive = i === activeIndex;
        const { unavailable, reason } = isCommandUnavailable(cmd, engineId, availableSlashCommands);
        const itemClassName = [
          "slash-menu-item",
          isActive ? "slash-menu-item-active" : "",
          cmd.disabled ? "slash-menu-item-disabled" : "",
          unavailable ? "slash-menu-item-unavailable" : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            key={cmd.id}
            type="button"
            data-slash-index={i}
            className={itemClassName}
            onPointerEnter={() => onActiveChange(i)}
            onClick={() => {
              if (!unavailable) onSelect(cmd.id);
            }}
            disabled={unavailable}
            title={unavailable ? reason : undefined}
          >
            <span className="slash-menu-item-icon">
              <Icon size={14} />
            </span>
            <span className="slash-menu-item-text">
              <span className="slash-menu-item-name">{cmd.name[0].toUpperCase() + cmd.name.slice(1)}</span>
              <span className="slash-menu-item-desc">{cmd.description}</span>
            </span>
            {/* SC2: N/A Badge for unavailable commands */}
            {unavailable && (
              <span className="slash-menu-item-badge-na" title={reason}>
                N/A
              </span>
            )}
            {/* Show "Codex" badge for available codex-only commands */}
            {cmd.codexOnly && availableSlashCommands.has(`/${cmd.name}`) && (
              <span className="slash-menu-item-badge">Codex</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
