FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_SQLITE_PATH=/app/data/app.sqlite \
    WORKSPACE_ROOT=/app/workspace \
    MODEL_SECRET_FILE=/app/data/model-secrets.env

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.txt
COPY backend/requirements-dev.txt backend/requirements-dev.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r backend/requirements-dev.txt
RUN python -m playwright install --with-deps chromium

COPY backend backend
COPY pytest.ini pytest.ini
COPY slides_html slides_html

RUN mkdir -p /app/data /app/workspace

EXPOSE 14242

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "14242"]
