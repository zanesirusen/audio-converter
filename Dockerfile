FROM node:20-slim

# Install system dependencies
# NOTE: python3-minimal dibutuhin sama yt-dlp-exec postinstall
# TAPI jangan install pip — bikin error PEP 668
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    python3-minimal \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="/root/.deno/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files dulu
COPY package*.json ./

# Install node dependencies (yt-dlp-exec bakal auto-download binary-nya)
RUN npm install --production

# Copy sisa project
COPY . .

# Bikin folder downloads
RUN mkdir -p downloads

# Set port
ENV PORT=7860
EXPOSE 7860

# Run server
CMD ["node", "server.js"]