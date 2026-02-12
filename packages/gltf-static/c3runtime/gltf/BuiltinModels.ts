/**
 * Built-in primitive models (cube and sphere) embedded as glTF JSON strings.
 * Models are 10x10x10 units with per-face vertex colors (no texture needed).
 */

// Face colors (subtle tints) - RGBA [0-1]
const FACE_COLORS = {
	posX: [1.0, 0.98, 0.95, 1.0],
	negX: [0.95, 0.98, 1.0, 1.0],
	posY: [1.0, 1.0, 1.0, 1.0],
	negY: [0.95, 0.95, 0.95, 1.0],
	posZ: [0.98, 1.0, 0.95, 1.0],
	negZ: [0.95, 0.97, 1.0, 1.0],
};

interface MeshData {
	positions: number[];
	normals: number[];
	texCoords: number[];
	colors: number[];
	indices: number[];
}

function generateCubeData(): MeshData {
	const half = 5;
	const segments = 3; // 3x3 grid per face = 9 quads = 18 triangles (9x original for smooth vertex lighting)
	const positions: number[] = [];
	const normals: number[] = [];
	const texCoords: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];

	// Each face defined by: normal, tangent (u-axis), bitangent (v-axis), and color
	const faces: Array<{
		normal: [number, number, number];
		tangent: [number, number, number];
		bitangent: [number, number, number];
		colorKey: keyof typeof FACE_COLORS;
	}> = [
		{ normal: [1, 0, 0], tangent: [0, 0, 1], bitangent: [0, 1, 0], colorKey: "posX" },
		{ normal: [-1, 0, 0], tangent: [0, 0, -1], bitangent: [0, 1, 0], colorKey: "negX" },
		{ normal: [0, 1, 0], tangent: [1, 0, 0], bitangent: [0, 0, 1], colorKey: "posY" },
		{ normal: [0, -1, 0], tangent: [1, 0, 0], bitangent: [0, 0, -1], colorKey: "negY" },
		{ normal: [0, 0, 1], tangent: [1, 0, 0], bitangent: [0, 1, 0], colorKey: "posZ" },
		{ normal: [0, 0, -1], tangent: [-1, 0, 0], bitangent: [0, 1, 0], colorKey: "negZ" }
	];

	let vi = 0;
	for (const face of faces) {
		const color = FACE_COLORS[face.colorKey];
		const [nx, ny, nz] = face.normal;
		const [tx, ty, tz] = face.tangent;
		const [bx, by, bz] = face.bitangent;

		// Generate (segments+1) x (segments+1) vertices per face
		for (let j = 0; j <= segments; j++) {
			const v = j / segments;
			for (let i = 0; i <= segments; i++) {
				const u = i / segments;
				// Map u,v from [0,1] to [-1,1]
				const su = u * 2 - 1;
				const sv = v * 2 - 1;
				// Position = normal * half + tangent * su * half + bitangent * sv * half
				const px = nx * half + tx * su * half + bx * sv * half;
				const py = ny * half + ty * su * half + by * sv * half;
				const pz = nz * half + tz * su * half + bz * sv * half;

				positions.push(px, py, pz);
				normals.push(nx, ny, nz);
				texCoords.push(u, v);
				colors.push(...color);
			}
		}

		// Generate indices for this face's grid
		const vertsPerRow = segments + 1;
		for (let j = 0; j < segments; j++) {
			for (let i = 0; i < segments; i++) {
				const a = vi + j * vertsPerRow + i;
				const b = a + 1;
				const c = a + vertsPerRow;
				const d = c + 1;
				// Two triangles per quad
				indices.push(a, c, b);
				indices.push(b, c, d);
			}
		}
		vi += vertsPerRow * vertsPerRow;
	}

	return { positions, normals, texCoords, colors, indices };
}

function generateSphereData(): MeshData {
	const radius = 5;
	const widthSegments = 24;
	const heightSegments = 16;
	const positions: number[] = [];
	const normals: number[] = [];
	const texCoords: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];

	// Generate vertices
	for (let y = 0; y <= heightSegments; y++) {
		const v = y / heightSegments;
		const phi = v * Math.PI; // 0 to PI (top to bottom)

		for (let x = 0; x <= widthSegments; x++) {
			const u = x / widthSegments;
			const theta = u * Math.PI * 2; // 0 to 2PI

			// Spherical to cartesian
			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			positions.push(nx * radius, ny * radius, nz * radius);
			normals.push(nx, ny, nz);
			texCoords.push(u, v);

			// Color based on dominant normal direction (like cube faces)
			let color: number[];
			const absX = Math.abs(nx);
			const absY = Math.abs(ny);
			const absZ = Math.abs(nz);

			if (absY >= absX && absY >= absZ) {
				color = ny > 0 ? FACE_COLORS.posY : FACE_COLORS.negY;
			} else if (absX >= absZ) {
				color = nx > 0 ? FACE_COLORS.posX : FACE_COLORS.negX;
			} else {
				color = nz > 0 ? FACE_COLORS.posZ : FACE_COLORS.negZ;
			}
			colors.push(...color);
		}
	}

	// Generate indices
	for (let y = 0; y < heightSegments; y++) {
		for (let x = 0; x < widthSegments; x++) {
			const a = y * (widthSegments + 1) + x;
			const b = a + widthSegments + 1;
			const c = a + 1;
			const d = b + 1;

			// Two triangles per quad (except at poles)
			if (y !== 0) {
				indices.push(a, b, c);
			}
			if (y !== heightSegments - 1) {
				indices.push(c, b, d);
			}
		}
	}

	return { positions, normals, texCoords, colors, indices };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	let result = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const b1 = bytes[i], b2 = bytes[i + 1] ?? 0, b3 = bytes[i + 2] ?? 0;
		result += chars[b1 >> 2];
		result += chars[((b1 & 3) << 4) | (b2 >> 4)];
		result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
		result += i + 2 < bytes.length ? chars[b3 & 63] : "=";
	}
	return result;
}

