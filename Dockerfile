FROM python:3.11-slim

# Experimental container path: Linux systemd remains the supported
# persistent-host deployment target.

# Install system dependencies (only runtime)
RUN apt-get update && apt-get install -y \
    tor onionshare-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy VoxVera source
COPY . /opt/voxvera
WORKDIR /opt/voxvera

# Install VoxVera and its Python dependencies
RUN pip install .

# Prepare flyers volume
RUN mkdir /flyers
ENV VOXVERA_DIR=/flyers
VOLUME /flyers

# Seed a default config when the volume is empty, then retry startup periodically.
CMD ["sh", "-lc", "mkdir -p /flyers && if [ ! -f /flyers/config.json ]; then cp /opt/voxvera/voxvera/src/config.json /flyers/config.json; fi && voxvera quickstart --non-interactive && while true; do sleep 300; voxvera start-all || true; done"]
