FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project files
COPY pyproject.toml .
COPY main.py .
COPY app/ app/

# Install dependencies (no dev extras)
RUN uv pip install --system "pydantic[email]" fastapi "uvicorn[standard]" \
    supabase pydantic-settings "python-jose[cryptography]" \
    python-multipart pypdf python-dotenv structlog

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
