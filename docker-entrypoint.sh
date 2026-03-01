#!/bin/sh
set -eu

DATA_DIR="/app/data"
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"

mkdir -p "${DATA_DIR}/logos"

if [ "$(id -u)" = "0" ]; then
  # Ensure bind-mounted data path is writable by the app user.
  chown -R "${APP_UID}:${APP_GID}" "${DATA_DIR}"
  exec su-exec "${APP_UID}:${APP_GID}" "$@"
fi

exec "$@"
