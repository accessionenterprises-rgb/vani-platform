FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project files
COPY pyproject.toml .
COPY main.py .
COPY app/ app/
COPY static/ static/

# Install dependencies (no dev extras)
RUN uv pip install --system \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" \
    "supabase>=2.9" "pydantic>=2.9" "pydantic-settings>=2.5" \
    "python-multipart>=0.0.12" "pypdf>=4.3" \
    "python-dotenv" "structlog>=24.4" "httpx>=0.27" \
    "python-jose[cryptography]" "bcrypt>=4.0" \
    "twilio>=9.0"

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
