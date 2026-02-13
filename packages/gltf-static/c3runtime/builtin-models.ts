/**
 * Built-in primitive models (cube and sphere) as glTF JSON.
 * Shared between editor and runtime via globalThis.GltfBundle.BuiltinModels
 */

interface MeshData {
	positions: number[];
	normals: number[];
	texCoords: number[];
	colors: number[];
	indices: number[];
}

type FaceColorKey = "posX" | "negX" | "posY" | "negY" | "posZ" | "negZ";
type BuiltinModelType = "cube" | "sphere" | "capsule";

const FACE_COLORS: Record<FaceColorKey, number[]> = {
	posX: [1.0, 0.98, 0.95, 1.0],
	negX: [0.95, 0.98, 1.0, 1.0],
	posY: [1.0, 1.0, 1.0, 1.0],
	negY: [0.95, 0.95, 0.95, 1.0],
	posZ: [0.98, 1.0, 0.95, 1.0],
	negZ: [0.95, 0.97, 1.0, 1.0],
};

interface CubeFace {
	corners: number[][];
	normal: number[];
	colorKey: FaceColorKey;
}

function generateCubeData(): MeshData {
	const half = 5;
	const segments = 3;
	const positions: number[] = [];
	const normals: number[] = [];
	const texCoords: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];

	const faces: CubeFace[] = [
		{ corners: [[half, -half, -half], [half, -half, half], [half, half, half], [half, half, -half]], normal: [1, 0, 0], colorKey: "posX" },
		{ corners: [[-half, -half, half], [-half, -half, -half], [-half, half, -half], [-half, half, half]], normal: [-1, 0, 0], colorKey: "negX" },
		{ corners: [[-half, half, -half], [half, half, -half], [half, half, half], [-half, half, half]], normal: [0, 1, 0], colorKey: "posY" },
		{ corners: [[-half, -half, half], [half, -half, half], [half, -half, -half], [-half, -half, -half]], normal: [0, -1, 0], colorKey: "negY" },
		{ corners: [[-half, -half, half], [-half, half, half], [half, half, half], [half, -half, half]], normal: [0, 0, 1], colorKey: "posZ" },
		{ corners: [[half, -half, -half], [half, half, -half], [-half, half, -half], [-half, -half, -half]], normal: [0, 0, -1], colorKey: "negZ" }
	];

	let vi = 0;
	for (const face of faces) {
		const [c0, c1, c2, c3] = face.corners;
		const color = FACE_COLORS[face.colorKey];

		for (let j = 0; j <= segments; j++) {
			const v = j / segments;
			for (let i = 0; i <= segments; i++) {
				const u = i / segments;
				const px = (1 - u) * (1 - v) * c0[0] + u * (1 - v) * c1[0] + u * v * c2[0] + (1 - u) * v * c3[0];
				const py = (1 - u) * (1 - v) * c0[1] + u * (1 - v) * c1[1] + u * v * c2[1] + (1 - u) * v * c3[1];
				const pz = (1 - u) * (1 - v) * c0[2] + u * (1 - v) * c1[2] + u * v * c2[2] + (1 - u) * v * c3[2];

				positions.push(px, py, pz);
				normals.push(...face.normal);
				texCoords.push(u, v);
				colors.push(...color);
			}
		}

		const vertsPerRow = segments + 1;
		for (let j = 0; j < segments; j++) {
			for (let i = 0; i < segments; i++) {
				const a = vi + j * vertsPerRow + i;
				const b = a + 1;
				const c = a + vertsPerRow;
				const d = c + 1;
				indices.push(a, c, b, b, c, d);
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

	for (let y = 0; y <= heightSegments; y++) {
		const v = y / heightSegments;
		const phi = v * Math.PI;

		for (let x = 0; x <= widthSegments; x++) {
			const u = x / widthSegments;
			const theta = u * Math.PI * 2;

			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			positions.push(nx * radius, ny * radius, nz * radius);
			normals.push(nx, ny, nz);
			texCoords.push(u, v);

			const absX = Math.abs(nx);
			const absY = Math.abs(ny);
			const absZ = Math.abs(nz);

			let color: number[];
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

	for (let y = 0; y < heightSegments; y++) {
		for (let x = 0; x < widthSegments; x++) {
			const a = y * (widthSegments + 1) + x;
			const b = a + widthSegments + 1;
			const c = a + 1;
			const d = b + 1;

			if (y !== 0) indices.push(a, b, c);
			if (y !== heightSegments - 1) indices.push(c, b, d);
		}
	}

	return { positions, normals, texCoords, colors, indices };
}

function generateCapsuleData(): MeshData {
	const radius = 5;
	const cylinderHeight = 10; // Total height = 20 (2x width of 10)
	const radialSegments = 8; // Low poly
	const capSegments = 4; // Hemisphere segments

	const positions: number[] = [];
	const normals: number[] = [];
	const texCoords: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];

	const halfCylHeight = cylinderHeight / 2;

	// Top hemisphere (from pole down to equator)
	for (let y = 0; y <= capSegments; y++) {
		const v = y / capSegments;
		const phi = v * Math.PI / 2; // 0 to PI/2

		for (let x = 0; x <= radialSegments; x++) {
			const u = x / radialSegments;
			const theta = u * Math.PI * 2;

			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			positions.push(nx * radius, ny * radius + halfCylHeight, nz * radius);
			normals.push(nx, ny, nz);
			texCoords.push(u, v * 0.25);

			const absX = Math.abs(nx);
			const absZ = Math.abs(nz);
			let color: number[];
			if (ny > 0.5) {
				color = FACE_COLORS.posY;
			} else if (absX >= absZ) {
				color = nx > 0 ? FACE_COLORS.posX : FACE_COLORS.negX;
			} else {
				color = nz > 0 ? FACE_COLORS.posZ : FACE_COLORS.negZ;
			}
			colors.push(...color);
		}
	}

	// Cylinder body (just top and bottom rings, normals point outward)
	for (let y = 0; y <= 1; y++) {
		const yPos = y === 0 ? halfCylHeight : -halfCylHeight;
		const vCoord = 0.25 + y * 0.5;

		for (let x = 0; x <= radialSegments; x++) {
			const u = x / radialSegments;
			const theta = u * Math.PI * 2;

			const nx = Math.cos(theta);
			const nz = Math.sin(theta);

			positions.push(nx * radius, yPos, nz * radius);
			normals.push(nx, 0, nz);
			texCoords.push(u, vCoord);

			const absX = Math.abs(nx);
			const absZ = Math.abs(nz);
			let color: number[];
			if (absX >= absZ) {
				color = nx > 0 ? FACE_COLORS.posX : FACE_COLORS.negX;
			} else {
				color = nz > 0 ? FACE_COLORS.posZ : FACE_COLORS.negZ;
			}
			colors.push(...color);
		}
	}

	// Bottom hemisphere (from equator down to pole)
	for (let y = 0; y <= capSegments; y++) {
		const v = y / capSegments;
		const phi = Math.PI / 2 + v * Math.PI / 2; // PI/2 to PI

		for (let x = 0; x <= radialSegments; x++) {
			const u = x / radialSegments;
			const theta = u * Math.PI * 2;

			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			positions.push(nx * radius, ny * radius - halfCylHeight, nz * radius);
			normals.push(nx, ny, nz);
			texCoords.push(u, 0.75 + v * 0.25);

			const absX = Math.abs(nx);
			const absZ = Math.abs(nz);
			let color: number[];
			if (ny < -0.5) {
				color = FACE_COLORS.negY;
			} else if (absX >= absZ) {
				color = nx > 0 ? FACE_COLORS.posX : FACE_COLORS.negX;
			} else {
				color = nz > 0 ? FACE_COLORS.posZ : FACE_COLORS.negZ;
			}
			colors.push(...color);
		}
	}

	const rowSize = radialSegments + 1;

	// Top hemisphere indices
	for (let y = 0; y < capSegments; y++) {
		for (let x = 0; x < radialSegments; x++) {
			const a = y * rowSize + x;
			const b = a + rowSize;
			const c = a + 1;
			const d = b + 1;

			if (y !== 0) indices.push(a, b, c);
			indices.push(c, b, d);
		}
	}

	// Cylinder indices
	const cylStart = (capSegments + 1) * rowSize;
	for (let x = 0; x < radialSegments; x++) {
		const a = cylStart + x;
		const b = a + rowSize;
		const c = a + 1;
		const d = b + 1;
		indices.push(a, b, c, c, b, d);
	}

	// Bottom hemisphere indices
	const botStart = cylStart + 2 * rowSize;
	for (let y = 0; y < capSegments; y++) {
		for (let x = 0; x < radialSegments; x++) {
			const a = botStart + y * rowSize + x;
			const b = a + rowSize;
			const c = a + 1;
			const d = b + 1;

			indices.push(a, b, c);
			if (y !== capSegments - 1) indices.push(c, b, d);
		}
	}

	return { positions, normals, texCoords, colors, indices };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	let result = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const b1 = bytes[i], b2 = bytes[i + 1] || 0, b3 = bytes[i + 2] || 0;
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

	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	for (let i = 0; i < pos.length; i += 3) {
		minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
		minY = Math.min(minY, pos[i+1]); maxY = Math.max(maxY, pos[i+1]);
		minZ = Math.min(minZ, pos[i+2]); maxZ = Math.max(maxZ, pos[i+2]);
	}

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
		materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }]
	});
}

