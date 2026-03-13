# Docker Usage

A prebuilt image containing Tor, OnionShare and the `voxvera` CLI is published to
`ghcr.io/voxvera/voxvera`.

```bash
# pull the image
docker pull ghcr.io/voxvera/voxvera:latest

# run voxvera quickstart with flyers stored in ./flyers
mkdir -p flyers
docker run -it --rm -v "$(pwd)/flyers:/flyers" ghcr.io/voxvera/voxvera
```

The container uses `/flyers` as the working directory and runs `voxvera quickstart`
by default. All generated flyer files will appear in the mounted `flyers` folder.
