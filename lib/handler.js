const ffmpeg = require('fluent-ffmpeg')
const fetch = require('node-fetch')
const cloneDeep = require('lodash.clonedeep')
const dotenv = require("dotenv")
dotenv.config()

const addOutputs = require('./addOutputs')
const addInput = require('./addInput')
const uploadAll = require('./upload').default
const getDuration = require('./duration')
const Peaks = require('./peaks')

ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')
ffmpeg.setFfprobePath(process.env.BINARY_DIR + 'ffprobe')

function log(message){
    if (process.env.FFMPEG_LOG == 1) console.log(message)
}

// returns a promise for the transcoding
function transcoding(command, event){
    return new Promise((resolve, reject) => {
        command
            .on('start', commandLine => log(`begin transcoding: ${commandLine}`))
            .on('progress', progress => log(`transcoded ${progress.targetSize}KB`))
            .on('error', (err) => reject(err))
            .on('codecData', data => {
                event.codecData = data
                log(JSON.stringify(data))
            })
            .on('end', () => {
                log('transcoding successful')
                resolve()
            })
            .run()
    })
}

function callback(event){
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
}

function parseDuration(string){
    let sum = 0
    const parts = string.split(':')
    for(let i = 0; i < parts.length; i += 1){
        sum += parseFloat(parts[parts.length - 1 - i]) * 60 ** i
    }
    return sum
}

async function handler(event){
    try {
        // if peaks are requested, create additional raw output for local analysis
        const localOutputs = cloneDeep(event.outputs)
        let peaksCount = event.peaks && event.peaks.count
        if (peaksCount) localOutputs.push(Peaks.input(event.peaks.quality))
        
        // prepare command, run command, and begin file uploads
        const command = ffmpeg()
        const outputFilenames = addOutputs(command, localOutputs)
        await addInput(command, event.input)
        await transcoding(command, event)
        const uploads = uploadAll(outputFilenames, event.outputs)

        // postprocessing for duration and optionally peaks
        let duration = event.codecData.duration
        if(duration === 'N/A'){
            duration = getDuration(outputFilenames[0])
        } else {
            duration = parseDuration(duration)
        }

        if (peaksCount){
            const pcm = outputFilenames[outputFilenames.length - 1]
            let peaks = (new Peaks.Finder(peaksCount)).getPeaks(pcm)
            event.peaks = await peaks
        }
        event.codecData.duration = await duration

        // once all uploads are resolved, make callback
        return Promise.all(uploads)
            .then(() => {
                log('all uploads successful')
                event.status = 200
                if(event.callback) return callback(event)
            })

    } catch(e) {
        event.statusText = e.message
        event.status = e.status || 422
        if(event.callback) return callback(event)
    }
}

module.exports = handler
