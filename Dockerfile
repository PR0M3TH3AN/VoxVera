FROM python:3.11-slim

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
RUN mkdir /flyers && ln -s /flyers /opt/voxvera/host
VOLUME /flyers

# VoxVera expects to run in /opt/voxvera for local assets
WORKDIR /opt/voxvera

CMD ["voxvera", "quickstart"]
