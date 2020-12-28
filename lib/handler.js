const ffmpeg = require('fluent-ffmpeg')
const fetch = require('node-fetch')

const { download, addInputOptions, probe } = require('./input')
const { prepForPeaks, getPeaks } = require('./peaks')
const { addOutputs } = require('./output')
const { uploadAll } = require('./upload')

if (process.env.BINARY_DIR){
    ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')
    ffmpeg.setFfprobePath(process.env.BINARY_DIR + 'ffprobe')
}

function log(message){
    if (process.env.FFMPEG_LOG == 1) console.log(message)
}

function transcoding(command){
    return new Promise((resolve, reject) => {
        command
            .on('start', commandLine => log(commandLine))
            .on('progress', progress => log(`${progress.targetSize}KB`))
            .on('error', (err) => reject(err))
            .on('end', () => {
                log('transcoding complete')
                resolve()
            })
            .run()
    })
}

function callback(event){
    if(!event.callback) return Promise.resolved(true)

    const { url, headers, method } = event.callback
    if(!url) throw new Error('no callback url')

    return fetch(url, {
        method: method || 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(event)
    })
    .catch(err => log(err))
    .then(res => {
        undefined
    })
}

async function handler(event){
    try {
        // queue up input
        log('begin download')
        const localInput = await download(event.input)
        log('download complete')
        const command = ffmpeg(localInput)
        const metadata = probe(command, event.input)
        addInputOptions(command, event.input)

        // if peaks are requested, add additional output for analysis
        if(event.peaks) prepForPeaks(event)
        
        // add outputs, run command
        addOutputs(command, event.outputs)
        await transcoding(command)

        // queue uploads
        log('begin uploads')
        const uploads = uploadAll(event.outputs)

        // find peaks from intermediary file, if requested
        const peaks = event.peaks ? getPeaks(event) : Promise.resolve(true)

        // once everthing is processed make callback 
        // TODO: use allSettled and manage errors
        const processes = [...uploads, metadata, peaks]
        return Promise.all(processes)
            .then(() => {
                log('uploads and analysis complete')
                event.status = 200
                return callback(event)
            })
    } catch(e) {
        event.statusText = e.message
        event.status = e.status || 422
        return callback(event)
    }
}

module.exports = handler
