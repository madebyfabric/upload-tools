import assert from "node:assert/strict";
import { test } from "node:test";
import {
    processFileUpload,
    registerFileUploadProcessor,
    resetFileUploadProcessors,
} from "../src/file-upload-pipeline.js";
import { registerFileUploadPlugin } from "../src/file-upload-plugin.js";

if (typeof File === "undefined") {
    globalThis.File = class File {
        constructor(parts, name) {
            this.parts = parts;
            this.name = name;
        }
    };
}

test.afterEach(() => resetFileUploadProcessors());

test("installs processor and adapter registrations behind one cleanup seam", async () => {
    let adapterInstalled = false;
    let adapterRemoved = false;

    const cleanup = registerFileUploadPlugin({
        name: "test-plugin",
        register({ registerProcessor, registerAdapter }) {
            const processorCleanup = registerProcessor(
                "test-plugin-transform",
                (files) => files,
            );
            const adapterCleanup = registerAdapter(() => {
                adapterInstalled = true;

                return () => {
                    adapterRemoved = true;

                    return true;
                };
            });

            assert.equal(typeof adapterCleanup, "function");

            return processorCleanup;
        },
    });

    assert.equal(adapterInstalled, true);
    assert.equal(
        (await processFileUpload([new File([], "test.txt")], [
            "test-plugin-transform",
        ])).length,
        1,
    );
    assert.equal(cleanup(), true);
    assert.equal(adapterRemoved, true);
    assert.equal(cleanup(), false);
});

test("rejects plugins without a name or register function", () => {
    assert.throws(
        () => registerFileUploadPlugin({ register() {} }),
        /non-empty name/,
    );
    assert.throws(
        () => registerFileUploadPlugin({ name: "invalid" }),
        /register function/,
    );
});

test("rolls back registrations when plugin setup fails", () => {
    let adapterRemoved = false;

    assert.throws(
        () =>
            registerFileUploadPlugin({
                name: "broken-plugin",
                register({ registerProcessor, registerAdapter }) {
                    registerProcessor("leaked-processor", (files) => files);
                    registerAdapter(() => () => {
                        adapterRemoved = true;

                        return true;
                    });
                    throw new Error("setup failed");
                },
            }),
        /setup failed/,
    );

    assert.equal(adapterRemoved, true);
    return processFileUpload([new File([], "test.txt")], ["leaked-processor"])
        .then(([file]) => assert.equal(file.name, "test.txt"));
});
