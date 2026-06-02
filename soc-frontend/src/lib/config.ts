interface ImportMetaEnv {
	readonly VITE_API_ORIGIN?: string
	readonly VITE_MINIO_ORIGIN?: string
	readonly VITE_WS_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined) ?? 'http://localhost:3001'
const MINIO_ORIGIN = (import.meta.env.VITE_MINIO_ORIGIN as string | undefined) ?? 'http://localhost:9000'

const apiOriginNormalized = API_ORIGIN.replace(/\/+$/, '')
const minioOriginNormalized = MINIO_ORIGIN.replace(/\/+$/, '')

export const API_BASE = `${apiOriginNormalized}/api`
export const WS_URL =
	(import.meta.env.VITE_WS_URL as string | undefined) ??
	`${apiOriginNormalized.replace(/^http/i, 'ws')}/ws/events`
export const MINIO_BASE = minioOriginNormalized

export function apiUrl(path: string): string {
	return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function minioUrl(path: string): string {
	return `${MINIO_BASE}/${path.replace(/^\/+/, '')}`
}

export function artifactDownloadUrl(objectName: string): string {
    return `${MINIO_BASE}/stegnar-artifacts/${objectName.replace(/^\/+/, '')}`
}