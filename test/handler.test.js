const fs = require('fs')

const handler = require('../lib/handler')
const { downloadNock, railsNock, uploadNock, 
    callbackNock, failureNock } = require('./helpers.js')

const projectRoot = require('app-root-path')
const inputFile = projectRoot + '/test/files/cantina.wav'
const outputFiles = ['webm', 'mp3'].map(ext => projectRoot + '/test/files/cantina.' + ext)

test('basic event', async () => {
    const event = JSON.parse(fs.readFileSync(projectRoot + '/test/events/basic.json'))
    const downloadScope = downloadNock(inputFile, 'basic')
    const uploadScopes = outputFiles.map((outputFile, idx) => {
        return uploadNock(outputFile, `basic-${idx}`, false)
    })
    const callbackScope = callbackNock('basic', event.peaks.count)

    await handler(event)
    expect(downloadScope.isDone()).toBe(true)
    uploadScopes.forEach(scope => expect(scope.isDone()).toBe(true))
    expect(callbackScope.isDone()).toBe(true)
})

test('rails event', async () => {
    const event = JSON.parse(fs.readFileSync(projectRoot + '/test/events/rails.json'))
    const downloadScope = downloadNock(inputFile, 'rails')
    const railsScopes = outputFiles.map((outputFile, idx) => {
        return railsNock(outputFile, `rails-${idx}`, false)
    })
    const uploadScopes = outputFiles.map((outputFile, idx) => {
        return uploadNock(outputFile, `rails-${idx}`, false)
    })
    const callbackScope = callbackNock('rails', event.peaks.count, true)

    await handler(event)

    expect(downloadScope.isDone()).toBe(true)
    railsScopes.forEach(scope => expect(scope.isDone()).toBe(true))
    uploadScopes.forEach(scope => expect(scope.isDone()).toBe(true))
    expect(callbackScope.isDone()).toBe(true)
})

test('failure callback', async () => {
    const event = JSON.parse(fs.readFileSync(projectRoot + '/test/events/invalid-codec.json'))
    downloadNock(inputFile, 'invalid-codec')
    const callbackScope = failureNock('invalid-codec')

    await handler(event)
    expect(callbackScope.isDone()).toBe(true)
})