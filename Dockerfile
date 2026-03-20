FROM python:3.11-slim

# Experimental container path: Linux systemd remains the supported
# persistent-host deployment target.

# Install system dependencies (only runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini tor onionshare-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy VoxVera source
COPY . /opt/voxvera
WORKDIR /opt/voxvera

# Install VoxVera and its Python dependencies
RUN pip install . \
    && chmod +x scripts/docker-entrypoint.sh scripts/docker-healthcheck.sh \
    && ln -sf /opt/voxvera/scripts/docker-entrypoint.sh /usr/local/bin/voxvera-docker-entrypoint \
    && ln -sf /opt/voxvera/scripts/docker-healthcheck.sh /usr/local/bin/voxvera-docker-healthcheck

# Prepare flyers volume
RUN mkdir /flyers
ENV VOXVERA_DIR=/flyers
ENV VOXVERA_RUNTIME=docker
VOLUME /flyers

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD ["voxvera-docker-healthcheck"]

ENTRYPOINT ["tini", "--", "voxvera-docker-entrypoint"]
CMD []
