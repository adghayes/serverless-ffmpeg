const AWS = require('aws-sdk')
AWS.config.signatureVersion = 'v4'
const S3 = new AWS.S3()

const timestamp = Math.floor(Date.now() / 10 ** 4)

const sourceUrl = S3.getSignedUrl('getObject', {
  Key: 'originals/big_file.aif',
  Bucket: 'ffmpeg-microservice'
})

const mp3Url = S3.getSignedUrl('putObject', {
  Key: `streams/big_file-${timestamp}.mp3`,
  Bucket: 'ffmpeg-microservice'
})

const webmUrl = S3.getSignedUrl('putObject', {
  Key: `streams/big_file-${timestamp}.webm`,
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

module.exports = event
