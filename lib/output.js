const tmp = require("tmp");

// returns the temporary filenames that will be used to save the outputs
function addOutputs(command, outputs) {
  if (!outputs || !outputs.length || outputs.length < 1)
    throw new Error("output(s) must be specified");
  return outputs.map((output) => addOutput(command, output));
}

// returns the temporary filename that will be used to save the output
function addOutput(command, output) {
  if (!output.format) throw new Error("output format must be specified");
  if (output.video === false && output.audio === false)
    throw new Error(`no audio or video indicated for ${output.format}`);

  output.local = tmp.tmpNameSync();
  command.output(output.local).format(output.format);

  addGeneralOptions(command, output);
  addAudioOptions(command, output.audio);
  addVideoOptions(command, output.video);

  return output.local;
}

function addGeneralOptions(command, output) {
  if (output.duration) command.duration(output.duration);
  if (output.seek) command.seek(output.seek);
  if (output.options) command.outputOptions(output.options);
  if (output.metadata) {
    for (const [key, value] of Object.entries(output.metadata)) {
      command.outputOptions(`-metadata ${key}="${value}"`);
    }
  }
}

function addAudioOptions(command, options) {
  if (options === false) {
    command.noAudio();
  } else if (options) {
    if (options.codec) command.audioCodec(options.codec);
    if (options.bitrate) command.audioBitrate(options.bitrate);
    if (options.channels) command.audioChannels(options.channels);
    if (options.frequency) command.audioFrequency(options.frequency);
    if (options.quality) command.audioQuality(options.quality);
    if (options.filters) command.audioFilters(options.filters);
  }
}

function addVideoOptions(command, options) {
  if (options === false) {
    command.noVideo();
  } else if (options) {
    if (options.codec) command.videoCodec(options.codec);
    if (options.bitrate) command.videoBitrate(options.bitrate, options.constantBitrate);
    if (options.filters) command.videoFilters(options.filters);
    if (options.fps) command.fps(options.fps);
    if (options.frames) command.frames(options.frames);
    if (options.size) command.size(options.size);
    if (options.aspect) command.aspect(options.aspect);
    if (options.autopad) {
      typeof options.autopad === "string"
        ? command.autopad(options.autopad)
        : command.autopad();
    }
    if (options.keepDAR) command.keepDAR();
  }
}

module.exports = { addOutputs, addOutput };
