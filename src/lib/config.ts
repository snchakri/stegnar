const API_ORIGIN   = (import.meta.env.VITE_API_ORIGIN   as string | undefined) ?? 'http://localhost:3001'
const MINIO_ORIGIN = (import.meta.env.VITE_MINIO_ORIGIN as string | undefined) ?? 'http://localhost:9000'

const apiOriginNormalized   = API_ORIGIN.replace(/\/+$/, '')
const minioOriginNormalized = MINIO_ORIGIN.replace(/\/+$/, '')

export const API_BASE  = `${apiOriginNormalized}/api`
export const WS_URL    =
	(import.meta.env.VITE_WS_URL as string | undefined) ??
	`${apiOriginNormalized.replace(/^http/i, 'ws')}/ws/events`
export const MINIO_BASE = minioOriginNormalized

export function apiUrl(path: string): string {
	return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function minioUrl(path: string): string {
	return `${MINIO_BASE}/${path.replace(/^\/+/, '')}`
}

/**
 * Given an s3:// URI, return an API-proxied presigned URL.
 * Falls back to the artifact proxy endpoint if no minio URL is resolvable.
 *
 * e.g. "s3://stegnar-artifacts/foo_bar.jpg"
 *   → "http://localhost:3001/api/artifact-url?uri=s3://stegnar-artifacts/foo_bar.jpg"
 *
 * The frontend calls this to get a working HTTP URL for preview and download.
 */
export function artifactApiUrl(s3Uri: string): string {
	if (!s3Uri || !s3Uri.startsWith('s3://')) return ''
	return `${API_BASE}/artifact-url?uri=${encodeURIComponent(s3Uri)}`
}

/**
 * Parse s3://bucket/key and return the proxy download URL
 * (streams the file through the API server with Content-Disposition: attachment).
 */
export function artifactDownloadUrl(s3Uri: string): string {
	if (!s3Uri || !s3Uri.startsWith('s3://')) return ''
	const parts  = s3Uri.slice(5).split('/', 2)
	const bucket = parts[0]
	const key    = s3Uri.slice(5 + bucket.length + 1)
	return `${API_BASE}/artifacts/${bucket}/${key}/download`
}

/**
 * Parse s3://bucket/key and return the redirect presigned URL endpoint.
 */
export function artifactRedirectUrl(s3Uri: string): string {
	if (!s3Uri || !s3Uri.startsWith('s3://')) return ''
	const bucket = s3Uri.slice(5).split('/', 1)[0]
	const key    = s3Uri.slice(5 + bucket.length + 1)
	return `${API_BASE}/artifacts/${bucket}/${key}`
}