# Host-Manager Setup Migration Plan

## Ziel

Der Host-Manager wird zur zentralen Stelle für alle Host-Operationen, einschließlich Setup-Schritte. Das initiale Setup-Skript wird minimal gehalten und startet nur den Host-Manager, alle weiteren Schritte laufen über definierte Commands.

## Vorteile

1. **Einheitliche Schnittstelle:** Alle Host-Operationen an einer Stelle
2. **Wiederholbar:** Setup-Schritte einzeln neu ausführbar
3. **UI-Integration:** User kann fehlgeschlagene Schritte nachträglich aus dem UI ausführen
4. **Testbar:** Commands können isoliert getestet werden
5. **Versioniert:** Setup-Logik im Git, nicht in Bash-Skripten verstreut
6. **Idempotent:** Jeder Command prüft Zustand und führt nur nötige Änderungen durch

## Architektur

### Minimales Setup-Skript

Das initiale `setup.sh` wird reduziert auf:

1. **Docker installieren** (falls nicht vorhanden)
2. **Docker Swarm initialisieren** (falls nicht initialisiert)
3. **Host-Manager Container starten**
4. **Setup-Sequence triggern** via `POST /setup/run`

### Host-Manager Commands

Alle Setup-Schritte werden zu Commands:

```
host-manager/
  commands/
    setup/
      00-configureSecurityUpdates.ts
      01-getDomain.ts
      02-installDocker.ts          # Für nachträgliche Updates
      03-installFirewall.ts
      04-createUsers.ts
      05-configureSsh.ts
      06-createNetwork.ts
      07-setupHostManagerToken.ts
      08-deployKong.ts
      09-installGlusterFs.ts
      10-prepareApps.ts
      index.ts                      # Setup-Command Registry
```

### API Endpoints

#### `GET /setup/steps`

Liste aller verfügbaren Setup-Schritte mit Status:

```json
{
  "steps": [
    {
      "id": "00-configure-security-updates",
      "name": "Configure Security Updates",
      "description": "Enable automatic security updates",
      "status": "completed",
      "lastRun": "2026-01-10T10:30:00Z",
      "result": "success"
    },
    {
      "id": "01-get-domain",
      "name": "Configure Domain",
      "description": "Set up domain name",
      "status": "pending",
      "lastRun": null,
      "result": null
    }
  ]
}
```

#### `POST /setup/run`

Führt Setup-Schritte aus (alle oder ausgewählte):

```json
{
  "steps": ["01-get-domain", "03-install-firewall"], // optional, sonst alle
  "force": false // optional, überspringt Status-Check
}
```

Streaming Response (SSE):

```
event: step-start
data: {"step": "01-get-domain", "name": "Configure Domain"}

event: log
data: {"step": "01-get-domain", "message": "Checking current domain..."}

event: step-complete
data: {"step": "01-get-domain", "status": "success"}

event: complete
data: {"total": 2, "succeeded": 2, "failed": 0}
```

#### `POST /setup/step/:id`

Führt einzelnen Setup-Schritt aus:

```json
{
  "force": false // optional
}
```

## Migration Path

### Phase 1: Command Infrastructure

1. **Setup-Command Framework** erstellen
   - [ ] `host-manager/lib/defineSetupCommand.ts` - Spezielle Variante für Setup-Commands
   - [ ] Status-Tracking System (welche Steps wurden ausgeführt)
   - [ ] Setup-Command Registry

2. **State Management**
   - [ ] `/var/lib/host-manager/setup-state.json` für Step-Status
   - [ ] Idempotenz-Checks in jedem Command

### Phase 2: Command Migration

Schritte aus `scripts/steps/*.ts` nach `host-manager/commands/setup/*.ts` migrieren:

1. **Einfache Commands zuerst:**
   - [ ] `00-configure-security-updates.ts` - APT unattended-upgrades
   - [ ] `01-get-domain.ts` - Domain in /etc/hostname
   - [ ] `06-create-network.ts` - Docker network erstellen

2. **Mittlere Komplexität:**
   - [ ] `03-install-firewall.ts` - UFW konfigurieren
   - [ ] `04-create-users.ts` - System-User anlegen
   - [ ] `10-prepare-apps.ts` - /var/apps Struktur

3. **Komplexe Commands:**
   - [ ] `05-configure-ssh.ts` - SSH-Konfiguration, Keys
   - [ ] `07-setup-host-manager-token.ts` - Secret Management
   - [ ] `08-deploy-kong.ts` - Stack deployment
   - [ ] `09-install-glusterfs.ts` - GlusterFS Setup

