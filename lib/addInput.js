const fetch = require('node-fetch')

// returns a promise for a readable stream download
function download(download){
    return fetch(download.url, {
        method: "GET",
        headers: download.headers || {}
    })
    .then(res => {
        if (res.ok) return res.body

        const error = new Error(`resource unavailable: ${res.statusText}`)
        error.status = res.status
        throw error
    })
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

// returns a promise for a run-able ffmpeg command
function addInput(command, input){
    if(!input || !input.download || !input.download.url) {
        throw new Error('input url must be specified')
    } 

    return download(input.download)
        .then(download => {
            command.input(download)
            addInputOptions(command, input)

            return command
        })
}

module.exports = addInput
