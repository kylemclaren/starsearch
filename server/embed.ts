import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers"

env.cacheDir = new URL("../data/models", import.meta.url).pathname

export const EMBED_MODEL = "Xenova/bge-small-en-v1.5"
export const DIMS = 384
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

let extractor: Promise<FeatureExtractionPipeline> | undefined
function model() {
  extractor ??= pipeline("feature-extraction", EMBED_MODEL, { dtype: "fp32" }) as Promise<FeatureExtractionPipeline>
  return extractor
}

// One embedding job at a time keeps a second indexing run from starving searches.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => {})
  return run
}

export async function embedDocuments(texts: string[], onProgress?: (done: number) => void): Promise<Float32Array> {
  const fe = await model()
  const out = new Float32Array(texts.length * DIMS)
  // Sorting by length keeps each batch's padding small, which roughly halves the time.
  const order = texts.map((t, i) => ({ t: t.slice(0, 320), i })).sort((a, b) => a.t.length - b.t.length)
  const batch = 64
  for (let s = 0; s < order.length; s += batch) {
    const slice = order.slice(s, s + batch)
    const t = await serial(() => fe(slice.map((x) => x.t), { pooling: "cls", normalize: true }))
    const data = t.data as Float32Array
    slice.forEach((x, j) => out.set(data.subarray(j * DIMS, (j + 1) * DIMS), x.i * DIMS))
    onProgress?.(Math.min(s + batch, order.length))
  }
  return out
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const fe = await model()
  const t = await fe(QUERY_PREFIX + text, { pooling: "cls", normalize: true })
  return t.data as Float32Array
}

/** Warm the model at boot so the first index doesn't pay the load. */
export function warm() {
  return model()
}
