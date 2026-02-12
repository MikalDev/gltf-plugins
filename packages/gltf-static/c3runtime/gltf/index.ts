import { GltfModel } from "./GltfModel.js";
import { GltfMesh } from "./GltfMesh.js";
import { GltfNode } from "./GltfNode.js";
import { TransformWorkerPool, SharedWorkerPool } from "./TransformWorkerPool.js";
import { AnimationController } from "./AnimationController.js";
import { modelCache } from "./types.js";
import { mat4, quat, vec3 } from "gl-matrix";
import * as Lighting from "./Lighting.js";
import * as BuiltinModels from "./BuiltinModels.js";

// ES module exports
export { GltfModel, GltfMesh, GltfNode, TransformWorkerPool, SharedWorkerPool, AnimationController, modelCache, mat4, quat, vec3, Lighting, BuiltinModels };
export type { GltfModelStats, GltfModelOptions } from "./GltfModel.js";
export type { AnimationMeshData, AnimationControllerOptions } from "./AnimationController.js";
export type { DirectionalLight, HemisphereLight, ColorBlendMode } from "./Lighting.js";
export type {
	CachedModelData,
	CachedSkinData,
	CachedAnimationData,
	MeshSkinningData,
	JointData,
	JointTransform,
	AnimationSamplerData,
	AnimationChannelData,
	AnimationInterpolation,
	AnimationTargetPath
} from "./types.js";

// Attach to globalThis for C3 worker compatibility
(globalThis as any).GltfBundle = { GltfModel, GltfMesh, GltfNode, TransformWorkerPool, SharedWorkerPool, AnimationController, modelCache, mat4, vec3, quat, Lighting, BuiltinModels };
