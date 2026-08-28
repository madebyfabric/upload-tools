import Compressor from "compressorjs";
import { registerFileUploadProcessor } from "./file-upload-pipeline";

const imageTransformName = "image-compression";
const isDevelopment = import.meta.env?.DEV === true;

const defaultOptions = {
    maxDimension: 2560,
    quality: 0.82,
};

export function registerImageCompressionProcessor() {
    return registerFileUploadProcessor(imageTransformName, (files, context) =>
        transformImageFiles(files, getOptions(context.attributes)),
    );
}

/**
 * Transform selected files before they are handed to Livewire.
 *
 * @param {File[]} files
 * @param {{ maxDimension: number, quality: number }} options
 * @returns {Promise<File[]>}
 */
export function transformImageFiles(files, options) {
    return Promise.all(files.map((file) => compressImage(file, options)));
}

/**
 * @param {File} file
 * @param {{ maxDimension: number, quality: number }} options
 * @returns {Promise<File>}
 */
function compressImage(file, options) {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
        return Promise.resolve(file);
    }

    return new Promise((resolve) => {
        try {
            new Compressor(file, {
                maxWidth: options.maxDimension,
                maxHeight: options.maxDimension,
                quality: options.quality,
                checkOrientation: true,
                retainExif: true,
                strict: false,
                mimeType: "image/jpeg",
                success(result) {
                    const compressedFile =
                        result instanceof File
                            ? result
                            : new File([result], file.name, {
                                  type: result.type || file.type,
                                  lastModified: file.lastModified,
                              });
                    const compressionApplied = compressedFile.size < file.size;

                    resolve(compressionApplied ? compressedFile : file);
                },
                error(error) {
                    warnAboutCompressionFailure(file, error);
                    resolve(file);
                },
            });
        } catch (error) {
            warnAboutCompressionFailure(file, error);
            resolve(file);
        }
    });
}

function getOptions(attributes = {}) {
    const maxDimension = parseOption(attributes.compressMaxDimension);
    const quality = parseOption(attributes.compressQuality);

    return {
        maxDimension:
            Number.isFinite(maxDimension) && maxDimension > 0
                ? maxDimension
                : defaultOptions.maxDimension,
        quality:
            Number.isFinite(quality) && quality >= 0 && quality <= 1
                ? quality
                : defaultOptions.quality,
    };
}

/**
 * @param {string|undefined} value
 * @returns {number|null}
 */
function parseOption(value) {
    if (value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

/**
 * @param {File} file
 * @param {unknown} error
 */
function warnAboutCompressionFailure(file, error) {
    if (!isDevelopment) {
        return;
    }

    console.warn(
        `[file-upload] Image compression failed for "${file.name}"; using the original file.`,
        error,
    );
}
