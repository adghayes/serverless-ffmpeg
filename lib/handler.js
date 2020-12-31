const ffmpeg = require("fluent-ffmpeg");
const fetch = require("node-fetch");

const { download, addInputOptions, probe } = require("./input");
const { prepForPeaks, getPeaks } = require("./peaks");
const { addOutputs } = require("./output.js");
const { uploadAll } = require("./upload");

if (process.env.BINARY_DIR) {
  ffmpeg.setFfmpegPath(process.env.BINARY_DIR + "ffmpeg");
  ffmpeg.setFfprobePath(process.env.BINARY_DIR + "ffprobe");
}

function log(message) {
  if (process.env.FFMPEG_LOG == 1) console.log(message);
}

function transcoding(command) {
  return new Promise((resolve, reject) => {
    command
      .on("start", (commandLine) => log(commandLine))
      .on("codecData", (data) => log(data))
      .on("progress", (progress) => log(`${Math.floor(progress.percent * 10) / 10}% complete`))
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .run();
  });
}

function callback(event) {
  if (!event.callback || !event.callback.url)
    throw new Error("no callback specified");

  const { url, headers, method } = event.callback;
  return fetch(url, {
    method: method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(event),
  }).then((res) => log(`callback status ${res.status}: ${res.statusText}`));
}

async function handler(event) {
  try {
    // queue up input
    log("begin download");
    const localInput = await download(event.input);
    log("download complete");
    const command = ffmpeg(localInput);
    addInputOptions(command, event.input);

    // if peaks are requested, add additional output for analysis
    if (event.peaks) prepForPeaks(event);

    // add outputs, run command
    addOutputs(command, event.outputs);
    await transcoding(command);
    log("transcoding complete - begin uploads and analysis");

    // set up all our actions, probing, uploading and finding peaks
    const actions = [];
    actions.push(probe(localInput, event.input));
    actions.push(...uploadAll(event.outputs));
    actions.push(event.peaks ? getPeaks(event) : Promise.resolve());

    // once everthing is processed make callback
    // TODO: use allSettled and manage errors
    await Promise.all(actions);
    log("uploads and analysis complete");
    event.status = 200;
    return callback(event);
  } catch (e) {
    event.statusText = e.message;
    event.status = e.status || 422;
    return callback(event);
  }
}

module.exports = handler;
