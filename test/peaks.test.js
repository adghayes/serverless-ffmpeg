const fs = require("fs");

const { prepForPeaks, getPeaks } = require("../lib/peaks.js");

const projectRoot = require("app-root-path");
const testEvent = () =>
  JSON.parse(fs.readFileSync(projectRoot + "/test/events/peaks.json"));

test("prepForPeaks adds new output", () => {
  const event = testEvent();
  const expected = {
    format: "s16le",
    options: expect.stringMatching(/-ar\s\d+/),
    audio: expect.anything(),
    video: false
  };

  prepForPeaks(event);
  expect(event.peaks.intermediary).toMatchObject(expected);
  expect(event.outputs[event.outputs.length - 1]).toMatchObject(expected);
});

/**
 *  audiowaveform (aw) is a C++ program that generates peaks
 *  and provides a way to roughly compare our generated peaks
 */
const testFile = projectRoot + "/test/files/cantina.raw";
const awOutput = JSON.parse(
  fs.readFileSync(projectRoot + "/test/files/cantinaPeaks100.json")
);
const peaksCount = awOutput.length;
const awPeaks = awOutput.data;

// generate same number of peaks as audiowaveform
const preppedEvent = testEvent();
preppedEvent.peaks = {
  count: peaksCount,
  intermediary: {
    local: testFile,
  },
};

const myPeaksPromise = getPeaks(preppedEvent);

test("generated the correct number of peaks", async () => {
  const myPeaks = await myPeaksPromise;

  expect(myPeaks.length).toBe(peaksCount * 2);
});

test("global max resembles audiowaveform's (exact value, adjacent index)", async () => {
  const myPeaks = await myPeaksPromise;

  const [awMax, awIndex] = findMax(awPeaks);
  const [myMax, myIndex] = findMax(myPeaks);

  expect(myMax).toBe(awMax);
  expect(myIndex).toBeLessThanOrEqual(awIndex + 1);
  expect(myIndex).toBeGreaterThanOrEqual(awIndex - 1);
});

test("global min resembles audiowaveform's (exact value, adjacent index)", async () => {
  const myPeaks = await myPeaksPromise;

  const [awMin, awIndex] = findMin(awPeaks);
  const [myMin, myIndex] = findMin(myPeaks);

  expect(myMin).toBe(awMin);
  expect(myIndex).toBeLessThanOrEqual(awIndex + 1);
  expect(myIndex).toBeGreaterThanOrEqual(awIndex - 1);
});

test("global average resembles audiowaveform's (25% margin)", async () => {
  margin = 5 / 4;
  const myPeaks = await myPeaksPromise;

  myAverage = absAverage(myPeaks);
  awAverage = absAverage(awPeaks);
  expect(myAverage).toBeLessThan(awAverage * margin);
  expect(myAverage).toBeGreaterThan(awAverage / margin);
});

test("local averages (tenth of second) resemble audiowaveform's (33% margin)", async () => {
  const margin = 4 / 3;
  const step = 10;
  const myPeaks = await myPeaksPromise;
  for (let i = 0; i < length; i += step) {
    const mySlice = myPeaks.slice(i, i + step);
    const awSlice = awPeaks.slice(i, i + step);
    myAverage = absAverage(mySlice);
    awAverage = absAverage(awSlice);
    expect(myAverage).toBeLessThan(awAverage * margin);
    expect(myAverage).toBeGreaterThan(awAverage / margin);
  }
});

function findMin(data) {
  const min = Math.min(...data);
  const index = data.indexOf(min);
  return [min, index];
}

function findMax(data) {
  const max = Math.max(...data);
  const index = data.indexOf(max);
  return [max, index];
}

function absAverage(numbers) {
  const sum = numbers.reduce((sum, number) => (sum += Math.abs(number)));
  return sum / numbers.length;
}
