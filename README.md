# Stargaze

Natural-language search over anyone's public GitHub stars.

1. **Fetch** – the visitor's browser pulls `/users/<login>/starred` from GitHub's unauthenticated REST API (100 per request, 6 at a time), so every visitor spends their own 60 requests an hour.
2. **Verify + embed** – the server re-fetches the newest page once (unauthenticated) to check the upload, then embeds every repo locally with `bge-small-en-v1.5` and caches the index in `data/users/`.
3. **Search** – MiniSearch keyword + embedding cosine, fused with reciprocal rank fusion → top 30 → one TypeSafe Jev request (a noul per repo + a choice over all) re-ranks them. Results stream as NDJSON: `hybrid`, then `jev`.

```sh
bun install
bun run build   # Vite → dist/
bun run start   # Bun server on $PORT (8080)
```

`TYPESAFE_API_URL` / `TYPESAFE_API_KEY` configure Jev; `scripts/start.sh` points at the sprite gateway.
