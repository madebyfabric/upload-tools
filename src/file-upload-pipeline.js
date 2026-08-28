const processors = new Map();
const isDevelopment = import.meta.env?.DEV === true;

/**
 * @typedef {Object} FileUploadContext
 * @property {string} source
 * @property {string} fieldName The Livewire property receiving the files.
 * @property {Record<string, string>} attributes Plain data-* values from the uploader.
 * @property {HTMLElement|null} element The uploader element that triggered the pipeline.
 */

/**
 * @typedef {(files: File[], context: FileUploadContext) => File[]|Promise<File[]>} FileUploadProcessor
 */

/**
 * @typedef {Object} FileUploadProcessorRegistration
 * @property {FileUploadProcessor} processor
 */

const defaultFileUploadContext = Object.freeze({
    source: "unknown",
    fieldName: "",
    attributes: Object.freeze({}),
    element: null,
});

/**
 * Register a named file processor for use in an upload pipeline.
 *
 * @param {string} name
 * @param {FileUploadProcessor} processor
 * @returns {() => boolean}
 */
export function registerFileUploadProcessor(name, processor) {
    if (typeof name !== "string" || name.trim() === "") {
        throw new TypeError("A non-empty processor name is required.");
    }

    if (typeof processor !== "function") {
        throw new TypeError(`Processor "${name}" must be a function.`);
    }

    const previousRegistration = processors.get(name);

    if (previousRegistration && isDevelopment) {
        console.warn(
            `[file-upload] Processor "${name}" is being replaced; the latest registration wins.`,
        );
    }

    const registration = {
        processor,
    };

    processors.set(name, registration);

    let disposed = false;

    return () => {
        if (disposed) {
            return false;
        }

        disposed = true;

        if (processors.get(name) !== registration) {
            return false;
        }

        return processors.delete(name);
    };
}

/**
 * Clear all registered processors.
 *
 * This is primarily useful for isolated tests and hot-module replacement.
 */
export function resetFileUploadProcessors() {
    processors.clear();
}

/**
 * @param {string|string[]|undefined} value
 * @returns {string[]}
 */
export function getFileUploadProcessorNames(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    return String(value ?? "")
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * Run named processors in declaration order.
 *
 * @param {File[]} files
 * @param {string[]|string} processorNames
 * @param {Partial<FileUploadContext>} context
 * @returns {Promise<File[]>}
 */
export async function processFileUpload(
    files,
    processorNames,
    context = defaultFileUploadContext,
) {
    if (!Array.isArray(files) || !files.every(isFile)) {
        throw new TypeError("Files must be an array of File objects.");
    }

    let processedFiles = [...files];
    const normalizedContext = normalizeFileUploadContext(context);

    for (const name of getFileUploadProcessorNames(processorNames)) {
        const registration = processors.get(name);

        if (!registration) {
            if (isDevelopment) {
                console.warn(
                    `[file-upload] Unknown processor "${name}" was skipped.`,
                );
            }

            continue;
        }

        const result = await registration.processor(
            processedFiles,
            normalizedContext,
        );

        if (!isFileArray(result)) {
            throw new TypeError(
                `File upload processor "${name}" must return an array of File objects.`,
            );
        }

        processedFiles = result;
    }

    return processedFiles;
}

/**
 * Run named processors while preserving the original files if processing fails.
 *
 * @param {File[]} files
 * @param {string[]|string} processorNames
 * @param {Partial<FileUploadContext>} context
 * @returns {Promise<File[]>}
 */
export async function processFileUploadOrFallback(
    files,
    processorNames,
    context = defaultFileUploadContext,
) {
    const originalFiles = [...files];

    try {
        return await processFileUpload(originalFiles, processorNames, context);
    } catch (error) {
        if (isDevelopment) {
            console.warn(
                "[file-upload] Processor pipeline failed; using original files.",
                { processorNames, error },
            );
        }

        return originalFiles;
    }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFileArray(value) {
    return Array.isArray(value) && value.every(isFile);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFile(value) {
    return typeof File !== "undefined" && value instanceof File;
}

/**
 * @param {Partial<FileUploadContext>} context
 * @returns {FileUploadContext}
 */
function normalizeFileUploadContext(context = defaultFileUploadContext) {
    return {
        source: context.source ?? defaultFileUploadContext.source,
        fieldName: context.fieldName ?? defaultFileUploadContext.fieldName,
        element: context.element ?? defaultFileUploadContext.element,
        attributes: {
            ...defaultFileUploadContext.attributes,
            ...context.attributes,
        },
    };
}
