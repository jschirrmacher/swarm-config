# Git Hooks Setup

Zentralisierte Git-Hooks für automatisches Build und Deployment.

## Installation

### Initiales Setup auf dem Server

```bash
cd /path/to/swarm-config
./setup-hooks.sh /var/git
```

### Automatisches Update

Verlinke den swarm-config Hook im swarm-config Repository selbst:

```bash
ln -s /path/to/swarm-config/hooks/post-receive-swarm-config /var/git/swarm-config.git/hooks/post-receive
```

Danach werden bei jedem `git push` zum swarm-config automatisch alle Projekt-Hooks aktualisiert.

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