### Phase 3: Setup-Skript Vereinfachung

1. **Minimales setup.sh**
   - [ ] Docker-Installation behalten (kann nicht vom Container aus laufen)
   - [ ] Host-Manager Start
   - [ ] REST der Logik entfernen → API-Calls

2. **Setup-Script als Command**
   - [ ] `host-manager/commands/setup/02-install-docker.ts` - Für Updates/Multi-Node

### Phase 4: UI Integration

1. **Setup-Seite** (`pages/setup/index.vue`)
   - [ ] Liste aller Setup-Schritte mit Status
   - [ ] "Run All" Button
   - [ ] "Run Step" Button pro Schritt
   - [ ] Live-Log-Anzeige (SSE)

2. **System-Status-Anzeige**
   - [ ] Setup-Completion-Status im Dashboard
   - [ ] Warnung bei fehlgeschlagenen Steps

### Phase 5: Testing & Documentation

1. **Tests**
   - [ ] Unit-Tests für jeden Setup-Command
   - [ ] Integration-Tests für Setup-Sequence
   - [ ] Idempotenz-Tests (mehrfaches Ausführen)

2. **Dokumentation**
   - [ ] README für Host-Manager Commands
   - [ ] ADMIN-SETUP.md updaten
   - [ ] Multi-Node Setup Dokumentation

## Command Structure

Beispiel-Command:

```typescript
import { defineSetupCommand } from "../lib/defineSetupCommand"
import { executeOnHost } from "../lib/execute"

export default defineSetupCommand({
  id: "03-install-firewall",
  name: "Install Firewall",
  description: "Configure UFW firewall with required rules",

  async check() {
    // Prüfen ob bereits konfiguriert
    const result = await executeOnHost("ufw status")
    return result.stdout.includes("Status: active")
  },

  async execute() {
    // Installation und Konfiguration
    yield "Installing UFW..."
    await executeOnHost("apt-get install -y ufw")

    yield "Configuring rules..."
    await executeOnHost("ufw allow 22/tcp")
    await executeOnHost("ufw allow 80/tcp")
    await executeOnHost("ufw allow 443/tcp")

    yield "Enabling firewall..."
    await executeOnHost("ufw --force enable")

    return { success: true }
  },
})
```

## State Management

Setup-State in `/var/lib/host-manager/setup-state.json`:

```json
{
  "steps": {
    "00-configure-security-updates": {
      "status": "completed",
      "lastRun": "2026-01-10T10:30:00Z",
      "result": "success",
      "logs": []
    },
    "01-get-domain": {
      "status": "pending",
      "lastRun": null,
      "result": null,
      "logs": []
    }
  }
}
```

## Rollout Strategy

1. **Parallel Development:** Neue Commands parallel zu bestehenden Scripts entwickeln
2. **Testing:** Neue Commands auf Test-System validieren
3. **Migration:** Setup.sh erweitern mit Fallback-Logik
4. **Deprecation:** Alte Scripts als deprecated markieren
5. **Removal:** Nach erfolgreicher Migration alte Scripts entfernen

## Open Questions

1. **Docker Installation:** Bleibt im Setup-Skript oder auch als Command?
   - Entscheidung: Bleibt im Setup-Skript, da Host-Manager selbst Docker braucht
   - Zusätzlich als Command für Updates/Multi-Node

2. **State Storage:** Wo wird der Setup-State gespeichert?
   - Entscheidung: `/var/lib/host-manager/setup-state.json` auf Host
   - Alternativ: In Docker Volume, aber dann nicht persistent bei Container-Neustart

3. **Fehlgeschlagene Steps:** Automatisch wiederholen oder manuell triggern?
   - Entscheidung: Manuell über UI, mit "Retry" Button

4. **Multi-Node Setup:** Wie werden andere Nodes initialisiert?
   - Entscheidung: Host-Manager auf jedem Node, zentrale Orchestrierung über UI

## Timeline

- **Phase 1:** 1-2 Tage - Infrastructure
- **Phase 2:** 3-5 Tage - Command Migration
- **Phase 3:** 1 Tag - Setup-Skript
- **Phase 4:** 2-3 Tage - UI Integration
- **Phase 5:** 2 Tage - Testing & Docs

**Total:** ~2 Wochen

## Success Criteria

- [ ] Minimales setup.sh (< 100 Zeilen)
- [ ] Alle Setup-Schritte als Commands
- [ ] UI zur Setup-Verwaltung
- [ ] Idempotente Commands
- [ ] Tests für alle Commands
- [ ] Dokumentation aktualisiert
- [ ] Multi-Node Setup funktioniert
