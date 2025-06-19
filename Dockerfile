FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tor onionshare-cli \
    jq qrencode imagemagick poppler-utils \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Install npm tools for HTML/JS processing
RUN npm install -g javascript-obfuscator html-minifier-terser

# Copy VoxVera source
COPY . /opt/voxvera
ENV PYTHONPATH=/opt/voxvera

# Make voxvera command available
RUN echo '#!/bin/sh\nexec python3 -m voxvera.cli "$@"' > /usr/local/bin/voxvera \
    && chmod +x /usr/local/bin/voxvera

# Prepare flyers volume
RUN mkdir /flyers && ln -s /flyers /opt/voxvera/host
VOLUME /flyers
WORKDIR /opt/voxvera

CMD ["voxvera", "quickstart"]
