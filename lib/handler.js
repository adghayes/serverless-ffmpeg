const ffmpeg = require('fluent-ffmpeg')
const fetch = require('node-fetch')
const cloneDeep = require('lodash.clonedeep')

const addOutputs = require('./addOutputs.js')
const addInput = require('./addInput.js')
const { peakInput, PeakFinder } = require('./peaks.js')
const uploadAll = require('./upload')

ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')

// returns a promise for the transcoding
function transcodingPromise(command, event){
    return new Promise((resolve, reject) => {
        command
            .on('start', commandLine => console.log(`begin transcoding: ${commandLine}`))
            .on('progress', progress => console.log(`transcoded ${progress.targetSize}KB`))
            .on('error', (err) => reject(err))
            .on('codecData', data => {
                event.input = data
                console.log(`input codec info: ${data}`)
            })
            .on('end', () => {
                console.log('transcoding successful')
                resolve()
            })
            .run()
    })
}

function callback(event){
    const {url, headers, method } = event.callback
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


async function handler(event){
    const command = ffmpeg()
    try {
        const localOutputs = cloneDeep(event.outputs)
        let peaksCount
        if (event.peaks && event.peaks.count){
            peaksCount = event.peaks.count
            localOutputs.push(peakInput(event.peaks.quality))
        }
        const outputFilenames = addOutputs(command, localOutputs)

        await addInput(command, event.input)
        await transcodingPromise(command, event)
        const uploads = uploadAll(outputFilenames, event.outputs)

        if (peaksCount){
            const rawFilename = outputFilenames[outputFilenames.length - 1]
            let peaks = (new PeakFinder(peaksCount)).getPeaks(rawFilename)
            event.peaks = await peaks
        }
        
        return Promise.all(uploads)
            .then(() => {
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