// Cached JSON strings
let _cubeJson: string | null = null;
let _sphereJson: string | null = null;
let _capsuleJson: string | null = null;

function getCubeJson(): string {
	if (!_cubeJson) _cubeJson = buildGltfJson(generateCubeData(), "BuiltinCube");
	return _cubeJson;
}

function getSphereJson(): string {
	if (!_sphereJson) _sphereJson = buildGltfJson(generateSphereData(), "BuiltinSphere");
	return _sphereJson;
}

function getCapsuleJson(): string {
	if (!_capsuleJson) _capsuleJson = buildGltfJson(generateCapsuleData(), "BuiltinCapsule");
	return _capsuleJson;
}

// Public API
const BuiltinModels = {
	isBuiltinModelUrl(url: string): boolean {
		return url === "builtin:cube" || url === "builtin:sphere" || url === "builtin:capsule";
	},

	getBuiltinModelType(url: string): BuiltinModelType | null {
		if (url === "builtin:cube") return "cube";
		if (url === "builtin:sphere") return "sphere";
		if (url === "builtin:capsule") return "capsule";
		return null;
	},

	getBuiltinModelArrayBuffer(type: BuiltinModelType): ArrayBuffer {
		const json = type === "cube" ? getCubeJson() : type === "sphere" ? getSphereJson() : getCapsuleJson();
		return new TextEncoder().encode(json).buffer;
	},

	getBuiltinModelDataUrl(type: BuiltinModelType): string {
		const json = type === "cube" ? getCubeJson() : type === "sphere" ? getSphereJson() : getCapsuleJson();
		const bytes = new TextEncoder().encode(json);
		const base64 = uint8ArrayToBase64(bytes);
		return `data:model/gltf+json;base64,${base64}`;
	},

	resolveBuiltinUrl(url: string): string {
		const type = BuiltinModels.getBuiltinModelType(url);
		return type ? BuiltinModels.getBuiltinModelDataUrl(type) : url;
	}
};

// Expose via globalThis (GltfBundle type is declared elsewhere)
const g = globalThis as unknown as { GltfBundle: Record<string, unknown> };
g.GltfBundle = g.GltfBundle || {};
g.GltfBundle.BuiltinModels = BuiltinModels;

export {};
