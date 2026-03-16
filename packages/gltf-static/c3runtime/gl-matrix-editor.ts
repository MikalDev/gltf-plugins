/**
 * Minimal gl-matrix bundle for the editor.
 * Attaches mat4, vec3, quat to globalThis.GltfBundle so the editor
 * instance can use the same math library as the runtime.
 */
import { mat4, vec3, quat } from "gl-matrix";

const g = globalThis as any;
g.GltfBundle = g.GltfBundle || {};
g.GltfBundle.mat4 = mat4;
g.GltfBundle.vec3 = vec3;
g.GltfBundle.quat = quat;
