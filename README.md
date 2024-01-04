# swarm-config

The setup of my docker swarm cluster.

- a collection of docker-compose files to setup several services by importing them in my portainer.
- a node.js program to ease setting up Kong API gateway

The docker compose yaml files can be used in a docker swarm cluster directly, either by running something like `docker stack deploy -c kong.yaml kong` or by using the graphical UI of the "portainer" service (which needs to be installed via `docker stack deploy -c init.yaml init` first, though).

The Kong API gateway controls access to the docker services in the cluster from the outside and handles TLS certificate things (requesting and renewing). The configuration is done here in a quite easy way (in comparison of setting up all by yourself). If you see something you don't understand, write an issue and I try to improve. If you have suggestions for improvements, you even could write a Pull Request!

There are some examples of service settings in [config.template.ts](config.template.ts) which might be a start to build your own setup.

## Setup

A prerequisite is to have git and Node.js version 20.x installed (might work with other versions as well, but I didn't test it). My setup assumes that it is installed under `/var/apps`. If you want to change that, remember to change the yaml files for the docker stacks as well.

After checking out this repo, install dependencies, copy the `config.template.ts` file to `config.ts` and edit it to match your docker services.

```bash
mkdir -p /var/apps
cd /var/apps
git clone https://github.com/jschirrmacher/swarm-config.git
cd swarm-config
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

## Why program code instead of YAML?

YAML is a great language to make configurations. However, when the configuration gets large and repetitive, YAML tends to get confusing. Compare a non-trivial configuration like [config.template.ts](config.template.ts) with its generated YAML version.

Furthermore, modern IDEs like Visual Studio Code prevent a lot of searching correct options and values, the functional approach brings auto-completion which eases the user's life.
