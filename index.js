const ffmpeg = require('fluent-ffmpeg')
const fetch = require('node-fetch')
const fs = require('fs')
const tmp = require('tmp')
const mime = require('mime-types')

const isHostedOnAWS = !!(process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV)
if(isHostedOnAWS) ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')

function log(message){
    console.log(isHostedOnAWS ? message : `[${new Date().toUTCString()}] ${message}`)
}

// returns the name of the temporary file the output will be saved to
function addOutput(command, output){
    if (!output.format) throw new Error('output format must be specified')
    if (!output.destination) throw new Error('no output destination specified')
    
    const filename = tmp.tmpNameSync()
    command.output(filename)
        .format(output.format)
        .noVideo()

    // audio-specific options
    if (output.codec) command.audioCodec(output.codec)
    if (output.bitrate) command.audioBitrate(output.bitrate)
    if (output.channels) command.audioChannels(output.channels)
    if (output.frequency) command.audioFrequency(output.frequency)
    if (output.quality) command.audioQuality(output.quality)
    if (output.filters && output.filters.length > 0) command.audioFilters(output.filters)

    // general output options
    if (output.duration) command.duration(output.duration)
    if (output.seek) command.seek(output.seek)
    if (output.options && output.options.length > 0) command.outputOptions(output.options) 
    if (output.metadata) {
        for (const [key, value] in Object.entries(output.metadata)){
            command.outputOptions(`-metadata ${key}="${value}"`)
        }
    }

    return filename
}

// returns a promise for the download as a readable stream
function download(resource){
    return fetch(resource)
        .catch(err => log(`failed to connect for download: ${err.message}`))
        .then(res => {
            if (res.status !== 200) log(`resource not accessible: ${statusText}`)
            return res.body
                .on('finish', () => log('download complete'))
                .on('error', err => log(`download error: ${err.message}`))
        })
}

// returns the command
function addInput(command, input, download){
    command.input(download)

    if (input.format) command.imputFormat(input.format)
    if (input.seek) command.seekInput(input.seek)
    if (input.options && input.options.length > 0){
        command.inputOptions(input.options)
    }

    return command
}

// returns a promise for the transcoding
function transcodingPromise(command, input){
    return new Promise((resolve, reject) => {
        command
            .on('start', commandLine => {
                log(`starting transcoding: ${commandLine}`)
            }).on('progress', progress => {
                log(`processing: ${progress.targetSize}KB output`);
            }).on('error', (err) => {
                log(`transcoding failed: ${err.message}`)
                reject(err)
            }).on('end', () => {
                log('transcoding successful')
                resolve()
            }).run()
    })
}

// returns a promise for the file upload
function upload(output, filename){
    log(`starting .${output.format} upload`)
    return fetch(output.destination, {
        method: 'PUT',
        body: fs.createReadStream(filename),
        headers: {
            'Content-Length': fs.statSync(filename).size,
            'Content-Type': mime.lookup(output.format)
        }
    })
}

function notify(event){
    // POST output info to main app, could be promise or synchronous
}

exports.handler = async (event) => { 
    const command = ffmpeg()
    const outputFilenames = event.outputs.map(output => addOutput(command, output))
    if(!event.input.source) throw new Error('no input source specified')
    
    await download(event.input.source)
        .then(download => addInput(command, event.input, download))
        .then(command => transcodingPromise(command))

    const uploads = event.outputs.map((output, i) => upload(output, outputFilenames[i]))
            
    return Promise.all(uploads)
        .then(() => {
            log('uploads complete')
            return notify(event)
        })
}
