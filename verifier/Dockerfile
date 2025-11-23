# Use a deterministic base image
FROM python:3.11-slim-bookworm

# Install system dependencies for OpenCV, audio processing, and Node.js
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python verifier
COPY verifier/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY verifier/ .

# Copy and install Node.js uploader
COPY uploader/ /app/uploader
WORKDIR /app/uploader
RUN npm install --production

# Back to main workdir
WORKDIR /app

# Expose port for verifier only (uploader accessible via localhost internally)
EXPOSE 8000

# Start both services
# Use a simple shell script to run both
RUN echo '#!/bin/bash\n\
cd /app/uploader && node server.js &\n\
cd /app && uvicorn server:app --host 0.0.0.0 --port 8000\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
