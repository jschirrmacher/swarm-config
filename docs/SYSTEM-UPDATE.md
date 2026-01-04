# System Update Feature

Dieses Feature ermöglicht es authentifizierten Benutzern, über die Web-Oberfläche ein System-Update durchzuführen, das das `setup.sh`-Script auf dem Docker Host ausführt.

## Architektur

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTPS (JWT Auth)
         ↓
┌─────────────────┐
│  UI Container   │──────────┐
│  (Nuxt/Vue)     │          │ admin-net (isoliert)
└────────┬────────┘          │
         │                   │
         │ HTTP (Token)      │
         ↓                   │
┌─────────────────┐          │
│  host-manager   │──────────┘
│   (Express)     │
└────────┬────────┘
         │ Docker Socket
         ↓
┌─────────────────┐
│ Privileged      │
│ Container       │──> chroot /host /path/to/setup.sh
└─────────────────┘
```

## Sicherheit

1. **Netzwerk-Isolation**: Der `host-manager` läuft in einem separaten `admin-net`, auf das nur der UI-Container Zugriff hat
2. **Doppelte Authentifizierung**:
   - Web UI: JWT-basierte Authentifizierung
   - host-manager: Eigener Token (`HOST_MANAGER_TOKEN`)
3. **Docker Socket**: Nur `host-manager` hat Zugriff auf den Docker Socket
4. **Privilegierte Ausführung**: Setup-Script wird in isoliertem, privilegiertem Container mit chroot ausgeführt

## Installation

### Automatische Installation (empfohlen)

Das Setup-Script richtet automatisch alles ein, inkl. host-manager und Token:

```bash
# Erstinstallation oder Update
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

Das Script:

- Erstellt automatisch ein Docker Secret (Swarm) oder .env Datei (Compose)
- Baut beide Docker Images (UI + host-manager)
- Deployed den kompletten Stack

### Manuelle Installation

Falls du das Token manuell verwalten möchtest:

### 1. Token generieren und als Docker Secret anlegen

**Für Production (empfohlen - Docker Swarm):**

```bash
# Token generieren und als Docker Secret anlegen
openssl rand -hex 32 | docker secret create host_manager_token -

# Überprüfen
docker secret ls
```

**Für Development (mit .env Datei):**

```bash
# Token generieren
openssl rand -hex 32 > .token.tmp

# In .env Datei speichern
echo "HOST_MANAGER_TOKEN=$(cat .token.tmp)" >> .env

# Temporäre Datei löschen
rm .token.tmp
```

**Für Development (mit Umgebungsvariable):**

```bash
export HOST_MANAGER_TOKEN=$(openssl rand -hex 32)
```

### 2. host-manager Image bauen

```bash
cd host-manager
docker build -t host-manager:latest .
```

### 3. Services deployen

**Mit Docker Stack (Production - verwendet Secrets):**

```bash
docker stack deploy -c compose.yaml swarm-config
```

**Mit Docker Compose (Development - verwendet .env oder Environment):**

```bash
docker compose up -d
```

> **Wichtig:** Bei Docker Stack werden automatisch die Docker Secrets verwendet. Bei Docker Compose wird die `.env` Datei oder die Umgebungsvariable `HOST_MANAGER_TOKEN` verwendet.

## Verwendung

### Über die Web-Oberfläche

1. In die Web-Oberfläche einloggen
2. Im Header auf den "System Update" Button klicken
3. Bestätigen
4. Warten auf die Ausführung (kann mehrere Minuten dauern)
5. Live-Logs verfolgen

**Hinweis:** Nach einem erfolgreichen Update werden die Services neu gestartet. Dies führt zu einem kurzen Verbindungsabbruch. Die Seite muss anschließend neu geladen werden.

### Über die API

```bash
# Token aus localStorage oder JWT erhalten
curl -X POST https://your-domain.com/api/system/update \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Monitoring

### Logs des host-manager anzeigen

```bash
docker service logs swarm-config_host-manager
```

### Logs des UI-Containers

````bash
docker service logs swarm-config_ui
**Bei Docker Stack:**
```bash
# Secret überprüfen
docker secret ls | grep host_manager_token

# Wenn nicht vorhanden, erstellen
openssl rand -hex 32 | docker secret create host_manager_token -

# Stack neu deployen
docker stack deploy -c compose.yaml swarm-config
````

**Bei Docker Compose:**

```bash
# .env Datei überprüfen
cat .env | grep HOST_MANAGER_TOKEN

# Oder Umgebungsvariable setzen
export HOST_MANAGER_TOKEN=$(openssl rand -hex 32)
```

### "Authentication with host-manager failed"

Die Token stimmen nicht überein.

**Bei Docker Stack:**

```bash
# Secret neu erstellen
docker secret rm host_manager_token
openssl rand -hex 32 | docker secret create host_manager_token -
docker stack deploy -c compose.yaml swarm-config
```

**Bei Docker Compose:**
Stelle sicher, dass beide Services die gleiche `.env` Datei verwenden oder die gleiche Umgebungsvariable gesetzt ist

Der Token ist nicht gesetzt. Stelle sicher, dass die Umgebungsvariable bei beiden Services gesetzt ist.

### "Authentication with host-manager failed"

Die Token stimmen nicht überein. Überprüfe, dass beide Services den gleichen Token verwenden.

### "Kong container not found" oder ähnliche Fehler

Das Setup-Script schlägt fehl. Prüfe die Logs des privilegierten Containers:

```bash
docker service logs swarm-config_host-manager --tail 100
```

### Timeout-Fehler

Das Setup-Script braucht länger als 5 Minuten. Passe den Timeout in [server/api/system/update.post.ts](../server/api/system/update.post.ts) an:

```typescript
timeout: 600000, // 10 Minuten
```

## Entwicklung

### Lokale Entwicklung des host-manager

```bash
cd host-manager
npm install
export HOST_MANAGER_TOKEN="dev-token"
npm run dev
```

### Test-Request

```bash
curl -X POST http://localhost:3001/update \
  -H "Authorization: Bearer dev-token"
```

## Sicherheitsüberlegungen

### Was NICHT getan werden sollte:

- ❌ `host-manager` im `kong-net` laufen lassen (andere Container könnten darauf zugreifen)
- ❌ Token im Code hart codieren
- ❌ Setup-Script direkt aus dem Container heraus ausführen (keine sudo-Rechte)
- ❌ Docker Socket ohne Isolation mounten

### Best Practices:

- ✅ Separates `admin-net` Netzwerk verwenden
- ✅ Starke, zufällige Token verwenden
- ✅ Token als Umgebungsvariablen oder Secrets verwalten
- ✅ Logs aller Update-Versuche aufbewahren
- ✅ Privilegierte Container-Ausführung mit chroot

## Erweiterungen

### Rate Limiting hinzufügen

Implementiere Rate Limiting im `host-manager`, um Missbrauch zu verhindern:

```javascript
import rateLimit from "express-rate-limit"

const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 3, // Max 3 Updates pro 15 Minuten
})

app.post("/update", authenticate, updateLimiter, async (req, res) => {
  // ...
})
```

### Webhook-Benachrichtigungen

Sende Benachrichtigungen bei erfolgreichen oder fehlgeschlagenen Updates:

```javascript
await fetch("https://hooks.slack.com/...", {
  method: "POST",
  body: JSON.stringify({
    text: `System update completed: ${response.success ? "✅" : "❌"}`,
  }),
})
```

### Rollback-Funktion

Implementiere eine Rollback-Funktion, die die letzte bekannte gute Konfiguration wiederherstellt.
