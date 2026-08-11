---
description: Security-Review aller Code-Änderungen seit dem letzten Security-Review (kein manuelles Angeben von Dateien nötig).
---

Starte einen vollständigen Sicherheits-Review über den `security-reviewer`-Subagenten.

Rufe dafür das Agent-Tool mit `subagent_type: "security-reviewer"` auf. Der Subagent
ermittelt selbstständig:

- den Diff-Bereich seit dem letzten Review (lokaler Git-Tag `security-reviewed`,
  Fallback: Merge-Base zu `main`)
- alle uncommitted Änderungen

und erstellt anschließend den vollständigen Sicherheitsbericht im vorgegebenen Format,
inkl. Issue-Erstellung/-Kommentierung auf GitLab bei KRITISCH/HOCH-Funden.

Gib den Bericht des Subagenten anschließend vollständig an den Nutzer weiter.