function buildGltfJson(mesh: MeshData, name: string): string {
	const pos = new Float32Array(mesh.positions);
	const norm = new Float32Array(mesh.normals);
	const uv = new Float32Array(mesh.texCoords);
	const col = new Float32Array(mesh.colors);
	const idx = new Uint16Array(mesh.indices);

	// Bounding box
	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	for (let i = 0; i < pos.length; i += 3) {
		minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
		minY = Math.min(minY, pos[i+1]); maxY = Math.max(maxY, pos[i+1]);
		minZ = Math.min(minZ, pos[i+2]); maxZ = Math.max(maxZ, pos[i+2]);
	}

	// Combine buffers
	const posB = new Uint8Array(pos.buffer);
	const normB = new Uint8Array(norm.buffer);
	const uvB = new Uint8Array(uv.buffer);
	const colB = new Uint8Array(col.buffer);
	const idxB = new Uint8Array(idx.buffer);

	const total = posB.length + normB.length + uvB.length + colB.length + idxB.length;
	const buf = new Uint8Array(total);
	let off = 0;
	buf.set(posB, off); const posOff = off; off += posB.length;
	buf.set(normB, off); const normOff = off; off += normB.length;
	buf.set(uvB, off); const uvOff = off; off += uvB.length;
	buf.set(colB, off); const colOff = off; off += colB.length;
	buf.set(idxB, off); const idxOff = off;

	const bufUri = `data:application/octet-stream;base64,${uint8ArrayToBase64(buf)}`;
	const vertCount = pos.length / 3;

	return JSON.stringify({
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0, name }],
		meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 }, indices: 4, material: 0 }] }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: vertCount, type: "VEC3", min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
			{ bufferView: 1, componentType: 5126, count: vertCount, type: "VEC3" },
			{ bufferView: 2, componentType: 5126, count: vertCount, type: "VEC2" },
			{ bufferView: 3, componentType: 5126, count: vertCount, type: "VEC4" },
			{ bufferView: 4, componentType: 5123, count: idx.length, type: "SCALAR" }
		],
		bufferViews: [
			{ buffer: 0, byteOffset: posOff, byteLength: posB.length },
			{ buffer: 0, byteOffset: normOff, byteLength: normB.length },
			{ buffer: 0, byteOffset: uvOff, byteLength: uvB.length },
			{ buffer: 0, byteOffset: colOff, byteLength: colB.length },
			{ buffer: 0, byteOffset: idxOff, byteLength: idxB.length }
		],
		buffers: [{ uri: bufUri, byteLength: total }],
		// Use baseColorFactor instead of texture - vertex colors (COLOR_0) will tint this
		materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }]
	});
}

// Cached glTF JSON strings
let _cubeJson: string | null = null;
let _sphereJson: string | null = null;

function getCubeJson(): string {
	return _cubeJson ??= buildGltfJson(generateCubeData(), "BuiltinCube");
}

function getSphereJson(): string {
	return _sphereJson ??= buildGltfJson(generateSphereData(), "BuiltinSphere");
}

// Public API
export type BuiltinModelType = "cube" | "sphere";

export function isBuiltinModelUrl(url: string): boolean {
	return url === "builtin:cube" || url === "builtin:sphere";
}

export function getBuiltinModelType(url: string): BuiltinModelType | null {
	if (url === "builtin:cube") return "cube";
	if (url === "builtin:sphere") return "sphere";
	return null;
}

export function getBuiltinModelArrayBuffer(type: BuiltinModelType): ArrayBuffer {
	const json = type === "cube" ? getCubeJson() : getSphereJson();
	return new TextEncoder().encode(json).buffer;
}

export function getBuiltinModelDataUrl(type: BuiltinModelType): string {
	const json = type === "cube" ? getCubeJson() : getSphereJson();
	// Use TextEncoder + custom base64 to avoid btoa which may not be available in workers
	const bytes = new TextEncoder().encode(json);
	const base64 = uint8ArrayToBase64(bytes);
	return `data:model/gltf+json;base64,${base64}`;
}

export function resolveBuiltinUrl(url: string): string {
	const type = getBuiltinModelType(url);
	return type ? getBuiltinModelDataUrl(type) : url;
}
