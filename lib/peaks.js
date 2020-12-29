const fs = require('fs')

/**
 * Analyzes subranges of raw audio file to find and store peaks
 * @param {length} How many subranges to break the waveform into.
 * @param {totalSamples} How many samples there are in the whole audio.
 *		  For an AudioBuffer use AudioBuffer.length.
 * @param {splitChannels} Whether  to return peak data split or merged
 * @param {sampleStep} Step between samples compared - 1 analyzes every sample
 */
class PeakStore {
	constructor(splitChannels, length, step, totalSamples) {
		this.length = length;
		this.totalSamples = totalSamples;
		this.splitChannels = splitChannels;
		this.sampleStep = step;
		this.mergedPeaks = [];
	}

	/**
     * Processes batches of samples and adds new peaks to the store
	 * @param {buffers} buffers[i] is an array of floats containing the samples of channel i.
	 */
	update(buffers) {

		const sampleSize = this.totalSamples / this.length;
		const channels = buffers.length;

		if (this.lastMax === undefined) {
			this.lastMax = Array(channels).fill(0);
			this.lastMin = Array(channels).fill(0);
			this.indexI = Array(channels).fill(0);
			this.indexJ = Array(channels).fill(0);
			this.indexJJOverflow = Array(channels).fill(0);
			this.splitPeaks = Array(channels).fill(null).map(i => []);
		}

		for (let c = 0; c < channels; c++) {
			let peaks = this.splitPeaks[c];
			let chan = buffers[c];

			let i;
			for (i = this.indexI[c]; i < this.length; i++) {
				let start = Math.max(~~(i * sampleSize), this.indexJ[c]);
				let end = ~~((i+1) * sampleSize);
				let min = this.lastMin[c];
				let max = this.lastMax[c];

				let broken = false;
				let jj;
				for (let j = start; j < end; j += this.sampleStep) {
					jj = j - this.indexJ[c] + this.indexJJOverflow[c];

					if (jj > chan.length-1) {
						this.indexI[c] = i;
						this.indexJJOverflow[c] = jj - (chan.length-1) - 1;
						this.indexJ[c] = j;
						this.lastMax[c] = max;
						this.lastMin[c] = min;
						broken = true;
						break;
					}

					let value = chan[jj];

					if (value > max) {
						max = value;
					}

					if (value < min) {
						min = value;
					}
				}

				if (broken) break;
				else {
					this.lastMax[c] = 0;
					this.lastMin[c] = 0;
				}

				peaks[2 * i] = min;
				peaks[2 * i + 1] = max;

				if (c == 0 || min < this.mergedPeaks[2 * i]) {
					this.mergedPeaks[2 * i] = min;
				}

				if (c == 0 || max > this.mergedPeaks[2 * i + 1]) {
					this.mergedPeaks[2 * i + 1] = max;
				}
			}
			
			this.indexI[c] = i;  // We finished for channel c. For the next call start from i = this.length so we do nothing.
		}
	}

    // returns split (Array of Arrays) or merged (Array) peaks
	get() {
		return this.splitChannels ? this.splitPeaks : this.mergedPeaks;
	}
}

class PeakFinder {
    constructor(length, numChannels = 1, precision = 1) {
        this.oddByte = null;
        this.sc = 0;

        this.numChannels = numChannels
        this.length = length
        this.precision = precision
    }

    /**
     * Extracts peaks from an audio file.
     * Writes a JSON file if an output path was specified.
     * @param {String} rawFilePath          - Source raw audio file path.
     * @param {String|Function} outputFilePath - Optional output json file path.
     */
    async getPeaks(rawFilePath, outputFilePath = null) {
        return this.extractPeaks(rawFilePath)
            .catch(err => {
                throw new Error(`extracting peaks: ${err.message}`)
            })
            .then(peaks => {
                if(outputFilePath){
                    fs.writeFileSync(outputFilePath, JSON.stringify(peaks));
                } 
                return peaks
            }).catch(err => {
                throw new Error(`writing to file: ${err.message}`)
            })
    }

    async extractPeaks(rawFilePath) {
        return new Promise((resolve, reject) => {
            const stats = fs.statSync(rawFilePath)
            const totalSamples = ~~(stats.size / 2 / this.numChannels);
            this.peakStore = new PeakStore(this.numChannels >= 2, this.length, this.precision, totalSamples);

            const readable = fs.createReadStream(rawFilePath);
            readable.on('data', this.onChunkRead.bind(this));
            readable.on('error', err => reject(err));
            readable.on('end', () => resolve(this.peakStore.get()))
        })
    }

    onChunkRead(chunk) {
        let i = 0;
        let value;
        let samples = Array(this.numChannels).fill(null).map(i => []);

        if (this.oddByte !== null) {
            value = ((chunk.readInt8(i++, true) << 8) | this.oddByte);
            samples[this.sc].push(value);
            this.sc = (this.sc + 1) % this.numChannels;
        }

        for (; i + 1 < chunk.length; i += 2) {
            value = chunk.readInt16LE(i, true);
            samples[this.sc].push(value);
            this.sc = (this.sc + 1) % this.numChannels;
        }
        this.oddByte = i < chunk.length ? chunk.readUInt8(i, true) : null;
        this.peakStore.update(samples);
    }
}

function peaksIntermediary(quality = 0.5){
	quality = Math.min(Math.max(quality, 0.1), 1)
    return {
        format: "s16le",
		options: `-ar ${Math.round(44100 * quality ** 2)}`,
		audio: {
			options: '-ac 1'
		}
    }
}

function prepForPeaks(event){
	const intermediary = peaksIntermediary(event.peaks.quality)
	event.outputs.push(intermediary)
	event.peaks.intermediary = intermediary
	return event
}

function getPeaks(event){
	if (!event.peaks.intermediary) throw new Error('server did not prepare file for finding peaks')

	const pcm = event.peaks.intermediary.local
	const finder = new PeakFinder(event.peaks.count || 600)
	return new Promise((resolve, reject) => {
		finder.getPeaks(pcm)
			.then(peaks => {
				event.peaks = peaks
				resolve(peaks)
			})
			.catch(err => reject(err))
	})
}

module.exports = { prepForPeaks, getPeaks }
