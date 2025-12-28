# Administrator Guide: Server Setup

Diese Anleitung ist für Systemadministratoren, die einen neuen Server mit Docker Swarm und Kong Gateway aufsetzen möchten.

## Übersicht

Das System besteht aus:
- **Docker Swarm** - Container-Orchestrierung
- **Kong Gateway** - API Gateway mit automatischem SSL/TLS
- **Portainer** - Web UI für Container-Management
- **Prometheus + Grafana** - Monitoring
- **Git-basierte CI/CD** - Automatisches Deployment

## Voraussetzungen

- Ubuntu/Debian Server mit Root-Zugriff
- Mindestens 2 GB RAM

## Schnellstart

### Schritt 1: Initiales Setup (automatisiert)

Verwenden Sie das automatisierte Setup-Skript, um alle Basis-Komponenten zu installieren:

```bash
# Direkter Download und Ausführung
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/next/scripts/initial-setup.sh | sudo bash
```

Das Skript führt folgende Schritte automatisch aus:
- ✅ System-Updates
- ✅ Git-Installation
- ✅ Node.js 24 LTS via nvm
- ✅ Workspace `/var/apps` erstellen
- ✅ Repository klonen
- ✅ `.swarm-config` Beispiel kopieren
- ✅ npm Dependencies installieren

**Alternative (manuell):** Falls Sie die Schritte einzeln durchführen möchten, siehe Abschnitt "Manuelle Installation" am Ende dieses Dokuments.

### Schritt 2: Konfiguration anpassen

Nach dem initialen Setup müssen Sie Ihre Domain-Einstellungen anpassen:

```bash
cd /var/apps/swarm-config
sudo nano .swarm-config
```

**Wichtig:** Passen Sie in `.swarm-config` Ihre Domain an:
- `DOMAIN=` - Ihre Hauptdomain (z.B. `example.com`)
- `SERVER_HOST=` - Ihr Server-Hostname (z.B. `server.example.com`)

### Schritt 3: Bootstrap-Skript ausführen

Das Bootstrap-Skript prüft und richtet automatisch ein:
- ✅ Docker & Docker Swarm
- ✅ UFW Firewall (Ports 22, 80, 443, 9000)
- ✅ Node.js Installation
- ✅ Team-Benutzer (basierend auf SSH-Keys)
- ✅ SSH-Sicherheit (deaktiviert Root-Login und Password-Auth)
- ✅ Kong Network (`kong-net`)
- ✅ GlusterFS (wenn konfiguriert)

```bash
cd /var/apps/swarm-config
sudo npm run bootstrap:fix
```

### Nur Prüfung (ohne automatische Korrektur)

```bash
npm run bootstrap
```

## Kong Gateway konfigurieren

Das Bootstrap-Skript erstellt automatisch das Kong Network. Falls es manuell erstellt werden muss:

```bash
docker network create --scope=swarm --attachable -d overlay kong-net
```

### Kong-Konfiguration anpassen

```bash
cd /var/apps/swarm-config

# Beispiel-Konfigurationen kopieren und anpassen
cp config/plugins/acme.ts.example config/plugins/acme.ts
cp config/plugins/prometheus.ts.example config/plugins/prometheus.ts
cp config/infrastructure/acme.ts.example config/infrastructure/acme.ts
cp config/infrastructure/portainer.ts.example config/infrastructure/portainer.ts

# E-Mail-Adresse für Let's Encrypt anpassen
nano config/plugins/acme.ts
# Domains anpassen
nano config/infrastructure/portainer.ts
```

### Kong YAML generieren

```bash
npm run kong:generate
```

### Kong Stack deployen

In Portainer:
1. "Stacks" → "Add stack"
2. "Repository" auswählen
3. Repository URL: `https://github.com/jschirrmacher/swarm-config.git`
4. Compose path: `config/stacks/kong.yaml`
5. "Deploy the stack" klicken

Optional: "GitOps updates" aktivieren für automatische Updates.

## Portainer (Optional)

Portainer ist ein Web-UI für Container-Management und **optional**.

### Installation

```bash
# Mit Bootstrap
npm run bootstrap:fix  # Installiert Portainer wenn gewünscht

# Oder manuell
docker stack deploy -c config/stacks/init.yaml init
```

### Zugriff

Nach der Installation ist Portainer verfügbar unter: `https://your-server:9000`

**Wichtig:** Bei erster Anmeldung als "Environment Address" eingeben: `agent:9001`

### Stacks über Portainer deployen

