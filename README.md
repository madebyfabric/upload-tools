# Livewire file upload hooks

Reusable browser-side file transformation hooks for Flux file uploads in Laravel Livewire applications.

## Install

```sh
npm install @madebyfabric/livewire-file-upload-hooks
```

The built-in image processors use `cropperjs` and `compressorjs`; they are installed as package dependencies. Import Cropper's stylesheet in the app when using the crop processor:

```js
import "cropperjs/dist/cropper.css";
```

## Quick start

Call the setup function once from the app's browser entry point. It installs the built-in plugins and the Flux adapter without changing the DOM during module import.

```js
import { registerFileUploadHooks } from "@madebyfabric/livewire-file-upload-hooks";

registerFileUploadHooks();
```

Opt out of a built-in plugin when a project does not need it:

```js
registerFileUploadHooks({ processors: ["compression"] });
```

The cleanup function is useful with Vite hot module replacement or when mounting and unmounting an app:

```js
const cleanup = registerFileUploadHooks();

import.meta.hot?.dispose(cleanup);
```

## Marking an upload for transformation

Add the processor names to `data-file-transform` in the order they should run:

```html
<ui-file-upload
    wire:model="photos"
    data-file-transform="image-compression image-crop"
    data-image-crop-modal="photo-crop"
></ui-file-upload>
```

The crop processor expects a Flux modal containing an element with `data-image-crop-editor`, `data-image-crop-stage`, `data-image-crop-image`, `data-image-crop-confirm`, and `data-image-crop-cancel`. Set `data-image-crop-output-size` on the editor to override the default 512px square output.

Compression accepts optional per-upload values through `data-compress-max-dimension` and `data-compress-quality`.

## Plugins and custom processors

A plugin is the extension seam for adding future functionality. It has a name and a `register` function. Inside `register`, use the supplied API to add processors or adapters. The plugin can return a cleanup function.

```js
import {
    registerFileUploadHooks,
    registerFileUploadPlugin,
} from "@madebyfabric/livewire-file-upload-hooks";

const pdfPlugin = {
    name: "pdf-preview",
    register({ registerProcessor }) {
        return registerProcessor("pdf-preview", async (files, context) => {
            // Transform files or coordinate with a project-specific editor.
            return files;
        });
    },
};

registerFileUploadHooks({ plugins: ["compression", "crop", pdfPlugin] });
```

For a plugin that is installed independently, the lower-level installer is also available:

```js
const cleanup = registerFileUploadPlugin(pdfPlugin);
```

### Custom processors

Processors receive the current files and a context object. They may return a new array synchronously or asynchronously.

```js
import { registerFileUploadProcessor } from "@madebyfabric/livewire-file-upload-hooks";

registerFileUploadProcessor("add-prefix", (files, context) => {
    return files.map(
        (file) => new File([file], `upload-${file.name}`, {
            type: file.type,
            lastModified: file.lastModified,
        }),
    );
});
```

```html
<ui-file-upload
    wire:model="document"
    data-file-transform="add-prefix"
    data-upload-purpose="invoice"
></ui-file-upload>
```

`context` contains `source`, `fieldName`, `element`, and plain `data-*` values under `attributes`. If a processor fails, the adapter sends the original files through so an optional transformation cannot make the upload unusable.

## Lower-level exports

The package also exports `processFileUpload`, `processFileUploadOrFallback`, `createFileUploadContext`, `registerFileUploadPlugin`, `registerFluxFileUploadAdapter`, `registerImageCropProcessor`, `registerImageCompressionProcessor`, `cropImageFiles`, and `transformImageFiles` for applications that need custom setup.
