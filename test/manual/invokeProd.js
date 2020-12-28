const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda()
const event = require('./event')

Lambda.invoke({
  FunctionName: "ffmpeg-microservice",
  InvocationType: "Event",
  Payload: JSON.stringify(event)
}).send((err, data) => {
  console.log(`err: ${err}`)
  console.log(`data: ${JSON.stringify(data)}`)
})