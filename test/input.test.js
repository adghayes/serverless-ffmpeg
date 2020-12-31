const nock = require("nock");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const tmp = require("tmp");

const { download, probe, addInputOptions } = require("../lib/input.js");

const projectRoot = require("app-root-path");
const testFile = projectRoot + "/test/files/cantina.wav";

const input = {
  download: {
    url: "https://www.example.com/download",
    headers: {
      Authorization: "bearer token",
    },
  },
  seek: 1,
  fps: 60,
};

test("download throws error if no url specified", () => {
  expect(() => {
    download({ download: {} });
  }).toThrow("specified");
});

test("download throws error if download refused", async () => {
  nock("https://www.example.com").get("/download").reply(404);

  await expect(download(input)).rejects.toThrow("unavailable");
});

test("download adds custom headers", async () => {
  const scope = nock("https://www.example.com", {
    reqheaders: input.download.headers,
  })
    .get("/download")
    .replyWithFile(200, testFile);

  await download(input);
  expect(scope.isDone()).toBe(true);
});

test("download creates file", async () => {
  nock("https://www.example.com").get("/download").replyWithFile(200, testFile);

  const createdFile = await download(input);
  expect(fs.existsSync(createdFile)).toBe(true);
});

test("probe returns metadata object", async () => {
  const metadata = await probe(testFile);
  expect(metadata).toHaveProperty("streams");
  expect(metadata).toHaveProperty("format");
});

test("probe attaches metadata to input", async () => {
  await probe(testFile, input);
  expect(input).toHaveProperty("metadata");
});

test("addInputOptions adds options to command", (done) => {
  const tempOutputFile = tmp.tmpNameSync();
  const command = ffmpeg(testFile);
  command.addOutput(tempOutputFile).format("mp3");
  addInputOptions(command, input);

  command.on("start", (commandLine) => {
    ["-ss 1", "-r 60"].forEach((flag) => {
      expect(commandLine).toMatch(flag);
    });
    done();
  });
  command.run();
});
