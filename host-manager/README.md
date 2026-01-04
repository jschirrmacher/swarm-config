# Host Manager Service

Minimaler HTTP-Service für die Ausführung von System-Updates auf dem Docker Host.

## Sicherheitskonzept

- Läuft in isoliertem `admin-net` Netzwerk
- Nur von UI-Container erreichbar
- Token-basierte Authentifizierung
- Führt Setup-Script in privilegiertem Container mit chroot aus

## Konfiguration

### Umgebungsvariablen

- `HOST_MANAGER_TOKEN`: Authentifizierungs-Token (erforderlich für Produktion)
- `SETUP_SCRIPT`: Pfad zum Setup-Script (Standard: `/app/scripts/setup.sh`)

### Token-Generierung

```bash
# Sicheres Token generieren
openssl rand -hex 32
```

## Endpoints

### GET /health

Health-Check Endpoint (keine Authentifizierung erforderlich)

**Response:**

```json
{
  "status": "ok",
  "service": "host-manager"
}
```

### POST /update

Führt das System-Update aus (Authentifizierung erforderlich)

**Headers:**

```
Authorization: Bearer <token>
```

**Response (Erfolg):**

```json
{
  "success": true,
  "message": "System update completed successfully",
  "output": "..."
}
```

**Response (Fehler):**

```json
{
  "success": false,
  "error": "Setup script failed with exit code 1",
  "output": "..."
}
```

## Verwendung in Nuxt

```typescript
const response = await $fetch("http://host-manager:3001/update", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
  },
})
```

## Entwicklung

```bash
cd host-manager
npm install
npm run dev
```

## Docker Build

```bash
docker build -t host-manager:latest .
```
