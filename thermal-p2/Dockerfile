# Official multi-architecture image digest verified 2026-10-14 with docker buildx imagetools inspect.
FROM python:3.12.10-slim-bookworm@sha256:fd95fa221297a88e1cf49c55ec1828edd7c5a428187e67b5d1805692d11588db
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MPLBACKEND=Agg
WORKDIR /work
COPY requirements-lock.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements-lock.txt
COPY . .
CMD ["python", "scripts/reproduce.py"]