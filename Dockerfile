FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (buat binary system — dipake buat fallback)
RUN pip3 install --no-cache-dir -U yt-dlp

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

# Set port ke 7860 (default Hugging Face Spaces)
ENV PORT=7860
EXPOSE 7860

# Run server
CMD ["node", "server.js"]