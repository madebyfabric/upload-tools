import assert from "node:assert/strict";
import { test } from "node:test";
import {
    getFileUploadProcessorNames,
    processFileUpload,
    processFileUploadOrFallback,
    registerFileUploadProcessor,
    resetFileUploadProcessors,
} from "../src/file-upload-pipeline.js";

if (typeof File === "undefined") {
    globalThis.File = class File {
        constructor(parts, name, options = {}) {
            this.parts = parts;
            this.name = name;
            this.type = options.type ?? "";
            this.lastModified = options.lastModified ?? 0;
        }
    };
}

const makeFile = (name) => new File([name], name, { type: "text/plain" });

test.afterEach(() => resetFileUploadProcessors());

test("normalizes processor names from strings and arrays", () => {
    assert.deepEqual(getFileUploadProcessorNames("one  two"), ["one", "two"]);
    assert.deepEqual(getFileUploadProcessorNames(["one", "", "two"]), [
        "one",
        "two",
    ]);
});

test("runs processors in declaration order and passes normalized context", async () => {
    const calls = [];
    const first = makeFile("first.txt");
    const second = makeFile("second.txt");

    registerFileUploadProcessor("first", (files, context) => {
        calls.push(["first", files, context]);

        return [second];
    });
    registerFileUploadProcessor("second", async (files, context) => {
        calls.push(["second", files, context]);

        return files;
    });

    const result = await processFileUpload([first], "first second", {
        source: "flux",
        fieldName: "documents",
        attributes: { purpose: "test" },
    });

    assert.deepEqual(result, [second]);
    assert.equal(calls[0][0], "first");
    assert.equal(calls[1][0], "second");
    assert.deepEqual(calls[1][2], {
        source: "flux",
        fieldName: "documents",
        attributes: { purpose: "test" },
        element: null,
    });
});

test("falls back to the original files when a processor fails", async () => {
    const original = [makeFile("original.txt")];

    registerFileUploadProcessor("broken", () => {
        throw new Error("failed");
    });

    const result = await processFileUploadOrFallback(original, ["broken"]);

    assert.deepEqual(result, original);
    assert.notEqual(result, original);
});

test("a stale cleanup cannot remove a replacement registration", async () => {
    const firstCleanup = registerFileUploadProcessor("same", () => [
        makeFile("old.txt"),
    ]);
    registerFileUploadProcessor("same", (files) => files);

    assert.equal(firstCleanup(), false);
    assert.equal(
        (await processFileUpload([makeFile("current.txt")], ["same"]))[0]
            .name,
        "current.txt",
    );
});
