# Administrator Guide: Server Setup

Diese Anleitung ist für Systemadministratoren, die einen neuen Server mit Docker Swarm und Kong Gateway aufsetzen möchten.

## Übersicht

Das System besteht aus:

- **Docker Swarm** - Container-Orchestrierung
- **Kong Gateway** - API Gateway mit automatischem SSL/TLS
- **Swarm Config UI** - Web UI für Repository- und Service-Management
- **Git-basierte CI/CD** - Automatisches Deployment

## Voraussetzungen

- Ubuntu/Debian Server mit Root-Zugriff
- Mindestens 2 GB RAM

## Schnellstart

### Schritt 1: Initiales Setup (automatisiert)

Verwenden Sie das automatisierte Setup-Skript, um alle Basis-Komponenten zu installieren:

```bash
# Direkter Download und Ausführung
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/next/scripts/setup.sh | sudo bash -s your-domain.com
```

Das Skript führt folgende Schritte automatisch aus:

- ✅ System-Updates
- ✅ Git-Installation
- ✅ Docker & Docker Swarm Installation und Initialisierung
- ✅ UFW Firewall Konfiguration (Ports 22, 80, 443, 9000)
- ✅ Node.js 24 LTS via NodeSource
- ✅ Workspace `/var/apps` erstellen
- ✅ Repository klonen
- ✅ npm Dependencies installieren
- ✅ Team-Benutzer erstellen (basierend auf SSH authorized_keys)
- ✅ SSH-Sicherheit konfigurieren (deaktiviert Root-Login und Password-Auth)
- ✅ Kong Network erstellen
- ✅ Kong Stack deployen
- ✅ Web UI bauen und deployen

**Hinweis:** Das setup.sh Skript:

- Fragt interaktiv nach Ihrer Domain und erstellt die `.swarm-config` Datei
- Erstellt das Kong Network (`kong-net`)
- Generiert die Kong-Konfiguration und deployt den Kong Stack automatisch
- Baut und deployt die Web UI für Repository-Management
- Fragt optional nach GlusterFS Installation (für Multi-Node Cluster)

Nach dem Setup sind Kong und die Web UI bereits einsatzbereit!

### Schritt 2: Web UI für Self-Service Repository-Management

Die Web UI wurde automatisch durch das setup.sh Skript installiert und ist verfügbar unter:

**`https://config.your-domain.com`**

Entwickler können dort Self-Service Repositories erstellen, ohne SSH-Zugriff oder Admin-Rechte zu benötigen.

#### Web UI manuell neu deployen (falls nötig)

Falls die Web UI neu gebaut werden muss:

```bash
cd /var/apps/swarm-config

# Web UI neu bauen
docker build -t swarm-config-ui:latest -f web-ui/Dockerfile .

# Stack neu deployen
export DOMAIN=your-domain.com
docker stack deploy -c web-ui/docker-compose.yml swarm-config-ui

# Kong-Config neu generieren
npm run kong:generate
```

### Schritt 3: Weitere Services konfigurieren (Optional)

Sie können weitere optionale Services konfigurieren:

#### Kong-Konfiguration anpassen (Optional)

### Kong YAML generieren

```bash
npm run kong:generate
```

### Swarm Config Stack deployen

Der komplette Stack (Kong, Redis, UI) wird über Docker Compose deployt:

```bash
cd /var/apps/swarm-config
docker stack deploy -c .swarm/docker-compose.yaml swarm-config
```

**Wichtig:** Dieser Befehl wird automatisch vom setup.sh Skript ausgeführt.

## Wartung

### Kong-Konfiguration aktualisieren

Nach Änderungen in `config/`:

```bash
cd /var/apps/swarm-config
npm run kong:generate
```

Kong lädt die Konfiguration automatisch neu.

### Git Repository für neue App einrichten

**Primär:** Verwenden Sie die Web UI unter `https://config.your-domain.com`

**Alternativ (Command Line):**

```bash
cd /var/apps/swarm-config
# Use the Web UI at https://config.yourdomain.com
# Or use the API directly
```

Details siehe [APP-DEVELOPER.md](./APP-DEVELOPER.md)

### Logs überprüfen

```bash
# Kong Logs
docker service logs -f swarm-config_kong

# UI Logs
docker service logs -f swarm-config_ui

# Redis Logs
docker service logs -f swarm-config_redis

# Alle Services eines Stacks
docker stack ps swarm-config
```

### Updates durchführen

```bash
cd /var/apps/swarm-config
git pull
npm install
npm run kong:generate
```

## Troubleshooting

### Kong startet nicht

```bash
# Kong-Konfiguration validieren
docker exec $(docker ps -q -f name=kong) kong config parse /config/kong.yaml

# Logs prüfen
docker service logs kong_kong
```

### Service ist nicht erreichbar

```bash
# Kong-Routen prüfen
docker e-Netzwerk prüfen
docker network ls
docker network inspect kong-net
```

## Multi-Node Cluster (Optional)

Für Multi-Node Cluster mit verteiltem Storage via GlusterFS siehe die ausführliche Anleitung:

**→ [Multi-Node Cluster Setup](./MULTI-NODE-SETUP.md)**

Das setup.sh Skript fragt während der Installation, ob GlusterFS installiert werden soll.

Die Konfiguration des Clusters muss manuell erfolgen (siehe MULTI-NODE-SETUP.md).

### Multi-Node Cluster: GlusterFS

Voraussetzung: Alle Server kennen sich mit Namen (in `/etc/hosts` eintragen).

```bash
# GlusterFS aktivieren
sudo service glusterd start
sudo systemctl enable glusterd

# Firewall für Cluster-Netzwerk öffnen (z.B. 10.0.0.0/24)
sudo ufw allow from 10.0.0.0/24

# Volume erstellen (auf einem Node)
sudo gluster volume create storage-vol1 transport tcp \
  server-1:/mnt/HC_Volume_3749475/brick \
  server-2:/mnt/HC_Volume_3749480/brick
sudo gluster volume start storage-vol1

# Volume auf allen Nodes mounten
sudo mkdir /var/volumes
sudo mount -t glusterfs server-1:/storage-vol1 /var/volumes
echo 'server-1:/storage-vol1 /var/volumes glusterfs defaults,_netdev 0 0' | sudo tee -a /etc/fstab
```

## Sicherheit

### Best Practices

1. **SSH**: Nur Key-basierte Authentifizierung
2. **Firewall**: Nur notwendige Ports öffnen (wird durch setup.sh eingerichtet)
3. **SSL/TLS**: Kong ACME Plugin für automatische Zertifikate
4. **Secrets**: Nie in Git committen, nur in `/var/apps/<app>/.env`

### Wichtige Verzeichnisse

```
/var/apps/                      # App-Daten und .env Dateien
/home/<user>/<repo>.git/        # Bare Git Repositories in User Home
/var/volumes/                   # GlusterFS Mount (bei Multi-Node)
/var/apps/swarm-config/         # Zentrale Konfiguration
```

## Weitere Ressourcen

- [APP-DEVELOPER.md](./APP-DEVELOPER.md) - Für App-Entwickler
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Für swarm-config Entwickler
- [Kong Dokumentation](https://docs.konghq.com/)
- [Docker Swarm Dokumentation](https://docs.docker.com/engine/swarm/)
- [MULTI-NODE-SETUP.md](./MULTI-NODE-SETUP.md) - Multi-Node Cluster mit GlusterFS
