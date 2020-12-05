const { handler } = require('./index.js')

const event = {
    "Records": [
      {
        "eventVersion": "2.0",
        "eventSource": "aws:s3",
        "awsRegion": "ca-central-1",
        "eventTime": "2020-12-01T00:00:00.000Z",
        "eventName": "ObjectCreated:Put",
        "userIdentity": {
          "principalId": "086163355854"
        },
        "requestParameters": {
          "sourceIPAddress": "127.0.0.1"
        },
        "responseElements": {
          "x-amz-request-id": "EXAMPLE123456789",
          "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH"
        },
        "s3": {
          "s3SchemaVersion": "1.0",
          "configurationId": "testConfigRule",
          "bucket": {
            "name": "tuneboon-originals",
            "ownerIdentity": {
              "principalId": "086163355854"
            },
            "arn": "arn:aws:s3:::tuneboon-originals"
          },
          "object": {
            "key": "blackbird.aif",
            "size": 9738942,
            "eTag": "9cfe7ed7b5b47c070490baf661e28070-2",
            "sequencer": "0A1B2C3D4E5F678901"
          }
        }
      }
    ]
  }

handler(event)