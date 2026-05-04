# TASK-6: Skills Unificado - Fase 6-7 (Integração)

## 📋 Descrição
Integrar o sistema de Skills Unificado com o ChatPanel existente.

## 🎯 Objetivo
Adicionar botão de Skills na toolbar do ChatPanel e permitir ativação de skills durante a conversa.

## 📁 Arquivos a Modificar

### MAY MODIFY:
- `src/components/chat/ChatPanel.tsx` (adição de botão)
- `src/components/chat/ModelPicker.tsx` (para indicator de skill)

### Criar:
- `src/components/skills/SkillsButton.tsx` (botão para toolbar)

## 📁 Arquivos de Referência
- `src/components/chat/ChatPanel.tsx` (linhas ~1900-2000 para toolbar)
- `src/components/chat/CodexRuntimePicker.tsx` (para pattern de popover)

## 🔧 Tarefas Específicas

### 6.1 Criar SkillsButton Component
```tsx
// src/components/skills/SkillsButton.tsx
import { useState, useCallback } from 'react';
import { useUnifiedSkills } from './useUnifiedSkills';
import { SkillsPanel } from './SkillsPanel';
import type { SkillEngine } from './types';

interface SkillsButtonProps {
  engineId: SkillEngine;
}

export function SkillsButton({ engineId }: SkillsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activeSkills } = useUnifiedSkills(engineId);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <>
      <button
        type="button"
        className={`chat-toolbar-btn ${isOpen ? 'chat-toolbar-btn-active' : ''}`}
        onClick={handleToggle}
        title="Skills"
      >
        <span>💎</span>
        <span style={{ fontSize: 11 }}>Skills</span>
        {activeSkills.length > 0 && (
          <span className="chat-toolbar-badge">{activeSkills.length}</span>
        )}
      </button>

      <SkillsPanel
        engineId={engineId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
```

### 6.2 Integrar no ChatPanel
No `ChatPanel.tsx`, encontrar a toolbar e adicionar o botão:

```tsx
// No toolbar JSX, próximo aos botões existentes:
<SkillsButton engineId={selectedEngineId as SkillEngine} />
```

**ATENÇÃO**: ChatPanel.tsx tem 6000+ linhas. Procure pelo trecho da toolbar.

Localizar onde outros botões são renderizados:
```tsx
// Procurar por: "chat-toolbar-btn" ou "ModelPicker"
```

### 6.3 Integrar Skills no Submit
Quando o usuário enviar uma mensagem, as skills ativas devem ser passadas:

```tsx
// No submitMessage ou similar, onde o payload é construído:
// Adicionar ao payload:
{
  content: inputValue,
  engineId: selectedEngineId,
  modelId: selectedModelId,
  // ...outros campos
  skills: activeSkills.map(s => s.id), // ← adicionar skills ativas
}
```

**ATENÇÃO**: Isso pode variar dependendo de como o submit funciona. Verificar com Serena como as skills são passadas.

### 6.4 Mostrar Indicator de Skill Ativo
No ModelPicker ou composer, mostrar um badge quando há skills ativas:

```tsx
// Adicionar no ModelPicker trigger ou próximo ao model:
{activeSkills.length > 0 && (
  <span className="active-skills-indicator">
    {activeSkills.map(s => s.name).join(', ')}
  </span>
)}
```

### 6.5 Adapter no submit
Precisa verificar como o submit funciona no ChatPanel e adaptar para receber skills.

## ✅ Critérios de Verificação

1. Botão Skills aparece na toolbar
2. Painel abre ao clicar
3. Skills podem ser toggladas
4. Estado persiste entre sessões
5. Skills ativas aparecem no composer

## 📝 Commits Sugeridos
- `feat(skills): add SkillsButton to chat toolbar`
- `feat(skills): integrate active skills in composer`
- `feat(skills): show skill indicator when active`

## ⏱️ Estimativa: 4-5 horas (principalmente por causa do ChatPanel)

## ⚠️ AVISO
O ChatPanel.tsx é muito grande (6000+ linhas). Use busca com grep para encontrar o local exato:
```bash
grep -n "chat-toolbar-btn\|ModelPicker\|chat-toolbar" src/components/chat/ChatPanel.tsx | head -30
```
