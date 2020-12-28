const ffmpeg = require('fluent-ffmpeg')

const addOutputs = require('../lib/addOutputs.js')
const projectRoot = require('app-root-path')
const input = projectRoot + '/test/files/cantina.wav'

const outputs = [
    {
        "format": "webm",
        "audio": {
            "bitrate": 96
        },
        "metadata": {
            "platform": "platform"
        },
        "options": ["-dash 1"],
        "upload": {
            "url": "https://www.example.com/upload/1"
        }
    },
    {
        "format": "mp3",
        "audio":{
            "bitrate": 64
        },
        "upload": {
            "url": "https://www.example.com/upload/3",
        }
    }
]

const expectedFlags =  [
    ['-f webm', '-b:a 96k', '-vn', '-dash 1', '-metadata platform="platform"'],
    ['-f mp3', '-b:a 64k', '-vn']
]

test('throws if no outputs provided', () => {
    expect(() => {
        addOutputs(ffmpeg(input), [])
    }).toThrow()

    expect(() => {
        addOutputs(ffmpeg(input), undefined)
    }).toThrow()
})

test('throws if no format specified', () => {
    expect(() => {
        addOutputs(ffmpeg(input), [{}])
    }).toThrow()
})

test('adds basic audio-only output', done => {
    const command = ffmpeg(input)
    const filename = addOutputs(command, outputs.slice(0, 1))[0]

    command
        .on('start', commandLine => {
            expect(commandLine).toMatch(filename)
            expectedFlags[0].forEach(flag => {
                expect(commandLine).toMatch(flag)
            })
            done()
        })
    command.run()
})

test('adds multiple basic audio-only outputs', done => {
    const command = ffmpeg(input)

    const filenames = addOutputs(command, outputs)
    command
        .on('start', commandLine => {
            filenames.forEach((filename, idx) => {
                expect(commandLine).toMatch(filename)
                expectedFlags[idx].forEach(flag => {
                    expect(commandLine).toMatch(new RegExp(flag + '[^/]*'+ filename))
                })
            })
            done()
        })
    command.run()
})
