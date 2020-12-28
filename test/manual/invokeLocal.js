const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ 
    endpoint: 'http://127.0.0.1:3002'
})
const event = require('./event')

Lambda.invoke({
    FunctionName: "ffmpeg-microservice-dev-transcode",
    InvocationType: "Event",
    Payload: JSON.stringify(event)
  }).send((err, data) => {
    console.log(`err: ${err}`)
    console.log(`data: ${JSON.stringify(data)}`)
  })