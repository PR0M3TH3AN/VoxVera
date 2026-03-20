# Docker Usage

Experimental: the container path is not yet a production-grade hidden-service deployment target. Linux with `systemd --user` remains the supported persistent-host environment.

A prebuilt image containing Tor, OnionShare and the `voxvera` CLI is published to
`ghcr.io/voxvera/voxvera`.

```bash
# pull the image
docker pull ghcr.io/voxvera/voxvera:latest

# run the experimental container with flyers stored in ./flyers
mkdir -p flyers
docker run -d \
  --name voxvera \
  --restart unless-stopped \
  -v "$(pwd)/flyers:/flyers" \
  ghcr.io/voxvera/voxvera:latest
```

The container now uses a dedicated entrypoint that:
- stores runtime state under `/flyers`
- seeds `/flyers/config.json` if needed
- starts an in-container Tor daemon on `127.0.0.1:9050/9051`
- bootstraps a default site when `/flyers/host` is empty
- runs `voxvera start-all` on startup and retries it periodically
- exposes a container healthcheck based on `voxvera doctor --json`

Useful commands:

```bash
docker logs -f voxvera
docker exec -it voxvera voxvera doctor --json
docker exec -it voxvera voxvera autostart status --json
```

If you prefer Compose:

```yaml
services:
  voxvera:
    image: ghcr.io/voxvera/voxvera:latest
    restart: unless-stopped
    volumes:
      - ./flyers:/flyers
```

Use this path for testing only until the container runtime and background recovery behavior are validated end-to-end.
