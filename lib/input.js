const fetch = require("node-fetch");
const tmp = require("tmp");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

// returns a promise for a readable stream download
function download(input) {
  if (!input || !input.download || !input.download.url) {
    throw new Error("no downloadable input specified");
  }

  const localInput = tmp.tmpNameSync();
  return fetch(input.download.url, {
    method: "GET",
    headers: input.download.headers || {},
  })
    .then((res) => {
      if (res.ok) return res.body;

      const error = new Error(`resource unavailable: ${res.statusText}`);
      error.status = res.status;
      throw error;
    })
    .then(
      (body) =>
        new Promise((resolve, reject) => {
          body.pipe(fs.createWriteStream(localInput));
          body.on("error", (err) => reject(err));
          body.on("end", () => {
            input.local = localInput;
            resolve(localInput);
          });
        })
    );
}

function addInputOptions(command, input) {
  if (input.format) command.inputFormat(input.format);
  if (input.seek) command.seekInput(input.seek);
  if (input.fps) command.inputFPS(input.fps);
  if (input.native) command.native();
  if (input.options) command.inputOptions(input.options);
}

function probe(file, input) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        if (input) input.metadata = metadata;
        resolve(metadata);
      }
    });
  });
}

module.exports = { download, addInputOptions, probe };
