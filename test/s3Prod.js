const AWS = require('aws-sdk')
AWS.config.signatureVersion = 'v4'
AWS.config.region = 'ca-central-1'
const S3 = new AWS.S3()

const sourceUrl = S3.getSignedUrl('getObject', {
  Key: 'originals/song.aif',
  Bucket: 'ffmpeg-microservice'
})

const mp3Url = S3.getSignedUrl('putObject', {
  Key: 'streams/song.mp3',
  Bucket: 'ffmpeg-microservice'
})

const webmUrl = S3.getSignedUrl('putObject', {
  Key: 'streams/song.webm',
  Bucket: 'ffmpeg-microservice'
})

const event = {
  "input": {
      "download": {
          "url": sourceUrl,
      }
  },
  "outputs": [
      {
          "format": "webm",
          "audio":{
              "bitrate": 96
          },
          "options": ["-dash 1"],
          "upload": {
              "url": webmUrl,
          }
      },
      {
          "format": "mp3",
          "audio":{
              "bitrate": 64
          },
          "upload": {
              "url": mp3Url,
          }
      }
  ]
}

const Lambda = new AWS.Lambda()

Lambda.invoke({
  FunctionName: "ffmpeg-microservice",
  InvocationType: "Event",
  Payload: JSON.stringify(event)
}).send((err, data) => {
  console.log(`err: ${err}`)
  console.log(`data: ${JSON.stringify(data)}`)
})