/**
 * Build the transport-neutral context passed to file processors.
 *
 * @param {HTMLElement} element
 * @param {"flux"|"livewire"} source
 * @returns {{ source: "flux"|"livewire", fieldName: string, attributes: Record<string, string>, element: HTMLElement }}
 */
export function createFileUploadContext(element, source) {
    const wireModel = [...element.attributes].find(({ name }) => {
        return name === "wire:model" || name.startsWith("wire:model.");
    });

    return {
        source,
        fieldName: wireModel?.value || element.getAttribute("name") || "",
        element,
        attributes: Object.fromEntries(
            Object.entries(element.dataset).filter(([name]) => {
                return !["loading", "transforming"].includes(name);
            }),
        ),
    };
}
