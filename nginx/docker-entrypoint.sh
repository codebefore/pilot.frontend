#!/bin/sh
set -eu

: "${PILOT_FRONTEND_PUBLIC_URL:=}"
: "${VITE_API_BASE_URL:=/api}"

envsubst '${PILOT_FRONTEND_PUBLIC_URL} ${VITE_API_BASE_URL}' \
  < /usr/share/nginx/html/env-config.template.json \
  > /usr/share/nginx/html/env-config.json
