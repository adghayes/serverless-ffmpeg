const ffmpeg = require('fluent-ffmpeg')
const tmp = require('tmp')
const path = require('path')
const fs = require('fs')
const streamToPromise = require('stream-to-promise');
const AWS = require('aws-sdk')

const s3 = new AWS.S3()
// ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')
// ffmpeg.setFfprobePath(process.env.BINARY_DIR + 'ffprobe')

function consoleLogTimestamp(message){
    console.log(`[${new Date().toUTCString()}] ${message}`)
} 

exports.handler = async (event) => {
    const bucket = event.Records[0].s3.bucket
    const object = event.Records[0].s3.object

    const inputExt = path.extname(object.key)
    const inputFile = tmp.fileSync()
    const inputWriteStream = fs.createWriteStream(inputFile.name);
    const inputParams = {
        Bucket: bucket.name,
        Key: object.key
    }   
    
    consoleLogTimestamp('Beginning download...')
    const s3ReadStream = s3.getObject(inputParams)
        .createReadStream()
        .pipe(inputWriteStream)

    await streamToPromise(s3ReadStream)
    consoleLogTimestamp('Download successful.')

    const outputFile = tmp.fileSync()
    const transcoding = new Promise((resolve, reject) => {
        consoleLogTimestamp('Beginning transcoding...')
        ffmpeg(inputFile.name)
            .output(outputFile.name)
            .format('webm')
            .noVideo()
            .on('error', (err) => {
                consoleLogTimestamp('Transcoding failed.')
                reject(err)
            })
            .on('end', () => {
                consoleLogTimestamp('Transcoding successful.')
                resolve()
            })
            .run()
    })

    await transcoding


    const outputReadStream = fs.createReadStream(outputFile.name)
    const outputKey = 'streams/'  + path.basename(object.key, inputExt) + '.webm'
    const outputParams = {
        Bucket: 'tuneboon-assets',
        Key: outputKey, 
        Body: outputReadStream
    }

    consoleLogTimestamp('Beginning upload...')
    const upload = s3.putObject(outputParams).promise()
        .then(data => {
            consoleLogTimestamp('Upload successful.')
        })
        .catch(err => {
            consoleLogTimestamp('Upload failed.')
        })
            
    return upload
}