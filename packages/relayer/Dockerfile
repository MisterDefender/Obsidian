# ─── Build stage ──────────────────────────────────────────────────────────────
# Compile the release binary. We cache dependencies in their own layer so code
# changes don't re-download/rebuild the whole dependency tree every time.
FROM rust:1-slim AS builder
WORKDIR /app

# `cc` is needed to build ring (the crypto behind rustls).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 1) Build just the dependencies against a dummy main (cached unless Cargo.* change).
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

# 2) Build the real binary.
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ─── Runtime stage ────────────────────────────────────────────────────────────
# A slim image with just CA certificates (for outbound HTTPS to the RPC) and the
# compiled binary. No Rust toolchain, no source — small and lower attack surface.
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/obsidian-relayer /usr/local/bin/obsidian-relayer

ENV BIND_ADDR=0.0.0.0 \
    PORT=8080
EXPOSE 8080

CMD ["obsidian-relayer"]
