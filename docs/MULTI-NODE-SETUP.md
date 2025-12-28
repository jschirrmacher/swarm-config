# Multi-Node Cluster Setup mit GlusterFS

Diese Anleitung beschreibt, wie Sie einen Docker Swarm Cluster mit mehreren Nodes und verteiltem Storage via GlusterFS einrichten.

## Warum Multi-Node?

Ein Cluster mit mehreren Nodes bietet:
- **Lastverteilung** - Docker Container werden über Nodes verteilt
- **Hochverfügbarkeit** - Bei Ausfall eines Nodes laufen Services auf anderen Nodes weiter
- **Rolling Updates** - Kein Downtime bei Service-Updates
- **Verteilter Storage** - Daten sind auf allen Nodes verfügbar

## Voraussetzungen

- Mindestens 2 Server mit Docker Swarm
- Alle Server im gleichen Netzwerk (z.B. 10.0.0.0/24)
- SSH-Zugriff auf alle Server
- Root-Rechte auf allen Servern

## Schritt 1: Hostnamen konfigurieren

Alle Server müssen sich gegenseitig mit Namen kennen. Tragen Sie auf **jedem Server** alle anderen Server in `/etc/hosts` ein:

```bash
# Beispiel /etc/hosts
10.0.0.1  server-1
10.0.0.2  server-2
10.0.0.3  server-3
```

Testen Sie die Namensauflösung:
```bash
ping server-2
```

## Schritt 2: Docker Swarm Cluster erstellen

### Auf dem ersten Node (Manager):

```bash
docker swarm init --advertise-addr 10.0.0.1
```

Dies gibt einen Join-Token aus, z.B.:
```
docker swarm join --token SWMTKN-1-xxxx... 10.0.0.1:2377
```

### Auf allen weiteren Nodes (Workers):

```bash
docker swarm join --token SWMTKN-1-xxxx... 10.0.0.1:2377
```

### Cluster-Status prüfen (auf Manager):

```bash
docker node ls
```

## Schritt 3: GlusterFS installieren

Auf **allen Nodes**:

```bash
# Installation
sudo apt update
sudo apt install -y glusterfs-server

# Service starten und aktivieren
sudo systemctl enable glusterd
sudo systemctl start glusterd

# Firewall öffnen für GlusterFS
sudo ufw allow from 10.0.0.0/24
```

## Schritt 4: GlusterFS Volume erstellen

### Peers verbinden (auf server-1):

```bash
sudo gluster peer probe server-2
sudo gluster peer probe server-3
# Wiederholen für alle weiteren Nodes

# Status prüfen
sudo gluster peer status
```

### Storage Verzeichnis erstellen (auf allen Nodes):

```bash
# Passe den Pfad an deinen Storage an
sudo mkdir -p /mnt/storage/brick
```

### Volume erstellen (auf server-1):

```bash
sudo gluster volume create storage-vol1 transport tcp \
  server-1:/mnt/storage/brick \
  server-2:/mnt/storage/brick \
  server-3:/mnt/storage/brick

sudo gluster volume start storage-vol1
```

### Volume-Status prüfen:

```bash
sudo gluster volume info storage-vol1
sudo gluster volume status storage-vol1
```

## Schritt 5: Volume mounten

Auf **allen Nodes**:

```bash
# Mount-Verzeichnis erstellen
sudo mkdir -p /var/volumes

# Volume mounten
sudo mount -t glusterfs server-1:/storage-vol1 /var/volumes

# Automatisches Mounten beim Boot
echo 'server-1:/storage-vol1 /var/volumes glusterfs defaults,_netdev 0 0' | sudo tee -a /etc/fstab
```

### Mount testen:

```bash
# Auf server-1
echo "Test from server-1" | sudo tee /var/volumes/test.txt

# Auf server-2
cat /var/volumes/test.txt
# Sollte ausgeben: Test from server-1
```

## Schritt 6: Docker Volumes auf GlusterFS

Docker Volumes können jetzt auf GlusterFS erstellt werden:

```yaml
# In docker-compose.yml oder Stack-Definition
volumes:
  app-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/volumes/myapp-data
```

## Wartung

### GlusterFS Status prüfen

```bash
# Peer-Status
sudo gluster peer status

# Volume-Status
sudo gluster volume status storage-vol1

# Volume-Info
sudo gluster volume info storage-vol1
```

### Node zum Cluster hinzufügen

```bash
# Auf Manager-Node
sudo gluster peer probe server-4

# Volume erweitern
sudo gluster volume add-brick storage-vol1 server-4:/mnt/storage/brick

# Rebalance (verteilt Daten auf neuen Brick)
sudo gluster volume rebalance storage-vol1 start
```

### Brick reparieren (bei Ausfall)

```bash
# Brick ersetzen
sudo gluster volume replace-brick storage-vol1 \
  server-2:/mnt/storage/brick \
  server-2:/mnt/storage/brick-new \
  commit force

# Heal starten
sudo gluster volume heal storage-vol1
```

## Troubleshooting

### Volume lässt sich nicht mounten

```bash
# GlusterFS Service prüfen
sudo systemctl status glusterd

# Logs prüfen
sudo tail -f /var/log/glusterfs/glusterd.log

# Mount-Befehl mit Debug
sudo mount -t glusterfs -o log-level=DEBUG server-1:/storage-vol1 /var/volumes
```

### Peers nicht verbunden

```bash
# Firewall prüfen
sudo ufw status

# Gluster-Ports (24007-24010, 49152-49156)
sudo ufw allow from 10.0.0.0/24 to any port 24007:24010
sudo ufw allow from 10.0.0.0/24 to any port 49152:49156

# Peer-Verbindung neu aufbauen
sudo gluster peer detach server-2
sudo gluster peer probe server-2
```

### Split-Brain (Datenkonflikte)

```bash
# Split-Brain erkennen
sudo gluster volume heal storage-vol1 info split-brain

# Split-Brain beheben (manuell)
sudo gluster volume heal storage-vol1 split-brain latest-mtime /path/to/file

# Oder: Source-Brick definieren
sudo gluster volume heal storage-vol1 split-brain source-brick server-1:/mnt/storage/brick /path/to/file
```

## Performance-Optimierung

### Tuning-Optionen

```bash
# Performance-Profile aktivieren
sudo gluster volume set storage-vol1 performance.cache-size 256MB
sudo gluster volume set storage-vol1 performance.io-thread-count 32
sudo gluster volume set storage-vol1 performance.write-behind on
sudo gluster volume set storage-vol1 performance.read-ahead on

# Netzwerk-Optimierung
sudo gluster volume set storage-vol1 network.ping-timeout 10
```

## Sicherheit

### Access Control

```bash
# Zugriff nur von bestimmten IPs
sudo gluster volume set storage-vol1 auth.allow 10.0.0.*

# SSL/TLS aktivieren
sudo gluster volume set storage-vol1 client.ssl on
sudo gluster volume set storage-vol1 server.ssl on
```

## Weitere Ressourcen

- [ADMIN-SETUP.md](./ADMIN-SETUP.md) - Haupt-Setup-Anleitung
- [GlusterFS Dokumentation](https://docs.gluster.org/)
- [Docker Swarm Dokumentation](https://docs.docker.com/engine/swarm/)
