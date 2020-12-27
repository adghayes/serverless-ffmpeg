
const fs = require('fs')
const tmp = require('tmp')
const projectRoot = require('app-root-path')
const { execSync } = require('child_process')
const { peakInput, PeakFinder } = require('../lib/peaks.js')

test('peakInput returns object formatted for addOutputs', () => {
    expect(peakInput(0.5)).toMatchObject({
        "format": "s16le",
        "options": "-ar 5512.5"
    })
})

/** 
 *  Testing is done by comparing our results to those produced by 
 *  audiowaveform (aw), a C++ program for creating waveform data and images.
 *  For downloads and documentation, see https://github.com/bbc/audiowaveform. 
 *  An audiowaveform binary must exist on your path to run this test
 */
if(!require('hasbin').sync('audiowaveform')){
    throw new Error(`
        testing peaks.js output relies on an audiowaveform binary
        the binary is used to generate waveforms for comparison
        see https://github.com/bbc/audiowaveformbinary for install
    `)
}

/** 
 *  audiowaveform (aw) requires a .wav file, our module requires .raw. 
 *  Most audio files can be converted to both formats with ffmpeg
 */
const inputNoExension = projectRoot + '/test/files/cantina'
const awInputPath = inputNoExension + '.wav'
const myInputPath = inputNoExension + '.raw'

// run audiowaveform
const awOutputPath = tmp.tmpNameSync()
const pixelsPerSecond = 100
const options = [
    `-i ${awInputPath}`,
    '--output-format json',
    `-o ${awOutputPath}`,
    `--pixels-per-second ${pixelsPerSecond}`
]
execSync("audiowaveform " + options.join(' '), {stdio: 'ignore'})
const awOutput = JSON.parse(fs.readFileSync(awOutputPath))
const awData = awOutput.data
const length = awOutput.length

// generate smae number of peaks as audiowaveform
const Peaker = new PeakFinder(length)

test("global max resembles audiowaveform's (exact value, adjacent index)", () => {
    return Peaker.getPeaks(myInputPath).then(myData => {
        const [awMax, awIndex] = findMax(awData)
        const [myMax, myIndex] = findMax(myData)

        expect(myMax).toBe(awMax)
        expect(myIndex).toBeLessThanOrEqual(awIndex + 1)
        expect(myIndex).toBeGreaterThanOrEqual(awIndex - 1)
    })
})

test("global min resembles audiowaveform's (exact value, adjacent index)", () => {
    return Peaker.getPeaks(myInputPath).then(myData => {
        const [awMin, awIndex] = findMin(awData)
        const [myMin, myIndex] = findMin(myData)

        expect(myMin).toBe(awMin)
        expect(myIndex).toBeLessThanOrEqual(awIndex + 1)
        expect(myIndex).toBeGreaterThanOrEqual(awIndex - 1)
    })
})

test("global average resembles audiowaveform's (25% margin)", () => {
    margin = 5 / 4
    return Peaker.getPeaks(myInputPath).then(myData => {
        myAverage = absAverage(myData)
        awAverage = absAverage(awData)
        expect(myAverage).toBeLessThan(awAverage * margin)
        expect(myAverage).toBeGreaterThan(awAverage / margin)
    })
})

test("local averages (tenth of second) resemble audiowaveform's (33% margin)", () => {
    const margin = 4 / 3
    const step = 10
    return Peaker.getPeaks(myInputPath).then(myData => {
        
        for(let i = 0; i < length; i += step){
            const mySlice = myData.slice(i, i + step)
            const awSlice = awData.slice(i, i + step)
            myAverage = absAverage(mySlice)
            awAverage = absAverage(awSlice)
            expect(myAverage).toBeLessThan(awAverage * margin)
            expect(myAverage).toBeGreaterThan(awAverage / margin)
        }
    })
}) 

function findMin(data){
    const min = Math.min(...data)
    const index = data.indexOf(min)
    return [min, index]
}

function findMax(data){
    const max = Math.max(...data)
    const index = data.indexOf(max)
    return [max, index]
}

function absAverage(numbers){
    const sum = numbers.reduce((sum, number) => sum += Math.abs(number))
    return sum / numbers.length
}
