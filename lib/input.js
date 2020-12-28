const fetch = require('node-fetch')
const tmp = require('tmp')
const fs = require('fs')

// returns a promise for a readable stream download
function download(input){
    if(!input || !input.download || !input.download.url) {
        throw new Error('No downloadable input specified')
    }

    const localInput = tmp.tmpNameSync()
    return fetch(input.download.url, {
        method: "GET",
        headers: input.download.headers || {}
    })
    .then(res => {
        if (res.ok) return res.body

        const error = new Error(`resource unavailable: ${res.statusText}`)
        error.status = res.status
        throw error
    }).then(body => new Promise((resolve, reject) => {
        body.pipe(fs.createWriteStream(localInput))
        body.on('error', err => reject(err))
        body.on('end', () => {
            input.local = localInput
            resolve(localInput) 
        })
    }))
}


function addInputOptions(command, input){
    if (input.format) command.inputFormat(input.format)
    if (input.seek) command.seekInput(input.seek)
    if (input.fps) command.inputFPS(input.fps)
    if (input.native) command.native()
    if (input.options) command.inputOptions(input.options)
    if (input.loop){
        typeof input.loop === 'boolean' ? command.loop() : command.loop(input.loop)
    }
}

function probe(command, input){
    return new Promise((resolve, reject) => {
        command.ffprobe((err, metadata) => {
            if(err){
                reject(err)
            } else {
                if(input) input.metadata = metadata
                resolve(metadata)
            }
        })
    })
}

module.exports = { download, addInputOptions, probe }
