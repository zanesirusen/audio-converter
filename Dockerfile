FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    python3-minimal \
    && rm -rf /var/lib/apt/lists/*

# ⚡ FIX: Bikin symlink python -> python3
# yt-dlp-exec postinstall nyari 'python', bukan 'python3'
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="/root/.deno/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files dulu
COPY package*.json ./

# Install node dependencies
RUN npm install --production

# Copy sisa project
COPY . .

# Bikin folder downloads
RUN mkdir -p downloads

# Set port
ENV PORT=3000
EXPOSE 3000

# Run server
CMD ["node", "server.js"]