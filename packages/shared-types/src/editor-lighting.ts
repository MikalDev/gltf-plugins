/**
 * Shared interfaces for editor lighting communication via globalThis
 */

/**
 * Spotlight configuration exposed by GltfSpotlight editor instances
 */
export interface EditorSpotlight {
    /** Unique instance ID */
    id: number;
    /** Whether this spotlight is enabled */
    enabled: boolean;
    /** World position [x, y, z] */
    position: [number, number, number];
    /** Normalized direction vector [x, y, z] */
    direction: [number, number, number];
    /** RGB color values (0-1 range) */
    color: [number, number, number];
    /** Light intensity multiplier */
    intensity: number;
    /** Full intensity cone angle in degrees */
    innerAngle: number;
    /** Falloff cone angle in degrees */
    outerAngle: number;
    /** Distance falloff range (0 = infinite) */
    range: number;
}

/**
 * Environment lighting configuration exposed by GltfEnvironment editor instance
 */
export interface EditorEnvironment {
    /** Ambient light RGB color (0-1 range) */
    ambientColor: [number, number, number];
    /** Ambient light intensity multiplier */
    ambientIntensity: number;
    /** Whether hemisphere lighting is enabled */
    hemisphereEnabled: boolean;
    /** Sky/up direction RGB color (0-1 range) */
    skyColor: [number, number, number];
    /** Ground/down direction RGB color (0-1 range) */
    groundColor: [number, number, number];
    /** Hemisphere lighting intensity multiplier */
    hemisphereIntensity: number;
}

/**
 * Global type augmentation for editor lighting communication
 */
declare global {
    var gltfEditorSpotlights: EditorSpotlight[];
    var gltfEditorEnvironment: EditorEnvironment | undefined;
    /** Incremented whenever lighting state changes (used for dirty detection) */
    var gltfEditorLightingVersion: number;
}

export {};