Mit Portainer können Sie Stacks komfortabel über die Web-UI deployen:
1. "Stacks" → "Add stack"
2. "Repository" auswählen
3. Repository URL eingeben
4. Compose path angeben
5. Optional: "GitOps updates" aktivieren

## Monitoring deployen (Optional)

```bash
# Monitoring-Konfiguration anpassen
cp config/infrastructure/monitoring.ts.example config/infrastructure/monitoring.ts
nano config/infrastructure/monitoring.ts

# Kong-Config neu generieren
npm run kong:generate

# In Portainer monitoring.yaml als Stack deployen
```

## Wartung

### Kong-Konfiguration aktualisieren

Nach Änderungen in `config/`:

```bash
cd /var/apps/swarm-config
npm run kong:generate
```

Kong lädt die Konfiguration automatisch neu.

### Git Repository für neue App einrichten

```bash
cd /var/apps/swarm-config
npm run init-repo myapp
```

Details siehe [APP-DEVELOPER.md](./APP-DEVELOPER.md)

### Logs überprüfen

```bash
# Kong Logs
docker service logs -f kong_kong

# Portainer Logs
docker service logs -f init_portainer

# Alle Services eines Stacks
docker stack ps myapp
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

### Portainer reagiert nicht

```bash
# Portainer neu starten
docker service update --force init_portainer

# Logs prüfen
docker service logs init_portainer
```

## Manuelle Schritte (nur wenn Bootstrap fehlschlägt)

Falls das Bootstrap-Skript Probleme meldet, können diese manuell behoben werden:

### Docker und Basis-Pakete installieren

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y docker.io git curl

# Docker Swarm initialisieren
sudo docker swarm init
```

### Node.js installieren

```bash
# Via nvm (empfohlen)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24
```

### Firewall konfigurieren

```bash
sudo ufw allow ssh
sudo ufw allow http
sudoAutomatische Sicherheitsupdates

```bash
sudo apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# -> yes auswählen
```

## Multi-Node Cluster (Optional)

Für Multi-Node Cluster mit verteiltem Storage via GlusterFS siehe die ausführliche Anleitung:

**→ [Multi-Node Cluster Setup](./MULTI-NODE-SETUP.md)**

Das Bootstrap-Skript kann GlusterFS optional installieren:
```bash
npm run bootstrap:fix  # Installiert GlusterFS wenn gewünscht
```

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

### Automatische Sicherheitsupdates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# -> yes auswählen
```

## Sicherheit

### Best Practices

1. **SSH**: Nur Key-basierte Authentifizierung
2. **Firewall**: Nur notwendige Ports öffnen (wird durch Bootstrap eingerichtet)
3. **Updates**: Automatische Sicherheitsupdates aktivieren (siehe oben)
4. **SSL/TLS**: Kong ACME Plugin für automatische Zertifikate
5. **Secrets**: Nie in Git committen, nur in `/var/apps/<app>/.env`
6. **Monitoring**: Prometheus Alerts konfigurieren

### Wichtige Verzeichnisse

```
/var/apps/                      # App-Daten und .env Dateien
/opt/git/                       # Bare Git Repositories
/var/volumes/                   # GlusterFS Mount (bei Multi-Node)
/var/apps/swarm-config/         # Zentrale Konfiguration
```

## Manuelle Installation

Falls Sie die Installation lieber Schritt für Schritt manuell durchführen möchten:

### Git und Node.js installieren

```bash
# System aktualisieren
sudo apt update
sudo apt upgrade -y

# Git installieren
sudo apt install -y git curl

# Node.js (aktuelle LTS) installieren via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24

# Node.js Version prüfen
node --version  # Sollte v24.x.x anzeigen
```

### Repository klonen

```bash
# Arbeitsverzeichnis erstellen
sudo mkdir -p /var/apps
cd /var/apps

# Repository klonen
sudo git clone https://github.com/jschirrmacher/swarm-config.git
cd swarm-config

# Konfiguration einrichten
  echo "DOMAIN=your-domain.com" | sudo tee .swarm-config
  sudo nano .swarm-config  # Domain anpassen
Danach weiter mit Schritt 3 des Schnellstarts (Bootstrap-Skript ausführen).

## Weitere Ressourcen

- [APP-DEVELOPER.md](./APP-DEVELOPER.md) - Für App-Entwickler
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Für swarm-config Entwickler
- [Kong Dokumentation](https://docs.konghq.com/)
- [Docker Swarm Dokumentation](https://docs.docker.com/engine/swarm/)
- [MULTI-NODE-SETUP.md](./MULTI-NODE-SETUP.md) - Multi-Node Cluster mit GlusterFS