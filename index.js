const ffmpeg = require('fluent-ffmpeg')
const tmp = require('tmp')
const path = require('path')
const fs = require('fs')

const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const isHostedOnAWS = !!(process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV)
if(isHostedOnAWS){
    ffmpeg.setFfmpegPath(process.env.BINARY_DIR + 'ffmpeg')
    ffmpeg.setFfprobePath(process.env.BINARY_DIR + 'ffprobe')
}

function consoleLogTimestamp(message){
    console.log(isHostedOnAWS ? message : `[${new Date().toUTCString()}] ${message}`)
} 

const outputSpecs = [
    {
        'format': 'webm',
        'bitrate': 96
    },
    {
        'format': 'mp3',
        'bitrate': 128
    }
]

function addOutput(ffmpegCommand, output){
    return ffmpegCommand.output(output.file.name)
        .format(output.spec.format)
        .audioBitrate(output.spec.bitrate)
        .noVideo()
        .outputOptions('-metadata platform="tunegrid"')
}

function notifyApp(outputs){
    // POST output info to main app, could be promise or synchronous
}

exports.handler = async (event) => {
    const bucket = event.Records[0].s3.bucket
    const object = event.Records[0].s3.object

    const inputExt = path.extname(object.key)
    const basename = path.basename(object.key, inputExt)
    
    const s3Download = s3.getObject({
            Bucket: bucket.name,
            Key: object.key
        }).createReadStream()

    const outputs = outputSpecs.map(outputSpec => {
        return {
            file: tmp.fileSync(),
            spec: outputSpec
        }
    })

    const command = ffmpeg(s3Download)
    outputs.forEach(output => addOutput(command, output))
    const transcoding = new Promise((resolve, reject) => {
        command.on('start', commandLine => {
            consoleLogTimestamp(`Starting transcoding: ${commandLine}`)
        }).on('progress', progress => {
            consoleLogTimestamp(`Processing: ${progress.targetSize}KB output`);
        }).on('error', (err) => {
            consoleLogTimestamp(`Transcoding failed: ${err.message}`)
            reject(err)
        }).on('end', () => {
            consoleLogTimestamp('Transcoding successful.')
            resolve()
        }).run()
    })

    await transcoding

    const uploads = outputs.map(output => {
        consoleLogTimestamp(`Beginning .${output.spec.format} upload`)
        return s3.putObject({
            Bucket: 'tuneboon-assets',
            Key: 'streams/'  + basename + '.' + output.spec.format, 
            Body: fs.createReadStream(output.file.name)
        }).promise().catch(err => {
            consoleLogTimestamp(`Upload failed: ${err.message}`)
        })
    })
            
    return Promise.all(uploads)
        .then(() => {
            consoleLogTimestamp('Uploads complete.')
            return notifyApp()
        }).catch(err => {
            consoleLogTimestamp(`Notification failed: ${err.message}`)
        })
}