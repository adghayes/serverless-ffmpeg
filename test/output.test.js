const ffmpeg = require('fluent-ffmpeg')

const { addOutputs, addOutput } = require('../lib/output.js')
const projectRoot = require('app-root-path')
const testFile = projectRoot + '/test/files/cantina.wav'

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

test('addOutputs throws if zero outputs provided', () => {
    expect(() => {
        addOutputs(ffmpeg(testFile), [])
    }).toThrow()

    expect(() => {
        addOutputs(ffmpeg(testFile))
    }).toThrow()
})

test('addOutput throws if no format specified', () => {
    expect(() => {
        addOutput(ffmpeg(testFile), {})
    }).toThrow()
})

test('addOutput adds basic audio-only output', done => {
    const command = ffmpeg(testFile)
    const outputFile = addOutput(command, outputs[0])

    command
        .on('start', commandLine => {
            expect(commandLine).toMatch(outputFile)
            expectedFlags[0].forEach(flag => {
                expect(commandLine).toMatch(flag)
            })
            done()
        })
    command.run()
})

test('addOutput adds multiple outputs', done => {
    const command = ffmpeg(testFile)
    const outputFiles = addOutputs(command, outputs)

    command
        .on('start', commandLine => {
            outputFiles.forEach((outputFile, idx) => {
                expect(commandLine).toMatch(outputFile)
                expectedFlags[idx].forEach(flag => {
                    expect(commandLine).toMatch(new RegExp(flag + '[^/]*'+ outputFile))
                })
            })
            done()
        })
    command.run()
})
