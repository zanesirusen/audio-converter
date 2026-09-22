FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp binary standalone (nggak butuh Python)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="/root/.deno/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files dulu (biar Docker cache dependencies)
COPY package*.json ./

# Install node dependencies
RUN npm install --production

# Copy sisa project
COPY . .

# Bikin folder downloads
RUN mkdir -p downloads

# Set port ke 7860
ENV PORT=7860
EXPOSE 7860

# Run server
CMD ["node", "server.js"]