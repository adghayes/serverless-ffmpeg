const ffmpeg = require('fluent-ffmpeg')

function ffprobe(filename){
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filename, (err, metadata) => {
            if(err){
                reject(err)
            } else {
                resolve(metadata)
            }
        })
    })
}

function getDuration(filename){
    return ffprobe(filename)
        .then(metadata => metadata.format.duration)
}

module.exports = getDuration