# Git Hooks Setup

Zentralisierte Git-Hooks für automatisches Build und Deployment.

## Installation

### Initiales Setup auf dem Server

```bash
cd /var/apps/swarm-config
./setup-hooks.sh
```

### Automatisches Update

Wenn swarm-config als bare repository existiert, verlinke den Hook:

```bash
ln -s /var/apps/swarm-config/hooks/post-receive-swarm-config ~git/repos/swarm-config.git/hooks/post-receive
```

Oder wenn swarm-config nur als Working Directory existiert, manuell nach Updates ausführen:

```bash
cd /var/apps/swarm-config
git pull
./setup-hooks.sh
```

## Post-Receive Hook

Der Hook führt automatisch aus:

1. **Clone** des gepushten Commits in `/tmp/build-<version>`
2. **Build** des Docker-Images mit Tag `<appname>:<version>`
3. **Deploy** via `docker stack deploy` aus dem Temp-Verzeichnis
4. **Cleanup** des Temp-Verzeichnisses

## Voraussetzungen

Jedes Repository benötigt:
- `Dockerfile` im Root
- `compose.yaml` im Root

## Neue Repositories hinzufügen

Nach Erstellen eines neuen bare repositories:

```bash
cd /path/to/swarm-config
./setup-hooks.sh /var/git
```

Oder manuell:

```bash
ln -s /path/to/swarm-config/hooks/post-receive /var/git/<repo>.git/hooks/post-receive
```
