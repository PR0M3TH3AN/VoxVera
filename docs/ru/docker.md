# Docker Usage

Experimental: the container path is not yet a production-grade hidden-service deployment target. Linux with `systemd --user` remains the supported persistent-host environment.

A prebuilt image containing Tor, OnionShare and the `voxvera` CLI is published to
`ghcr.io/voxvera/voxvera`.

```bash
# pull the image
docker pull ghcr.io/voxvera/voxvera:latest

# run the experimental container with flyers stored in ./flyers
mkdir -p flyers
docker run -it --rm -v "$(pwd)/flyers:/flyers" ghcr.io/voxvera/voxvera
```

The container stores runtime state under `/flyers`, seeds a default `config.json` if needed, and retries `voxvera start-all` periodically after the initial `quickstart`.

Use this path for testing only until the container runtime and background recovery behavior are validated end-to-end.
