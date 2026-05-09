// ============================================================
// SkillsPanel - Componente React para exibir e gerenciar skills
// ============================================================

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkills } from '../../lib/skills/useSkills';
import { Skill, SkillCategory, PROVIDER_LABELS, PROVIDER_ICONS } from '../../lib/skills/types';
import { Skeleton } from '../shared/Skeleton';
import { toast } from '../../stores/toastStore';
import './SkillsPanel.css';

interface SkillsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider?: string;
}

const TABS: { category: SkillCategory; label: string; icon: string }[] = [
  { category: 'opencode', label: 'OpenCode', icon: '🔧' },
  { category: 'codex', label: 'Codex', icon: '⚡' },
  { category: 'claude', label: 'Claude', icon: '🧠' },
  { category: 'custom', label: 'Custom', icon: '✨' },
];

function isSkillCategory(value: string | undefined): value is SkillCategory {
  return value === 'opencode' || value === 'codex' || value === 'claude' || value === 'custom';
}

export function SkillsPanel({ isOpen, onClose, activeProvider }: SkillsPanelProps) {
  const initialTab = isSkillCategory(activeProvider) ? activeProvider : undefined;
  const {
    skillsByCategory,
    filteredSkillsByCategory,
    selectedTab,
    setSelectedTab,
    toggleSkill,
    isSkillEnabled,
    searchQuery,
    setSearchQuery,
    getCountByCategory,
    isLoading,
    error,
  } = useSkills(initialTab);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // isOpen é controlada pelo parent via renderização condicional
  // ou pode ser passada diretamente
  if (isOpen === false) return null;

  const skills = filteredSkillsByCategory[selectedTab] || [];

  return (
    <div className="skills-panel-overlay" onClick={onClose}>
      <div
        className="skills-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skills-panel-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="skills-panel-header">
          <div className="skills-panel-title">
            <span className="skills-panel-icon">🎯</span>
            <h2 id="skills-panel-title">Skills</h2>
          </div>
          <button type="button" className="skills-panel-close" onClick={onClose} aria-label="Fechar painel de skills">
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="skills-search">
          <input
            type="text"
            placeholder="Buscar skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="skills-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="skills-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="skills-tabs">
          {TABS.map(tab => {
            const counts = getCountByCategory(tab.category);
            const isActive = selectedTab === tab.category;
            
            return (
              <button
                key={tab.category}
                type="button"
                className={`skills-tab ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab.category)}
                aria-pressed={isActive}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
                <span className="tab-count">
                  {counts.enabled}/{counts.total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="skills-panel-content">
          {isLoading && (
            <div className="skills-skeleton" role="status" aria-live="polite" aria-label="Carregando skills">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-card-header">
                    <div className="skeleton-card-info">
                      <Skeleton variant="rectangular" className="skeleton-name" height={16} />
                      <Skeleton variant="rectangular" className="skeleton-badge" height={18} />
                    </div>
                    <Skeleton variant="rectangular" className="skeleton-toggle" height={22} borderRadius={11} />
                  </div>
                  <Skeleton variant="rectangular" className="skeleton-description" height={14} />
                  <Skeleton variant="rectangular" className="skeleton-description short" height={14} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="skills-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && skills.length === 0 && (
            <div className="skills-empty">
              <div className="empty-illustration">
                {selectedTab === 'custom' ? (
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                    <path d="M24 32H40M32 24V40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                    <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.2"/>
                  </svg>
                ) : (
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 28L32 20L44 28V44L32 52L20 44V28Z" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                    <path d="M32 20V52M20 28L44 44M44 28L20 44" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                  </svg>
                )}
              </div>
              <p className="empty-title">
                {selectedTab === 'custom' 
                  ? 'Nenhuma skill customizada encontrada' 
                  : `Nenhuma skill native do ${PROVIDER_LABELS[selectedTab]}`
                }
              </p>
              <p className="empty-description">
                {selectedTab === 'custom' 
                  ? 'Crie sua primeira skill adicionando uma pasta em .skills/ com arquivo SKILL.md'
                  : 'Skills nativas são carregadas automaticamente quando configuradas no projeto'
                }
              </p>
              {selectedTab === 'custom' && (
                <button
                  type="button"
                  className="empty-cta-btn"
                  onClick={() => {
                    // Open folder or show instructions
                    toast.info('Adicione skills em .skills/nome-da-skill/SKILL.md');
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Criar primeira skill
                </button>
              )}
            </div>
          )}

          {!isLoading && !error && skills.length > 0 && (
            <div className="skills-list">
              {skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  enabled={isSkillEnabled(skill.id)}
                  onToggle={() => toggleSkill(skill.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="skills-panel-footer">
          <p className="skills-hint">
            {activeProvider 
              ? `Skills ativas para ${PROVIDER_LABELS[activeProvider as keyof typeof PROVIDER_LABELS]}`
              : 'Selecione um provider para usar skills'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SkillCard - Card individual de uma skill
// ============================================================

interface SkillCardProps {
  skill: Skill;
  enabled: boolean;
  onToggle: () => void;
}

function SkillCard({ skill, enabled, onToggle }: SkillCardProps) {
  const isNative = skill.isNative;

  return (
    <div className={`skill-card ${enabled ? '' : 'disabled'} ${isNative ? 'native' : 'custom'}`}>
      <div className="skill-card-header">
        <div className="skill-info">
          <h3 className="skill-name">{skill.name}</h3>
          <span className={`skill-badge ${skill.category}`}>
            {PROVIDER_ICONS[skill.category]} {PROVIDER_LABELS[skill.category]}
          </span>
          {!isNative && (
            <span className="skill-badge custom-badge">Custom</span>
          )}
        </div>
        
        {/* Toggle switch - todas as skills */}
        <label className="skill-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            aria-label={`${enabled ? 'Desativar' : 'Ativar'} skill ${skill.name}`}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      
      <p className="skill-description">{skill.description}</p>
      
      {skill.license && (
        <span className="skill-meta">License: {skill.license}</span>
      )}
    </div>
  );
}

// ============================================================
// SkillsButton - Botão para abrir o painel
// ============================================================

interface SkillsButtonProps {
  onClick: () => void;
  skillCount?: number;
}

export function SkillsButton({ onClick, skillCount }: SkillsButtonProps) {
  return (
    <button type="button" className="skills-btn" onClick={onClick} title="Skills" aria-label="Abrir painel de skills">
      <span className="skills-btn-icon">🎯</span>
      <span className="skills-btn-label">Skills</span>
      {skillCount !== undefined && skillCount > 0 && (
        <span className="skills-btn-badge">{skillCount}</span>
      )}
    </button>
  );
}
