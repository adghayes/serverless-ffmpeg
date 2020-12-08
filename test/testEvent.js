const AWS = require('aws-sdk')
AWS.config.signatureVersion = 'v4'
AWS.config.region = 'ca-central-1'
const S3 = new AWS.S3()

const sourceUrl = S3.getSignedUrl('getObject', {
  Key: 'song.aif',
  Bucket: 'tuneboon-originals'
})

const mp3Url = S3.getSignedUrl('putObject', {
  Key: 'streams/song.mp3',
  Bucket: 'tuneboon-assets'
})

const webmUrl = S3.getSignedUrl('putObject', {
  Key: 'streams/song.webm',
  Bucket: 'tuneboon-assets'
})

const event = {
  "input": {
      "source": sourceUrl
  },
  "outputs": [
      {
          "bitrate": "96",
          "format":"webm",
          "options":[],
          "metadata":{
              "platform":"tunegrid"
          },
          "destination": webmUrl
      },
      {
        "bitrate": "128",
        "format":"mp3",
        "options":[],
        "metadata":{
            "platform":"tunegrid"
        },
        "destination": mp3Url
    }
  ]
}

module.exports = event