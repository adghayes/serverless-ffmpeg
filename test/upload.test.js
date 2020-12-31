const path = require("path");
const fs = require("fs");
const nock = require("nock");
const cloneDeep = require("lodash.clonedeep");

const {
  uploadAll,
  upload,
  basicUpload,
  railsUpload,
  railsBlob,
} = require("../lib/upload.js");

const { size, type, checksum, auth } = require("./helpers.js");

const projectRoot = require("app-root-path");
const testFile = projectRoot + "/test/files/mini.wav";

const outputBase = {
  local: testFile,
  format: path.extname(testFile),
  upload: {
    byteSize: size(testFile),
    contentType: type(testFile),
  },
};

test("basicUpload PUTS exact file to URL", async () => {
  const scope = nock("https://www.example.com")
    .put(`/upload/exact`, fs.readFileSync(testFile))
    .reply(200);

  const output = cloneDeep(outputBase);
  output.upload.url = "https://www.example.com/upload/exact";

  await basicUpload(output);
  expect(scope.isDone()).toBe(true);
});

test("basicUpload PUTS to specified URL with required headers", async () => {
  const scope = nock("https://www.example.com", {
    reqheaders: {
      "Content-Type": type(testFile),
      "Content-Length": size(testFile),
      ...auth("upload"),
    },
  })
    .put(`/upload/headers`)
    .reply(200);

  const output = cloneDeep(outputBase);
  output.upload.url = "https://www.example.com/upload/headers";
  output.upload.headers = auth("upload");

  await basicUpload(output);
  expect(scope.isDone()).toBe(true);
});

const railsOutput = cloneDeep(outputBase);
railsOutput.upload.name = "anything";
railsOutput.upload.headers = auth("rails");
railsOutput.upload.type = "rails";

test("railsBlob POSTS blob attributes", async () => {
  const scope = nock("https://www.example.com")
    .post(`/rails/attributes`, {
      blob: {
        filename: /.*/,
        content_type: type(testFile),
        byte_size: size(testFile),
        checksum: checksum(testFile),
      },
    })
    .reply(200, {});

  const output = cloneDeep(railsOutput);
  output.upload.url = "https://www.example.com/rails/attributes";

  await railsBlob(output);
  expect(scope.isDone()).toBe(true);
});

test("railsBlob POSTS necessary headers", async () => {
  const scope = nock("https://www.example.com", {
    reqheaders: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...auth("rails"),
    },
  })
    .post(`/rails/headers`)
    .reply(200, {});

  const output = cloneDeep(railsOutput);
  output.upload.url = "https://www.example.com/rails/headers";

  await railsBlob(output);
  expect(scope.isDone()).toBe(true);
});

test("railsUpload", async () => {
  const railsScope = nock("https://www.example.com")
    .post(`/rails/upload`)
    .reply(200, {
      signed_id: 1,
      direct_upload: {
        url: `https://www.example.com/upload/railsDirect`,
        headers: auth("upload"),
      },
    });

  const uploadScope = nock("https://www.example.com", {
    reqheaders: auth("upload"),
  })
    .put(`/upload/railsDirect`)
    .reply(200);

  const output = cloneDeep(railsOutput);
  output.upload.url = "https://www.example.com/rails/upload";

  const { signedId, upload } = await railsUpload(output);

  expect(signedId).toBeTruthy();
  expect(railsScope.isDone()).toBe(true);

  await upload;
  expect(uploadScope.isDone()).toBe(true);
});

test("upload inserts content-length and content-type", async () => {
  const scope = nock("https://www.example.com", {
    reqheaders: {
      "Content-Type": type(testFile),
      "Content-Length": size(testFile),
    },
  })
    .put(`/upload/type`)
    .reply(200);

  const output = cloneDeep(outputBase);
  output.upload.url = "https://www.example.com/upload/type";

  await upload(output);
  expect(scope.isDone()).toBe(true);
});

test("uploadAll handles multiple uploads of varying types", async () => {
  const railsScope = nock("https://www.example.com")
    .post(`/rails/multiple`)
    .reply(200, {
      direct_upload: { url: `https://www.example.com/upload/multiple` },
    });

  const uploadScope = nock("https://www.example.com")
    .put(`/upload/multiple`)
    .twice()
    .reply(200);

  const basicOutput = cloneDeep(outputBase);
  basicOutput.upload.url = "https://www.example.com/upload/multiple";

  const railsOutputClone = cloneDeep(railsOutput);
  railsOutputClone.upload.url = `https://www.example.com/rails/multiple`;

  const outputs = [railsOutputClone, basicOutput];
  await Promise.all(uploadAll(outputs));

  expect(railsScope.isDone()).toBe(true);
  expect(uploadScope.isDone()).toBe(true);
});
