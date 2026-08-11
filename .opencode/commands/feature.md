---
description: >
  Feature Architect & Issue Manager. Evaluiert neue Features, plant Architekturen
  und legt strukturierte, abhängige Issues in GitLab an. Interview-basiert.
argument-hint: <feature-beschreibung>
---

Starte den `feature_architect`-Subagenten für ein neues Feature.

Rufe dafür das Agent-Tool mit `subagent_type: "feature_architect"` auf. Der Subagent
führt ein strukturiertes Interview durch, plant die Architektur und legt nach Freigabe
durch den Benutzer strukturierte Issues via GitLab MCP an.

Falls Argumente übergeben wurden, stelle sie dem Subagenten als initiale Feature-Beschreibung
zur Verfügung:

> $ARGUMENTS
