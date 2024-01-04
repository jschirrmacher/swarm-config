# swarm-config

The setup of my docker swarm cluster. It contains

- a description to set all up
- a collection of docker-compose files to setup several services by importing them in my portainer.
- a node.js program to ease setting up Kong API gateway

The docker compose yaml files can be used in a docker swarm cluster directly, either by running something like `docker stack deploy -c kong.yaml kong` or by using the graphical UI of the "portainer" service. The latter will be described under [Setup](#setup).

The Kong API gateway controls access to the docker services in the cluster from the outside and handles TLS certificate things (requesting and renewing). The configuration is done here in a quite easy way (in comparison of setting up all by yourself). If you see something you don't understand, write an issue and I try to improve. If you have suggestions for improvements, you even could write a Pull Request!

There are some examples of service settings in [config.template.ts](config.template.ts) which might be a start to build your own setup.

## Why program code instead of YAML?

YAML is a great language to make configurations. However, when the configuration gets large and repetitive, YAML tends to get confusing. Compare a non-trivial configuration like [config.template.ts](config.template.ts) with its generated YAML version.

Furthermore, modern IDEs like Visual Studio Code prevent a lot of searching correct options and values, the functional approach brings auto-completion which eases the user's life.

## Setup

### Docker swarm cluster

First, install some required packages and update the system to the most current version:

```bash
apt update
apt upgrade -y
apt install -y fail2ban docker.io unattended-upgrades ufw gufw anacron ntp glusterfs-server rpcbind

dpkg-reconfigure -plow unattended-upgrades
-> yes

reboot
```

Then, after the reboot, log in again and set up the firewall:

```bash
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 9000
ufw enable
```

Now, setup docker swarm:

```bash
docker swarm init
```

### Create a user

You should not work as 'root' user, but should create a personalized user for yourself (and possibly others).

```bash
addgroup team

adduser <username> --ingroup team
adduser <username> sudo
adduser <username> docker
mkdir -m=0700 ~<username>/.ssh
cp ~/.ssh/authorized_keys ~<username>/.ssh/
chown <username>.team -R ~<username>/.ssh
```

After that, you can switch off password access:

```bash
sed -i 's/^PermitRootLogin yes/#PermitRootLogin yes/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication yes/#PasswordAuthentication yes/' /etc/ssh/sshd_config
echo 'PasswordAuthentication no' >>/etc/ssh/sshd_config
echo 'PermitRootLogin no' >>/etc/ssh/sshd_config
service ssh restart
```

After that, you can log in with your new username and ssh key and use `sudo` to do administrative things.

## More than one node in your cluster

A cluster makes more sense, if you have more than one node in it. Docker containers will be distributed between nodes, to distribute compute power, when updating a service, you can use rolling updates to prevent downtimes.

However, docker volumes will be only placed on the node the container is running on. When the service is scaled to more than one node, or when services are updated, the volume will be created on the next node as well, while previous data will not be available any more (but still will be available on the first node).

To circumvent this, I use GlusterFS. It is a kind of network file system, which allows access from a set of servers.

A prerequisite is to have all those server nodes in the same network and to know the nodes by name: Each node should have each other node in its `/etc/hosts` file. I number my nodes like `server-1`, `server-2` and so on and they have unique IP addresses in `10.0.0.0/24` network.

To activate GlusterFS (we already installed it at the beginning of this tutorial) we use the following commands:

```bash
sudo service glusterd start
sudo systemctl enable glusterd
sudo ufw allow from 10.0.0.0/24
sudo gluster volume create storage-vol1 transport tcp server-1:/mnt/HC_Volume_3749475/brick server-2:/mnt/HC_Volume_3749480/brick
sudo gluster volume start storage-vol1
```

`/mnt/HC_Volume_3749475/brick` is the physical storage. It can now be mounted as GlusterFS volume on each of them:

```bash
sudo mkdir /var/volumes
sudo mount -t glusterfs server-1:/storage-vol1 /var/volumes
echo 'server-1:/storage-vol1 /var/volumes glusterfs defaults,_netdev 0 0' | sudo tee -a /etc/fstab
```

The last line ensures that the volume is mounted each time the server is restarted.

If you define docker volumes on this directory, data will be shared across the nodes making it possible to run services using this data independent of the node.

### Portainer and other services

A prerequisite is to have git installed. My setup assumes that it is installed under `/var/apps`. If you want to change that, remember to change the yaml files for the docker stacks as well.

```bash
mkdir -p /var/apps
cd /var/apps
git clone https://github.com/jschirrmacher/swarm-config.git
cd swarm-config
docker stack deploy -c init.yaml init
```

After that, open <https://your-server-name-or-address:9000> to see the Portainer UI. You need to enter `agent:9001` as the 'environment address', when asked for.

### Kong

The prerequisite here is to have Node.js version 20.x installed (might work with other versions as well, but I didn't test it).

After checking out this repo, install dependencies, copy the `config.template.ts` file to `config.ts` and edit it to match your docker services.

```bash
cd /var/apps/swarm-config
npm install
cp config.template.ts config.ts
code config.ts
```

I use VS Code ("code") to edit the file, but you might want to use another editor, like vim, emacs or even pico - it's your choice.

After that, you can generate the actual Kong configuration with

```bash
npm run kong:generate
```

The result is the file `generated/kong.yaml`, which will be used by Kong, if it is setup correctly.

You can now use the Portainer UI to set up the Kong service. Under 'Stacks' use the 'Add stack' button (in the upper right), select 'Repository' and enter the URL of this repository. As the "compose path" specify `kong.yaml`.

This creates the Kong stack containing the kong API gateway and a redis instance which stores the Letsencrypt TLS certificates for your services that Kong requests for you in the background.

You can let Portainer update the stack whenever the configuration in the repository changes ('GitOps updates') if you want.

## Cleanup

After installing Portainer the same way as Kong you can drop the `init` stack and close port 9000 in the firewall:

```bash
docker stack rm init
sudo ufw delete allow 9000
```
