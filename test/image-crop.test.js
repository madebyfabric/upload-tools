import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.HTMLElement ??= class HTMLElement {};

const { configureCropperImage } = await import("../src/image-crop.js");

test("fits the cropper image using the current initial-fit API", async () => {
    const calls = [];
    const image = {
        initialCenterSize: "",
        initialFit: "contain",
        scalable: false,
        $ready() {
            calls.push({ type: "ready" });

            return Promise.resolve();
        },
        $resetTransform() {
            calls.push({ type: "reset", scalable: this.scalable });
        },
        $center(fit) {
            calls.push({ type: "center", fit, scalable: this.scalable });
        },
    };

    await configureCropperImage(image);

    assert.equal(image.initialFit, "cover");
    assert.equal(image.initialCenterSize, "");
    assert.deepEqual(calls, [
        { type: "ready" },
        { type: "reset", scalable: true },
        { type: "center", fit: "cover", scalable: true },
    ]);
    assert.equal(image.scalable, false);
});
