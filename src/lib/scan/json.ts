/**
 * Robustly extract a JSON object from an LLM/VLM response that may wrap it
 * in markdown fences or include leading/trailing prose.
 */
export function extractJson<T = unknown>(raw: string): T {
  if (!raw) throw new Error('Empty response from model')
  const trimmed = raw.trim()

  // Direct parse fast path.
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // fall through
  }

  // Strip markdown fences ```json ... ``` or ``` ... ```.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T
    } catch {
      // fall through
    }
  }

  // Grab the first {...} block in the text.
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    try {
      return JSON.parse(slice) as T
    } catch {
      // fall through
    }
  }

  throw new Error('Could not parse JSON from model response')
}
