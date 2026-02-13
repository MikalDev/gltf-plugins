/**
 * TypeScript wrapper for builtin models.
 * Implementation is in ../builtin-models.ts (shared with editor via globalThis).
 */

interface BuiltinModelsAPI {
	isBuiltinModelUrl(url: string): boolean;
	getBuiltinModelType(url: string): "cube" | "sphere" | null;
	getBuiltinModelArrayBuffer(type: "cube" | "sphere"): ArrayBuffer;
	getBuiltinModelDataUrl(type: "cube" | "sphere"): string;
	resolveBuiltinUrl(url: string): string;
}

// Access the shared implementation via globalThis
const g = globalThis as unknown as { GltfBundle?: { BuiltinModels?: BuiltinModelsAPI } };
const BuiltinModels = g.GltfBundle?.BuiltinModels;

export type BuiltinModelType = "cube" | "sphere";

export function isBuiltinModelUrl(url: string): boolean {
	return BuiltinModels?.isBuiltinModelUrl(url) ?? false;
}

export function getBuiltinModelType(url: string): BuiltinModelType | null {
	return BuiltinModels?.getBuiltinModelType(url) ?? null;
}

export function getBuiltinModelArrayBuffer(type: BuiltinModelType): ArrayBuffer {
	return BuiltinModels!.getBuiltinModelArrayBuffer(type);
}

export function getBuiltinModelDataUrl(type: BuiltinModelType): string {
	return BuiltinModels!.getBuiltinModelDataUrl(type);
}

export function resolveBuiltinUrl(url: string): string {
	return BuiltinModels?.resolveBuiltinUrl(url) ?? url;
}
