import Cropper from "cropperjs";
import { registerFileUploadProcessor } from "./file-upload-pipeline";

const imageTransformName = "image-crop";
const defaultOutputSize = 512;
const defaultQuality = 0.9;

/**
 * Register an interactive square cropper for image uploads.
 *
 * @returns {() => boolean}
 */
export function registerImageCropProcessor() {
    return registerFileUploadProcessor(imageTransformName, (files, context) =>
        cropImageFiles(files, context),
    );
}

/**
 * Crop each image in sequence so only one editor is open at a time.
 *
 * @param {File[]} files
 * @param {{ attributes?: Record<string, string>, element?: HTMLElement|null }} context
 * @returns {Promise<File[]>}
 */
export async function cropImageFiles(files, context) {
    const processedFiles = [];

    for (const file of files) {
        const processedFile = await cropImage(file, context);

        if (processedFile) {
            processedFiles.push(processedFile);
        }
    }

    return processedFiles;
}

/**
 * @param {File} file
 * @param {{ attributes?: Record<string, string>, element?: HTMLElement|null }} context
 * @returns {Promise<File|null>}
 */
function cropImage(file, context) {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
        return Promise.resolve(file);
    }

    const modalName = context.attributes?.imageCropModal;
    const editor = findEditor(modalName);

    if (!editor || !modalName) {
        return Promise.reject(
            new Error("The image crop editor could not be found."),
        );
    }

    const stage = editor.querySelector("[data-image-crop-stage]");
    const preview = editor.querySelector("[data-image-crop-image]");
    const confirmButton = editor.querySelector("[data-image-crop-confirm]");
    const cancelButton = editor.querySelector("[data-image-crop-cancel]");

    if (!stage || !preview || !confirmButton || !cancelButton) {
        return Promise.reject(
            new Error("The image crop editor is incomplete."),
        );
    }

    return new Promise((resolve, reject) => {
        let cropper = null;
        let settled = false;
        const objectUrl = URL.createObjectURL(file);
        const modal = editor.closest("ui-modal");
        const dialog = modal?.querySelector("dialog");

        const cleanup = () => {
            cropper?.destroy();
            cropper = null;
            stage.replaceChildren(preview);
            preview.removeAttribute("src");
            confirmButton.disabled = false;
            URL.revokeObjectURL(objectUrl);
            confirmButton.removeEventListener("click", handleConfirm);
            cancelButton.removeEventListener("click", handleCancel);
            dialog?.removeEventListener("close", handleModalClose);
        };

        const settle = (result) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            window.Flux.modal(modalName).close();
            resolve(result);
        };

        const handleCancel = () => settle(null);

        const handleModalClose = () => settle(null);

        const handleConfirm = async () => {
            if (!cropper) {
                return;
            }

            confirmButton.disabled = true;

            try {
                const selection = cropper.getCropperSelection();
                const outputSize = getOutputSize(editor);
                const canvas = await selection?.$toCanvas({
                    width: outputSize,
                    height: outputSize,
                });

                if (!canvas) {
                    throw new Error("The cropped image could not be created.");
                }

                const croppedFile = await canvasToFile(
                    canvas,
                    file,
                    defaultQuality,
                );

                settle(croppedFile);
            } catch (error) {
                settled = true;
                cleanup();
                window.Flux.modal(modalName).close();
                reject(error);
            }
        };

        preview.src = objectUrl;
        preview.alt = file.name;
        stage.replaceChildren(preview);
        confirmButton.addEventListener("click", handleConfirm);
        cancelButton.addEventListener("click", handleCancel);
        dialog?.addEventListener("close", handleModalClose);

        window.Flux.modal(modalName).show();

        requestAnimationFrame(() => {
            try {
                cropper = new Cropper(preview, { container: stage });

                const image = cropper.getCropperImage();
                const selection = cropper.getCropperSelection();

                if (image) {
                    image.initialCenterSize = "cover";
                    image.scalable = false;
                    image.$center("cover");
                }

                if (selection) {
                    selection.aspectRatio = 1;
                    selection.initialCoverage = 0.8;
                    selection.movable = true;
                    selection.resizable = true;
                    selection.keyboard = true;
                }
            } catch (error) {
                settled = true;
                cleanup();
                window.Flux.modal(modalName).close();
                reject(error);
            }
        });
    });
}

/**
 * @param {string|undefined} modalName
 * @returns {HTMLElement|null}
 */
function findEditor(modalName) {
    if (!modalName) {
        return null;
    }

    return document.querySelector(
        `ui-modal [data-modal="${CSS.escape(modalName)}"] [data-image-crop-editor]`,
    );
}

/**
 * @param {HTMLElement} editor
 * @returns {number}
 */
function getOutputSize(editor) {
    const outputSize = Number(editor.dataset.imageCropOutputSize);

    return Number.isFinite(outputSize) && outputSize > 0
        ? outputSize
        : defaultOutputSize;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {File} originalFile
 * @param {number} quality
 * @returns {Promise<File>}
 */
function canvasToFile(canvas, originalFile, quality) {
    const type = outputTypeFor(originalFile.type);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error("The cropped image could not be encoded."),
                    );

                    return;
                }

                resolve(
                    new File(
                        [blob],
                        replaceExtension(originalFile.name, extensionFor(type)),
                        {
                            type,
                            lastModified: originalFile.lastModified,
                        },
                    ),
                );
            },
            type,
            quality,
        );
    });
}

/**
 * @param {string} type
 * @returns {string}
 */
function outputTypeFor(type) {
    return type === "image/png" || type === "image/webp" ? type : "image/jpeg";
}

/**
 * @param {string} type
 * @returns {string}
 */
function extensionFor(type) {
    return type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : "jpg";
}

/**
 * @param {string} name
 * @param {string} extension
 * @returns {string}
 */
function replaceExtension(name, extension) {
    return `${name.replace(/\.[^.]+$/, "")}.${extension}`;
}
