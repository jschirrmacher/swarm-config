#!/bin/bash

KONG=$(docker ps --format "{{.Names}}" | grep kong_kong.1)
docker exec -it $KONG kong config parse config/kong.yaml
if [ $? = 0 ]; then
  docker exec -it $KONG kong reload
fi
