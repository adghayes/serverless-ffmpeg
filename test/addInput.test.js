
const nock = require('nock')
const ffmpeg = require('fluent-ffmpeg')

const addInput = require('../lib/addInput.js')
const projectRoot = require('app-root-path')
const filename = projectRoot + '/test/files/cantina.wav'

const input = {
    "download": {
        "url": "https://www.example.com/download",
        "headers": {
            "Authorization": "bearer token"
        }
    }
}

test('throws error if no url specified', () => {
    expect( () => {
        addInput(ffmpeg(), { download: {} })
    }).toThrow()
})

test('throws error if download refused', async () => {
    const scope = nock('https://www.example.com')
        .get('/download')
        .reply(404)
    
    await expect(addInput(ffmpeg(), input)).rejects.toThrow('unavailable')
})

test('resolves to ffmpeg command', async () => {
    nock('https://www.example.com')
        .get('/download')
        .replyWithFile(200, filename, {
            'Content-Type': 'audio/wav'
        })

    await expect(addInput(ffmpeg(), input)).resolves.toBeInstanceOf(ffmpeg)
})

test('adds custom headers', async () => {
    nock('https://www.example.com', {
        reqheaders: input.download.headers
    })
        .get('/download')
        .replyWithFile(200, filename, {
            'Content-Type': 'audio/wav'
        })

    await expect(addInput(ffmpeg(), input)).resolves.toBeInstanceOf(ffmpeg)
})
