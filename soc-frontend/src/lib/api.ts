import { apiUrl } from './config';

export class ApiError extends Error {
	status: number;
	payload: unknown;
	constructor(status: number, message: string, payload: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.payload = payload;
	}
}

function stringifyPayload(payload: unknown): string {
	if (typeof payload === 'string') return payload;
	if (payload && typeof payload === 'object') {
		try {
			return JSON.stringify(payload, null, 2);
		} catch {
			return String(payload);
		}
	}
	return String(payload ?? '');
}

export function formatApiError(error: unknown): string {
	if (error instanceof ApiError) {
		const payloadText = stringifyPayload(error.payload);
		return payloadText ? `${error.message}\n\n${payloadText}` : error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

export async function fetchJson<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
	const { timeoutMs = 15000, ...requestInit } = init;
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(apiUrl(path), { ...requestInit, signal: controller.signal });
		const rawText = await response.text();
		let payload: unknown = rawText;
		if (rawText) {
			try {
				payload = JSON.parse(rawText);
			} catch {
				payload = rawText;
			}
		}
		if (!response.ok) {
			const message = (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string')
				? String((payload as { error?: string }).error)
				: `Request failed with status ${response.status}`;
			throw new ApiError(response.status, message, payload);
		}
		return payload as T;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(`Request timed out after ${timeoutMs}ms`);
		}
		throw error instanceof Error ? error : new Error(String(error));
	} finally {
		window.clearTimeout(timer);
	}
}

export async function postForm<T>(path: string, formData: FormData, timeoutMs = 60000): Promise<T> {
	return fetchJson<T>(path, { method: 'POST', body: formData, timeoutMs });
}
