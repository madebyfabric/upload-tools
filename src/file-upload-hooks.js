import { registerFluxFileUploadAdapter } from "./flux-file-upload-adapter.js";
import { registerImageCropProcessor } from "./image-crop.js";
import { registerImageCompressionProcessor } from "./image-upload-compression.js";
import { registerFileUploadPlugin } from "./file-upload-plugin.js";

const defaultPlugins = ["compression", "crop"];
const defaultAdapters = ["flux"];

export const imageCompressionPlugin = {
    name: "image-compression",
    register() {
        return registerImageCompressionProcessor();
    },
};

export const imageCropPlugin = {
    name: "image-crop",
    register() {
        return registerImageCropProcessor();
    },
};

const builtInPlugins = new Map([
    ["compression", imageCompressionPlugin],
    ["image-compression", imageCompressionPlugin],
    ["crop", imageCropPlugin],
    ["image-crop", imageCropPlugin],
]);

/**
 * Start the built-in upload hooks.
 *
 * This function is deliberately opt-in: importing the package does not add
 * listeners to the document or register global processors.
 *
 * @param {{ plugins?: Array<string|Object>, processors?: Array<"compression"|"crop">, adapters?: Array<"flux"> }} [options]
 * @returns {() => boolean} A cleanup function for hot reloads and teardown.
 */
export function registerFileUploadHooks(options = {}) {
    const plugins = options.plugins ?? options.processors ?? defaultPlugins;
    const adapterNames = options.adapters ?? defaultAdapters;
    const cleanups = [];

    for (const plugin of plugins) {
        const resolvedPlugin =
            typeof plugin === "string" ? builtInPlugins.get(plugin) : plugin;

        if (!resolvedPlugin) {
            throw new Error(`Unknown file-upload plugin "${plugin}".`);
        }

        cleanups.push(registerFileUploadPlugin(resolvedPlugin));
    }

    if (adapterNames.includes("flux")) {
        cleanups.push(registerFluxFileUploadAdapter());
    }

    let cleanedUp = false;

    return () => {
        if (cleanedUp) {
            return false;
        }

        cleanedUp = true;

        return cleanups.reduce(
            (cleaned, cleanup) => cleanup() || cleaned,
            false,
        );
    };
}
