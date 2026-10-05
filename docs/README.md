# API-Kontrakt

`Fawkes-OpenApi.json` ist eine **vendorierte Kopie** (kein Submodule mehr) der OpenAPI-Spec aus dem
Backend-Repo — die Single Source of Truth für den API-Kontrakt zwischen diesem Frontend und dem
C#-Backend „Fawkes".

- **Quelle:** https://github.com/Hyabusa1990/BSApp-ArchScore-Backend/blob/main/Fawkes-OpenApi.json
- **Übernommen von Commit:** `d7b5696fc79004cbd9b3a2981a9c03859cb47750` (2026-08-31) — unverändert
  aktuellster Commit auf `main`, der `Fawkes-OpenApi.json` berührt (Stand 2026-09-28 geprüft).
- **Aktueller Stand (2026-10-05):** vom offiziellen Docker-Release des Backends übernommen
  (`ghcr.io/hyabusa1990/bsapp-archscore-backend:latest`, Image-Revision
  `84fe229783d833ea508e8d72e330bf1d4d2e04a3`, `GET /swagger/v1/swagger.json` gegen eine lokal per
  `docker-compose.yml` hochgezogene Instanz). Die Backend-Commits dieses Tages
  (`19abb9ea` „Added missing implementations to Dos Controller" u. a.) berühren
  `Fawkes-OpenApi.json` im Repo nicht — die Datei auf `main` ist weiterhin auf dem Stand von
  2026-08-31, der Vertrag ist also weiter als der öffentliche Commit-Stand. Sobald ein passender
  Commit auf `main` existiert, hier wieder auf den GitHub-Commit-Hash umstellen. Änderungen ggü.
  2026-09-28: `UpdateSetScoreRequest` nur noch `{score: int?}` (`confirmed` entfernt),
  `TargetInformation.setScores` ist `int?[]`. Die Datei ist mit Tab-Einrückung aus dem
  Swagger-JSON neu serialisiert (gleiches Format wie vorher, kleiner Diff).

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
