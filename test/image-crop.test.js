import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.HTMLElement ??= class HTMLElement {};

const { configureCropperImage, waitForStableLayout } = await import(
    "../src/image-crop.js",
);

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

test("waits for the modal stage to settle before initializing", async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const callbacks = [];
    const rects = [
        { left: 10, top: 10, width: 441, height: 441 },
        { left: 20, top: 20, width: 480, height: 480 },
        { left: 30, top: 30, width: 509, height: 509 },
        { left: 30, top: 30, width: 509, height: 509 },
        { left: 30, top: 30, width: 509, height: 509 },
    ];
    let rectIndex = 0;

    globalThis.requestAnimationFrame = (callback) => {
        callbacks.push(callback);
    };

    try {
        const settled = waitForStableLayout(
            {
                getBoundingClientRect: () =>
                    rects[Math.min(rectIndex++, rects.length - 1)],
            },
            () => false,
        );

        while (callbacks.length > 0) {
            callbacks.shift()();
        }

        assert.equal(await settled, true);
        assert.equal(rectIndex, 5);
    } finally {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
});
