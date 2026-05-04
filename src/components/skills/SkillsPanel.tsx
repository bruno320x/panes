// ============================================================
// SkillsPanel - Componente React para exibir e gerenciar skills
// ============================================================

import React, { useState } from 'react';
import { useSkills } from '../../lib/skills/useSkills';
import { Skill, SkillCategory, PROVIDER_LABELS, PROVIDER_ICONS } from '../../lib/skills/types';
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

export function SkillsPanel({ isOpen, onClose, activeProvider }: SkillsPanelProps) {
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
  } = useSkills(selectedTab);

  // isOpen é controlada pelo parent via renderização condicional
  // ou pode ser passada diretamente
  if (isOpen === false) return null;

  const skills = filteredSkillsByCategory[selectedTab] || [];

  return (
    <div className="skills-panel-overlay" onClick={onClose}>
      <div className="skills-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="skills-panel-header">
          <div className="skills-panel-title">
            <span className="skills-panel-icon">🎯</span>
            <h2>Skills</h2>
          </div>
          <button className="skills-panel-close" onClick={onClose} aria-label="Fechar">
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
              className="skills-search-clear"
              onClick={() => setSearchQuery('')}
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
                className={`skills-tab ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab.category)}
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
            <div className="skills-loading">
              <div className="skills-spinner"></div>
              <span>Carregando skills...</span>
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
              <span className="empty-icon">
                {selectedTab === 'custom' ? '📁' : '📭'}
              </span>
              <p>
                {selectedTab === 'custom' 
                  ? 'Nenhuma skill customizada encontrada.\nCrie uma pasta em .skills/ com SKILL.md'
                  : `Nenhuma skill native do ${PROVIDER_LABELS[selectedTab]} encontrada.`
                }
              </p>
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
            {currentProvider 
              ? `Skills ativas para ${PROVIDER_LABELS[activeProvider]}`
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
        
        {/* Toggle switch - só para skills nativas */}
        {isNative && (
          <label className="skill-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={onToggle}
            />
            <span className="toggle-slider"></span>
          </label>
        )}
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
    <button className="skills-btn" onClick={onClick} title="Skills">
      <span className="skills-btn-icon">🎯</span>
      <span className="skills-btn-label">Skills</span>
      {skillCount !== undefined && skillCount > 0 && (
        <span className="skills-btn-badge">{skillCount}</span>
      )}
    </button>
  );
}
