import sharp from 'sharp'

/**
 * Image validation + sanitization for uploaded scan photos.
 *
 * Defends against:
 * - Oversized payloads (memory exhaustion)
 * - Invalid/non-image files (crashes the VLM pipeline)
 * - EXIF metadata (GPS coordinates, device serial numbers — privacy leak)
 * - Unexpected MIME types
 *
 * Returns a clean JPEG data URL safe to pass to the VLM and store.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_DIMENSION = 1920 // resize if larger than this on either side
const MIN_DIMENSION = 128 // reject tiny images (likely not a real product)
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

export interface ValidatedImage {
  dataUrl: string
  base64: string
  mimeType: string
  width: number
  height: number
  sizeBytes: number
}

export class ImageValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message)
  }
}

/**
 * Parse, validate, and sanitize an image from a data URL or raw base64 string.
 * Strips all EXIF metadata, normalizes to JPEG, resizes if too large.
 */
export async function validateAndSanitizeImage(
  input: string,
  fallbackMime?: string
): Promise<ValidatedImage> {
  // Extract base64 + MIME from data URL or raw base64.
  let rawBase64: string
  let declaredMime: string | undefined

  const dataUrlMatch = input.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (dataUrlMatch) {
    declaredMime = dataUrlMatch[1]
    rawBase64 = dataUrlMatch[2]
  } else {
    rawBase64 = input
    declaredMime = fallbackMime
  }

  // Size check (decoded base64 is ~4/3 the encoded length).
  const decodedSize = Math.ceil(rawBase64.length * 0.75)
  if (decodedSize > MAX_FILE_BYTES) {
    throw new ImageValidationError(
      `Image is too large (${(decodedSize / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
      'FILE_TOO_LARGE'
    )
  }

  // Decode to a buffer.
  let buffer: Buffer
  try {
    buffer = Buffer.from(rawBase64, 'base64')
  } catch {
    throw new ImageValidationError('Could not decode the image data.', 'DECODE_FAILED')
  }

  // Verify it's actually a valid image using sharp's metadata detection.
  let metadata: sharp.Metadata
  try {
    metadata = await sharp(buffer).metadata()
  } catch {
    throw new ImageValidationError(
      'The file is not a valid image or is corrupted.',
      'INVALID_IMAGE'
    )
  }

  if (!metadata.format || !metadata.width || !metadata.height) {
    throw new ImageValidationError('The image has no readable dimensions.', 'NO_DIMENSIONS')
  }

  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    throw new ImageValidationError(
      `Image is too small (${metadata.width}x${metadata.height}). Minimum is ${MIN_DIMENSION}px on each side.`,
      'IMAGE_TOO_SMALL'
    )
  }

  // Reject if the declared MIME doesn't match a supported format.
  if (declaredMime && !ALLOWED_MIMES.includes(declaredMime)) {
    throw new ImageValidationError(
      `Unsupported image type: ${declaredMime}. Supported: JPEG, PNG, WebP, GIF, BMP.`,
      'UNSUPPORTED_MIME'
    )
  }

  // Sanitize: strip EXIF, resize if too large, normalize to JPEG.
  let pipeline = sharp(buffer, {
    // Fail on images that would consume excessive memory.
    failOn: 'truncated',
  }).rotate() // auto-orient from EXIF (then strip the EXIF in the next step)

  // Resize if either dimension exceeds MAX_DIMENSION (preserve aspect ratio).
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Output as JPEG with quality 85 — strips all EXIF/metadata by default.
  const sanitizedBuffer = await pipeline
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()

  const finalMeta = await sharp(sanitizedBuffer).metadata()

  const sanitizedBase64 = sanitizedBuffer.toString('base64')
  const sanitizedDataUrl = `data:image/jpeg;base64,${sanitizedBase64}`

  return {
    dataUrl: sanitizedDataUrl,
    base64: sanitizedBase64,
    mimeType: 'image/jpeg',
    width: finalMeta.width ?? metadata.width,
    height: finalMeta.height ?? metadata.height,
    sizeBytes: sanitizedBuffer.length,
  }
}
