const fs = require("fs");

const handler = require("../lib/handler");
const {
  downloadNock,
  railsNock,
  uploadNock,
  successNock,
  failureNock,
} = require("./helpers.js");

const projectRoot = require("app-root-path");
const inputFile = projectRoot + "/test/files/cantina.wav";
const outputFiles = ["webm", "mp3"].map(
  (ext) => projectRoot + "/test/files/cantina." + ext
);

test("basic event", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/basic.json")
  );
  const downloadScope = downloadNock(inputFile, "basic");
  const uploadScopes = outputFiles.map((outputFile, idx) =>
    uploadNock(outputFile, `basic-${idx}`)
  );
  const successScope = successNock("basic");

  await handler(event);

  expect(downloadScope.isDone()).toBe(true);
  uploadScopes.forEach((scope) => expect(scope.isDone()).toBe(true));
  expect(successScope.isDone()).toBe(true);
});

test("rails event", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/rails.json")
  );
  const downloadScope = downloadNock(inputFile, "rails");
  const railsScopes = outputFiles.map((outputFile, idx) =>
    railsNock(outputFile, `rails-${idx}`)
  );
  const uploadScopes = outputFiles.map((outputFile, idx) =>
    uploadNock(outputFile, `rails-${idx}`)
  );
  const successScope = successNock("rails", null, true);

  await handler(event);

  expect(downloadScope.isDone()).toBe(true);
  railsScopes.forEach((scope) => expect(scope.isDone()).toBe(true));
  uploadScopes.forEach((scope) => expect(scope.isDone()).toBe(true));
  expect(successScope.isDone()).toBe(true);
});

test("peaks event", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/peaks.json")
  );
  const downloadScope = downloadNock(inputFile, "peaks");
  const uploadScope = uploadNock(outputFiles[0], "peaks");
  const successScope = successNock("peaks", event.peaks.count, false);

  await handler(event);

  expect(downloadScope.isDone()).toBe(true);
  expect(uploadScope.isDone()).toBe(true);
  expect(successScope.isDone()).toBe(true);
});

test("failure callback on ffmpeg failure", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/badFormat.json")
  );
  downloadNock(inputFile, "badFormat");
  const failureScope = failureNock("badFormat");

  await handler(event);
  expect(failureScope.isDone()).toBe(true);
});

test("failure callback on download errors", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/noAuth.json")
  );
  downloadNock(inputFile, "noAuth");
  const failureScope = failureNock("noAuth");

  await handler(event);
  expect(failureScope.isDone()).toBe(true);
});

test("throws error if no callback", async () => {
  const event = JSON.parse(
    fs.readFileSync(projectRoot + "/test/events/noCallback.json")
  );

  expect.assertions(1);

  handler(event).catch((err) => expect(err).toBeTruthy());
});
