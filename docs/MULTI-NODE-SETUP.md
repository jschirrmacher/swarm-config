# Multi-Node Cluster Setup with GlusterFS

This guide describes how to set up a Docker Swarm cluster with multiple nodes and distributed storage via GlusterFS.

## Why Multi-Node?

A cluster with multiple nodes offers:

- **Load balancing** - Docker containers are distributed across nodes
- **High availability** - If one node fails, services continue running on other nodes
- **Rolling updates** - No downtime during service updates
- **Distributed storage** - Data is available on all nodes

## Prerequisites

- At least 2 servers with Docker Swarm
- All servers in the same network (e.g. 10.0.0.0/24)
- SSH access to all servers
- Root privileges on all servers

## Step 1: Configure Hostnames

All servers must know each other by name. On **each server**, add all other servers to `/etc/hosts`:

```bash
# Example /etc/hosts
10.0.0.1  server-1
10.0.0.2  server-2
10.0.0.3  server-3
```

Test name resolution:

```bash
ping server-2
```

## Step 2: Create Docker Swarm Cluster

### On the first node (manager):

```bash
docker swarm init --advertise-addr 10.0.0.1
```

This outputs a join token, e.g.:

```
docker swarm join --token SWMTKN-1-xxxx... 10.0.0.1:2377
```

### On all other nodes (workers):

```bash
docker swarm join --token SWMTKN-1-xxxx... 10.0.0.1:2377
```

### Check cluster status (on manager):

```bash
docker node ls
```

## Step 3: Install GlusterFS

On **all nodes**:

```bash
# Installation
sudo apt update
sudo apt install -y glusterfs-server

# Start and enable service
sudo systemctl enable glusterd
sudo systemctl start glusterd

# Open firewall for GlusterFS
sudo ufw allow from 10.0.0.0/24
```

## Step 4: Create GlusterFS Volume

### Connect peers (on server-1):

```bash
sudo gluster peer probe server-2
sudo gluster peer probe server-3
# Repeat for all other nodes

# Check status
sudo gluster peer status
```

### Create storage directory (on all nodes):

```bash
# Adjust path to your storage
sudo mkdir -p /mnt/storage/brick
```

### Create volume (on server-1):

```bash
sudo gluster volume create storage-vol1 transport tcp \
  server-1:/mnt/storage/brick \
  server-2:/mnt/storage/brick \
  server-3:/mnt/storage/brick

sudo gluster volume start storage-vol1
```

### Check volume status:

```bash
sudo gluster volume info storage-vol1
sudo gluster volume status storage-vol1
```

## Step 5: Mount Volume

On **all nodes**:

```bash
# Create mount directory
sudo mkdir -p /var/volumes

# Mount volume
sudo mount -t glusterfs server-1:/storage-vol1 /var/volumes

# Automatic mounting on boot
echo 'server-1:/storage-vol1 /var/volumes glusterfs defaults,_netdev 0 0' | sudo tee -a /etc/fstab
```

### Test mount:

```bash
# On server-1
echo "Test from server-1" | sudo tee /var/volumes/test.txt

# On server-2
cat /var/volumes/test.txt
# Should output: Test from server-1
```

## Step 6: Docker Volumes on GlusterFS

Docker volumes can now be created on GlusterFS:

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

## Maintenance

### Check GlusterFS Status

```bash
# Peer status
sudo gluster peer status

# Volume status
sudo gluster volume status storage-vol1

# Volume info
sudo gluster volume info storage-vol1
```

### Add Node to Cluster

```bash
# On manager node
sudo gluster peer probe server-4

# Expand volume
sudo gluster volume add-brick storage-vol1 server-4:/mnt/storage/brick

# Rebalance (distributes data to new brick)
sudo gluster volume rebalance storage-vol1 start
```

### Repair Brick (on failure)

```bash
# Replace brick
sudo gluster volume replace-brick storage-vol1 \
  server-2:/mnt/storage/brick \
  server-2:/mnt/storage/brick-new \
  commit force

# Start heal
sudo gluster volume heal storage-vol1
```

## Troubleshooting

### Volume won't mount

```bash
# Check GlusterFS service
sudo systemctl status glusterd

# Check logs
sudo tail -f /var/log/glusterfs/glusterd.log

# Mount command with debug
sudo mount -t glusterfs -o log-level=DEBUG server-1:/storage-vol1 /var/volumes
```

### Peers not connected

```bash
# Check firewall
sudo ufw status

# Gluster ports (24007-24010, 49152-49156)
sudo ufw allow from 10.0.0.0/24 to any port 24007:24010
sudo ufw allow from 10.0.0.0/24 to any port 49152:49156

# Rebuild peer connection
sudo gluster peer detach server-2
sudo gluster peer probe server-2
```

### Split-Brain (data conflicts)

```bash
# Detect split-brain
sudo gluster volume heal storage-vol1 info split-brain

# Resolve split-brain (manually)
sudo gluster volume heal storage-vol1 split-brain latest-mtime /path/to/file

# Or: Define source brick
sudo gluster volume heal storage-vol1 split-brain source-brick server-1:/mnt/storage/brick /path/to/file
```

## Performance Optimization

### Tuning Options

```bash
# Enable performance profile
sudo gluster volume set storage-vol1 performance.cache-size 256MB
sudo gluster volume set storage-vol1 performance.io-thread-count 32
sudo gluster volume set storage-vol1 performance.write-behind on
sudo gluster volume set storage-vol1 performance.read-ahead on

# Network optimization
sudo gluster volume set storage-vol1 network.ping-timeout 10
```

## Security

### Access Control

```bash
# Access only from specific IPs
sudo gluster volume set storage-vol1 auth.allow 10.0.0.*

# Enable SSL/TLS
sudo gluster volume set storage-vol1 client.ssl on
sudo gluster volume set storage-vol1 server.ssl on
```

## Additional Resources

- [ADMIN-SETUP.md](./ADMIN-SETUP.md) - Main setup guide
- [GlusterFS Documentation](https://docs.gluster.org/)
- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
