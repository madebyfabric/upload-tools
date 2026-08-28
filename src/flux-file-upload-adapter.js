import {
    getFileUploadProcessorNames,
    processFileUploadOrFallback,
} from "./file-upload-pipeline";
import { createFileUploadContext } from "./file-upload-adapter-context";

const fluxUploadSelector = "ui-file-upload[data-file-transform]";
const handoffUploads = new WeakSet();
const transformingOwners = new WeakMap();
let adapterCleanup = null;

/**
 * Register the temporary Flux adapter until Flux or Livewire exposes a
 * documented pre-upload transformation hook.
 *
 * @returns {() => boolean}
 */
export function registerFluxFileUploadAdapter() {
    if (adapterCleanup) {
        return adapterCleanup;
    }

    const registration = {
        active: true,
        processingUploads: new WeakSet(),
        replayingUploads: new WeakSet(),
    };
    const listener = (event) => handleFluxFileUploadChange(event, registration);

    document.addEventListener("change", listener, true);

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) {
            return false;
        }

        registration.active = false;
        document.removeEventListener("change", listener, true);
        cleanedUp = true;
        adapterCleanup = null;

        return true;
    };

    adapterCleanup = cleanup;

    return cleanup;
}

/**
 * @param {Event} event
 */
async function handleFluxFileUploadChange(event, registration) {
    if (!registration.active) {
        return;
    }

    const upload = event.target.closest?.(fluxUploadSelector);

    if (!upload || event.target !== upload) {
        return;
    }

    if (registration.replayingUploads.has(upload)) {
        registration.replayingUploads.delete(upload);

        return;
    }

    if (handoffUploads.has(upload)) {
        handoffUploads.delete(upload);

        return;
    }

    if (registration.processingUploads.has(upload)) {
        event.stopImmediatePropagation();

        return;
    }

    if (upload.files.length === 0) {
        return;
    }

    event.stopImmediatePropagation();
    registration.processingUploads.add(upload);

    const files = [...upload.files];
    const processorNames = getFileUploadProcessorNames(
        upload.dataset.fileTransform,
    );
    const context = createFileUploadContext(upload, "flux");
    const wasDisabled = upload.disabled;

    upload.disabled = true;
    upload.dataset.transforming = "true";
    transformingOwners.set(upload, registration);

    try {
        const processedFiles = await processFileUploadOrFallback(
            files,
            processorNames,
            context,
        );

        if (registration.active) {
            registration.replayingUploads.add(upload);
        } else {
            handoffUploads.add(upload);
            queueMicrotask(() => handoffUploads.delete(upload));
        }

        try {
            upload.files = processedFiles;
        } catch {
            upload.dispatchEvent(new Event("change", { bubbles: true }));
        }
    } finally {
        registration.processingUploads.delete(upload);

        if (transformingOwners.get(upload) === registration) {
            transformingOwners.delete(upload);
            delete upload.dataset.transforming;

            if (!wasDisabled && !upload.hasAttribute("data-loading")) {
                upload.disabled = false;
            }
        }
    }
}
