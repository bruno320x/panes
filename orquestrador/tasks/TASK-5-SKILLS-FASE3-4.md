# TASK-5: Skills Unificado - Fase 3-4 (Hooks e UI)

## 📋 Descrição
Criar os hooks e componentes de UI para o sistema de Skills.

## 🎯 Objetivo
Fornecer interface consumível por outros componentes (especialmente ChatPanel).

## 📁 Novos Arquivos a Criar

### Hooks
- `src/components/skills/useUnifiedSkills.ts`

### UI Components
- `src/components/skills/SkillCard.tsx`
- `src/components/skills/SkillsPanel.tsx`
- `src/components/skills/SkillsPicker.tsx`

## 📁 Arquivos de Referência
- `src/components/chat/CodexRuntimePicker.tsx` (para UI patterns)
- `src/components/chat/OpenCodeAgentPicker.tsx` (para UI patterns)

## 🔧 Tarefas Específicas

### 5.1 useUnifiedSkills Hook
```typescript
// src/components/skills/useUnifiedSkills.ts
import { useState, useCallback, useEffect } from 'react';
import { skillRegistry } from '../../lib/skills/skillRegistry';
import { skillsStore } from '../../lib/skills/store';
import type { UnifiedSkill, SkillEngine } from './types';

export function useUnifiedSkills(engineId: SkillEngine) {
  const [skills, setSkills] = useState<UnifiedSkill[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar skills do registry
  const loadSkills = useCallback(() => {
    const allSkills = skillRegistry.getSkillsForEngine(engineId);
    const withOverrides = allSkills.map(skill => ({
      ...skill,
      enabled: skillsStore.isEnabled(skill.id, engineId),
    }));
    setSkills(withOverrides);
    setLoading(false);
  }, [engineId]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Toggle skill
  const toggleSkill = useCallback((skillId: string) => {
    skillsStore.toggleSkill(skillId, engineId);
    loadSkills();
  }, [engineId, loadSkills]);

  // Get active skills
  const activeSkills = skills.filter(s => s.enabled);

  return {
    skills,
    activeSkills,
    toggleSkill,
    loading,
  };
}
```

### 5.2 SkillCard Component
```tsx
// src/components/skills/SkillCard.tsx
import type { UnifiedSkill } from './types';

interface SkillCardProps {
  skill: UnifiedSkill;
  enabled: boolean;
  onToggle: () => void;
  engineSupports: boolean;
}

export function SkillCard({ skill, enabled, onToggle, engineSupports }: SkillCardProps) {
  return (
    <div className={`skill-card ${enabled ? 'skill-card-enabled' : ''}`}>
      <div className="skill-card-header">
        <span className="skill-icon">{skill.icon || '🔧'}</span>
        <span className="skill-name">{skill.name}</span>
        <button
          type="button"
          className={`skill-toggle ${enabled ? 'active' : ''}`}
          onClick={onToggle}
          disabled={!engineSupports}
        >
          {enabled ? '✓' : '○'}
        </button>
      </div>
      <p className="skill-description">{skill.description}</p>
      <div className="skill-meta">
        <span className="skill-category">{skill.category}</span>
        {skill.scope !== 'global' && (
          <span className="skill-scope">{skill.scope}</span>
        )}
      </div>
    </div>
  );
}
```

### 5.3 SkillsPanel Component
```tsx
// src/components/skills/SkillsPanel.tsx
import { useState } from 'react';
import { useUnifiedSkills } from './useUnifiedSkills';
import { SkillCard } from './SkillCard';
import type { SkillEngine } from './types';

interface SkillsPanelProps {
  engineId: SkillEngine;
  isOpen: boolean;
  onClose: () => void;
}

export function SkillsPanel({ engineId, isOpen, onClose }: SkillsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'enabled' | 'this-engine'>('all');
  const { skills, activeSkills, toggleSkill } = useUnifiedSkills(engineId);

  if (!isOpen) return null;

  const filteredSkills = skills.filter(skill => {
    if (filter === 'enabled') return skill.enabled;
    if (filter === 'this-engine') return skill.engines[engineId] !== undefined;
    return true;
  });

  return (
    <aside className="skills-panel">
      <header className="skills-panel-header">
        <h3>Skills</h3>
        <span className="skill-count">{activeSkills.length}/{skills.length}</span>
        <button onClick={onClose} className="close-btn">×</button>
      </header>

      <div className="skills-filter">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={filter === 'enabled' ? 'active' : ''}
          onClick={() => setFilter('enabled')}
        >
          Enabled
        </button>
        <button
          className={filter === 'this-engine' ? 'active' : ''}
          onClick={() => setFilter('this-engine')}
        >
          Current Engine
        </button>
      </div>

      <div className="skills-list">
        {filteredSkills.map(skill => (
          <SkillCard
            key={skill.id}
            skill={skill}
            enabled={skill.enabled}
            onToggle={() => toggleSkill(skill.id)}
            engineSupports={skill.engines[engineId] !== undefined}
          />
        ))}
      </div>
    </aside>
  );
}
```

### 5.4 CSS/Styles
Criar arquivo `src/components/skills/skills.css` com:
- `.skills-panel` - container principal
- `.skill-card` - card individual
- `.skill-card-enabled` - estado ativo
- `.skill-toggle` - botão de toggle
- `.skill-category` - badge de categoria

## ✅ Critérios de Verificação

1. Hook retorna skills corretas por engine
2. SkillCard renderiza informações corretamente
3. SkillsPanel abre/fecha e filtra corretamente
4. CSS aplicado corretamente

## 📝 Commits Sugeridos
- `feat(skills): add useUnifiedSkills hook`
- `feat(skills): add SkillCard component`
- `feat(skills): add SkillsPanel component`
- `feat(skills): add styles for skills components`

## ⏱️ Estimativa: 4-5 horas
