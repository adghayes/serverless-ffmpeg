
const nock = require('nock')
const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')

const { download, probe } = require('../lib/input.js')

const projectRoot = require('app-root-path')
const testFile = projectRoot + '/test/files/cantina.wav'

const input = {
    "download": {
        "url": "https://www.example.com/download",
        "headers": {
            "Authorization": "bearer token"
        }
    }
}

test('download throws error if no url specified', () => {
    expect( () => {
        download({ download: {} })
    }).toThrow('specified')
})

test('download throws error if download refused', async () => {
    nock('https://www.example.com')
        .get('/download')
        .reply(404)
    
    await expect(download(input)).rejects.toThrow('unavailable')
})

test('download adds custom headers', async () => {
    const scope = nock('https://www.example.com', {
        reqheaders: input.download.headers
        })
        .get('/download')
        .replyWithFile(200, testFile)

    await download(input)
    expect(scope.isDone()).toBe(true)
})

test('download creates file', async () => {
    nock('https://www.example.com')
        .get('/download')
        .replyWithFile(200, testFile)

    const createdFile = await download(input)
    expect(fs.existsSync(createdFile)).toBe(true)
})

test('probe returns metadata object', async () => {
    const command = ffmpeg(testFile)
    const metadata = await probe(command)
    expect(metadata).toHaveProperty('streams')
    expect(metadata).toHaveProperty('format')
})

test('probe attaches metadata to input', async () => {
    const command = ffmpeg(testFile)
    await probe(command, input)
    expect(input).toHaveProperty('metadata')
})
