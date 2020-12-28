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