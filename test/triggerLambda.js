const AWS = require('aws-sdk')
const event = require('./testEvent.js')
const Lambda = new AWS.Lambda()

Lambda.invoke({
  FunctionName: "ffmpeg-microservice",
  InvocationType: "Event",
  Payload: JSON.stringify(event)
}).send((err, data) => {
  console.log(`err: ${err}`)
  console.log(`data: ${data}`)
})