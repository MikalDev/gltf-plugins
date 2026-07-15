const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const BUNDLE_PATH = "c3runtime/gltf-bundle.js";
const GLTF_SRC_DIR = "c3runtime/gltf";
const GENERATED_DIR = "c3runtime/gltf/generated";
const LIGHTING_CORE_SRC = "c3runtime/gltf/LightingCore.ts";
const GENERATED_LIGHTING = path.join(GENERATED_DIR, "lightingWorkerCode.ts");

// Delete old bundle and compiled JS files to avoid caching issues
function cleanBuildFiles() {
	// Delete the bundle
	try {
		fs.unlinkSync(BUNDLE_PATH);
	} catch (e) {
		// Ignore if file doesn't exist
	}

	// Delete compiled .js files in gltf source folder (esbuild uses .ts directly)
	try {
		const files = fs.readdirSync(GLTF_SRC_DIR);
		for (const file of files) {
			if (file.endsWith(".js")) {
				fs.unlinkSync(path.join(GLTF_SRC_DIR, file));
			}
		}
	} catch (e) {
		// Ignore if folder doesn't exist
	}
}

// The transform worker runs from a Blob URL and cannot import modules, so the
// lighting equation has to reach it as source text. Rather than hand-mirroring it
// (which had already drifted — the old copy silently dropped vertex colors), compile
// LightingCore.ts to an IIFE and emit it as a string constant the worker prepends.
// One implementation, shared by both threads.
function generateWorkerLightingCode() {
	const result = esbuild.buildSync({
		entryPoints: [LIGHTING_CORE_SRC],
		bundle: true,
		format: "iife",
		globalName: "LightingCore",
		platform: "browser",
		target: "es2021",
		write: false,
		minify: false
	});

	const code = result.outputFiles[0].text;

	fs.mkdirSync(GENERATED_DIR, { recursive: true });
	fs.writeFileSync(
		GENERATED_LIGHTING,
		`// GENERATED FILE - DO NOT EDIT.\n` +
		`// Produced by build.js from ${LIGHTING_CORE_SRC}.\n` +
		`// Exposes the lighting equation as source text for injection into the transform\n` +
		`// worker blob, so the worker and the main thread share ONE implementation.\n` +
		`// Regenerate with: npm run build\n` +
		`export const LIGHTING_WORKER_CODE = ${JSON.stringify(code)};\n`
	);

	console.log("lightingWorkerCode.ts generated from LightingCore.ts");
}

cleanBuildFiles();
generateWorkerLightingCode();

// Bundle the gltf modules with their npm dependencies
// ESM format - globalThis attachment is done in index.ts
esbuild.build({
	entryPoints: ["c3runtime/gltf/index.ts"],
	bundle: true,
	format: "esm",
	outfile: BUNDLE_PATH,
	platform: "browser",
	target: "es2021",
	minify: false,
	sourcemap: false
}).then(() => {
	console.log("gltf-bundle.js built successfully");
}).catch((err) => {
	console.error("Build failed:", err);
	process.exit(1);
});
