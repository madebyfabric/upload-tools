import { registerFileUploadProcessor } from "./file-upload-pipeline.js";

/**
 * @typedef {Object} FileUploadPluginApi
 * @property {typeof registerFileUploadProcessor} registerProcessor
 * @property {(adapter: () => (() => boolean)|undefined) => (() => boolean)|undefined} registerAdapter
 */

/**
 * @typedef {Object} FileUploadPlugin
 * @property {string} name
 * @property {(api: FileUploadPluginApi) => void|(() => boolean)} register
 */

/**
 * Install a file-upload plugin and return its teardown function.
 *
 * A plugin can register one or more processors and adapters through the
 * supplied API. Registration is scoped to the returned cleanup function, so
 * plugins can be safely used with hot module replacement.
 *
 * @param {FileUploadPlugin} plugin
 * @returns {() => boolean}
 */
export function registerFileUploadPlugin(plugin) {
    validatePlugin(plugin);

    const cleanups = [];
    const registerAdapter = (adapter) => {
        if (typeof adapter !== "function") {
            throw new TypeError(
                `Plugin "${plugin.name}" must register adapter functions.`,
            );
        }

        const cleanup = adapter();

        if (cleanup !== undefined && typeof cleanup !== "function") {
            throw new TypeError(
                `Adapter registered by plugin "${plugin.name}" must return a cleanup function.`,
            );
        }

        if (cleanup) {
            cleanups.push(cleanup);
        }

        return cleanup;
    };

    let pluginCleanup;

    try {
        pluginCleanup = plugin.register({
            registerProcessor: registerFileUploadProcessor,
            registerAdapter,
        });

        if (
            pluginCleanup !== undefined &&
            typeof pluginCleanup !== "function"
        ) {
            throw new TypeError(
                `Plugin "${plugin.name}" must return a cleanup function.`,
            );
        }
    } catch (error) {
        cleanups.reverse().forEach((cleanup) => cleanup());

        throw error;
    }

    if (pluginCleanup) {
        cleanups.push(pluginCleanup);
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

/**
 * @param {unknown} plugin
 */
function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== "object") {
        throw new TypeError("A file-upload plugin object is required.");
    }

    if (typeof plugin.name !== "string" || plugin.name.trim() === "") {
        throw new TypeError("A file-upload plugin needs a non-empty name.");
    }

    if (typeof plugin.register !== "function") {
        throw new TypeError(
            `Plugin "${plugin.name}" must provide a register function.`,
        );
    }
}
