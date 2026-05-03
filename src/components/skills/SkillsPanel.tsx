/**
 * SkillsPanel - Unified Skills UI Component
 * 
 * This component provides a unified interface for managing skills
 * across all engines (Codex, OpenCode, Claude).
 */

import { useState, useMemo } from "react";
import { X, Search, ChevronRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSkills } from "./useSkills";
import type { UnifiedSkill, SkillCategory } from "./types";

/**
 * Props for SkillsPanel
 */
export interface SkillsPanelProps {
  engineId: string;
  onClose: () => void;
  onSkillSelect?: (skill: UnifiedSkill) => void;
}

/**
 * Category icons and labels
 */
const CATEGORY_INFO: Record<
  SkillCategory,
  { icon: string; label: string; color: string }
> = {
  frontend: { icon: "🎨", label: "Frontend", color: "#06b6d4" },
  backend: { icon: "⚙️", label: "Backend", color: "#8b5cf6" },
  data: { icon: "📊", label: "Data", color: "#f59e0b" },
  devops: { icon: "🚀", label: "DevOps", color: "#10b981" },
  security: { icon: "🔒", label: "Security", color: "#ef4444" },
  testing: { icon: "🧪", label: "Testing", color: "#ec4899" },
  custom: { icon: "✨", label: "Custom", color: "#6366f1" },
};

/**
 * SkillsPanel Component
 */
export function SkillsPanel({
  engineId,
  onClose,
  onSkillSelect,
}: SkillsPanelProps) {
  const { t } = useTranslation("chat");
  const { skills, isEnabled, toggleSkill, byCategory } = useSkills(engineId);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(byCategory)),
  );
  const [activeTab, setActiveTab] = useState<"all" | "enabled">("all");

  // Filter skills by search query
  const filteredByCategory = useMemo(() => {
    if (!searchQuery.trim()) return byCategory;

    const query = searchQuery.toLowerCase();
    const result: Record<string, UnifiedSkill[]> = {};

    for (const [category, categorySkills] of Object.entries(byCategory)) {
      const filtered = categorySkills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query),
      );
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }

    return result;
  }, [byCategory, searchQuery]);

  // Get skills for active tab
  const displayedSkills = useMemo(() => {
    if (activeTab === "enabled") {
      return Object.entries(filteredByCategory).reduce(
        (acc, [category, categorySkills]) => {
          const enabled = categorySkills.filter((s) => isEnabled(s.id));
          if (enabled.length > 0) {
            acc[category] = enabled;
          }
          return acc;
        },
        {} as Record<string, UnifiedSkill[]>,
      );
    }
    return filteredByCategory;
  }, [filteredByCategory, activeTab, isEnabled]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle skill click
  const handleSkillClick = (skill: UnifiedSkill) => {
    if (onSkillSelect) {
      onSkillSelect(skill);
    } else {
      toggleSkill(skill.id);
    }
  };

  const categories = Object.keys(displayedSkills).sort();

  return (
    <div className="skills-panel">
      {/* Header */}
      <div className="skills-panel-header">
        <div className="skills-panel-title">
          <span className="skills-panel-icon">🧩</span>
          <span>{t("skills.title", "Skills")}</span>
        </div>
        <button
          type="button"
          className="skills-panel-close"
          onClick={onClose}
          title={t("skills.close", "Close")}
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="skills-panel-search">
        <Search size={14} />
        <input
          type="text"
          placeholder={t("skills.search", "Search skills...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="skills-panel-search-input"
        />
      </div>

      {/* Tabs */}
      <div className="skills-panel-tabs">
        <button
          type="button"
          className={`skills-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          {t("skills.all", "All")}
          <span className="skills-tab-count">{skills.length}</span>
        </button>
        <button
          type="button"
          className={`skills-tab ${activeTab === "enabled" ? "active" : ""}`}
          onClick={() => setActiveTab("enabled")}
        >
          {t("skills.enabled", "Enabled")}
          <span className="skills-tab-count">
            {skills.filter((s) => isEnabled(s.id)).length}
          </span>
        </button>
      </div>

      {/* Skills List */}
      <div className="skills-panel-content">
        {categories.length === 0 ? (
          <div className="skills-panel-empty">
            {searchQuery
              ? t("skills.noResults", "No skills match your search")
              : t("skills.noSkills", "No skills available for this engine")}
          </div>
        ) : (
          categories.map((category) => (
            <div key={category} className="skills-category">
              {/* Category Header */}
              <button
                type="button"
                className="skills-category-header"
                onClick={() => toggleCategory(category)}
              >
                <ChevronRight
                  size={14}
                  className={`skills-category-chevron ${
                    expandedCategories.has(category) ? "expanded" : ""
                  }`}
                />
                <span className="skills-category-icon">
                  {CATEGORY_INFO[category as SkillCategory]?.icon || "📦"}
                </span>
                <span className="skills-category-label">
                  {CATEGORY_INFO[category as SkillCategory]?.label || category}
                </span>
                <span className="skills-category-count">
                  {displayedSkills[category].length}
                </span>
              </button>

              {/* Category Skills */}
              {expandedCategories.has(category) && (
                <div className="skills-category-list">
                  {displayedSkills[category].map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={`skills-item ${
                        isEnabled(skill.id) ? "enabled" : ""
                      }`}
                      onClick={() => handleSkillClick(skill)}
                      title={skill.description}
                    >
                      <div className="skills-item-checkbox">
                        {isEnabled(skill.id) && <Check size={12} />}
                      </div>
                      <div className="skills-item-content">
                        <div className="skills-item-header">
                          {skill.icon && (
                            <span className="skills-item-icon">
                              {skill.icon}
                            </span>
                          )}
                          <span className="skills-item-name">{skill.name}</span>
                        </div>
                        <div className="skills-item-description">
                          {skill.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="skills-panel-footer">
        <span className="skills-panel-engine">
          {t("skills.engine", "Engine")}: {engineId}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact skill button for toolbar integration
 */
export interface SkillButtonProps {
  engineId: string;
  onClick: () => void;
  enabledCount?: number;
}

export function SkillButton({ engineId, onClick, enabledCount }: SkillButtonProps) {
  const { t } = useTranslation("chat");

  return (
    <button
      type="button"
      className="chat-toolbar-btn chat-toolbar-btn-bordered"
      onClick={onClick}
      title={t("skills.buttonTitle", "Skills")}
    >
      <span>🧩</span>
      <span style={{ fontSize: 11 }}>{t("skills.shortTitle", "Skills")}</span>
      {enabledCount !== undefined && enabledCount > 0 && (
        <span className="chat-toolbar-badge">{enabledCount}</span>
      )}
    </button>
  );
}
