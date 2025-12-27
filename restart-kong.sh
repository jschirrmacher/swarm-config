#!/bin/bash

KONG=$(docker ps --format "{{.Names}}" | grep _kong.1)
npx tsx src/generate-kong-config.ts
docker exec -it $KONG kong config parse config/kong.yaml
if [ $? = 0 ]; then
  docker exec -it $KONG kong reload
fi
