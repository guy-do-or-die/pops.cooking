# Use a deterministic base image
FROM python:3.11-slim-bookworm

# Install system dependencies for OpenCV and audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port for the API
EXPOSE 8000

# Command to run the service
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
