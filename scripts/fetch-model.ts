// Bakes the embedding model into the Docker image so cold starts never download it.
import { warm } from "../server/embed"
await warm()
console.log("model cached")
