# API-Kontrakt

`Fawkes-OpenApi.json` ist eine **vendorierte Kopie** (kein Submodule mehr) der OpenAPI-Spec aus dem
Backend-Repo — die Single Source of Truth für den API-Kontrakt zwischen diesem Frontend und dem
C#-Backend „Fawkes".

- **Quelle:** https://github.com/Hyabusa1990/BSApp-ArchScore-Backend/blob/main/Fawkes-OpenApi.json
- **Übernommen von Commit:** `d7b5696fc79004cbd9b3a2981a9c03859cb47750` (2026-08-31)

Das frühere `ArchScore-SpecsAndDocu`-Submodule (separates Repo mit `openapi.yaml`) ist entfernt —
diese Datei existiert im Backend-Repo nicht mehr, `Fawkes-OpenApi.json` ist die einzige verbleibende
Spec-Quelle.

**Aktualisieren:** Datei manuell neu herunterladen, wenn sich der Kontrakt geändert hat:

```bash
curl -sL https://raw.githubusercontent.com/Hyabusa1990/BSApp-ArchScore-Backend/main/Fawkes-OpenApi.json \
  -o docs/Fawkes-OpenApi.json
```

Es gibt keine Automatik (kein Submodule-Pinning mehr) — die Datei kann also vom tatsächlichen Stand
des Backend-Repos abweichen, wenn sie nicht manuell nachgezogen wird.
