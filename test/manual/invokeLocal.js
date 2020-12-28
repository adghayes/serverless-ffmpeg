const AWS = require('aws-sdk')
const ep = new AWS.Endpoint('http://127.0.0.1:9001')
const Lambda = new AWS.Lambda({ 
    endpoint: ep
})
const event = require('./event')

Lambda.invoke({
    FunctionName: "ffmpeg-microservice",
    InvocationType: "Event",
    Payload: JSON.stringify(event)
  }).send((err, data) => {
    console.log(`err: ${err}`)
    console.log(`data: ${JSON.stringify(data)}`)
  })