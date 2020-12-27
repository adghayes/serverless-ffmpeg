const handler = require('../lib/handler')
const projectRoot = require('app-root-path')
const fs = require('fs')

test('basic event', async () => {
    const event = JSON.parse(fs.readFileSync(projectRoot + '/test/events/basic.json'))
    await handler(event)
})