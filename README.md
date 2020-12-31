# serverless-ffmpeg

DIY audio/video asset transcoding via a serverless function that wraps FFmpeg. Use as a reference project or clone to deploy quickly to AWS Lambda or another compatible serverless platform.

# Usage

The function simply transcodes audio based on parameters in the invoking event. In the following example, I'm requesting the function to download a file, transcode it to two different audio formats, upload both of those results to separate URLs, and make a callback to my server:
```json
{
  "input": {
    "download": {
      "url": "https://www.example.com/download/basic",
      "headers": {
        "Authorization": "bearer download"
      }
    }
  },
  "outputs": [
    {
      "format": "webm",
      "audio": {
        "bitrate": 96
      },
      "video": false,
      "options": ["-dash 1"],
      "upload": {
        "url": "https://www.example.com/upload/1",
        "headers": {
          "Authorization": "bearer upload"
        }
      }
    },
    {
      "format": "mp3",
      "audio": {
        "bitrate": 128
      },
      "upload": {
        "type": "basic",
        "url": "https://www.example.com/upload/2",
        "headers": {
          "Authorization": "bearer upload"
        }
      }
    }
  ],
  "callback": {
    "url": "https://www.example.com/info",
    "headers": {
      "Authorization": "bearer callback"
    },
    "method": "POST"
  }
}
```

Because the function uses [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) as an API, it supports the majority of that library's named options. You can specify an array of command line options for the input or any output, however, so you can use most of ffmpeg's settings if you are familiar with the CLI. Multiple inputs and streaming are not supported at the moment. Here are the full output options:
```json
{
  "format": "webm",
  "duration": 60,
  "seek": 30,
  "metadata": {
    "platform": "soundcloud"
  },
  "options": ["-dash 1", ...],
  "audio": {
    "bitrate": 96,
    "codec": "libopus",
    "channels": 2,
    "frequency": 44100,
    "quality": 0.9,
    "filters": ["volume=0.5", ...]
  },
  "video": {
    "fps": 60,
    "codec": "libvpx",
    "bitrate": 1000,
    "constantBitrate": true,
    "filters": ["fade=in:0:30", ...],
    "frames": 240,
    "size": "640x480",
    "aspect": "4:3",
    "autopad": true,
    "keepDAR": true
  }
}
```

Keep in mind that some parameters conflict with one another (the above would certainly fail). The function passes the above to fluent-ffmpeg which in turn passes it on to ffmpeg itself. If ffmpeg can't process the command, everything fails. In addition to transcoding, there are two plugins I added - one for generating waveform peaks data and another for performing direct uploads to rails. You can use them as follows:

```json
{
  "peaks": {
    "count": 600,
    "quality": 0.8
  },
  ...,
  "outputs"[
    {
      ...,
      "upload":{
        "type":"rails",
        ...
      }
    },
    ...
  ]
```
If the conversion and uploads are successful, the callback will include ffprobe generated metadata about the input file, peaks if peaks were requested, and blob ids if the uploads were of type "rails." If the function fails at any point - usually due to an ill-formed ffmpeg command or 400 level HTTP responses - it will try to make a callback with a relevant status code and status message. 

# Core Dependencies
### Asset Transcoding
- [FFmpeg](https://ffmpeg.org/)
- [John Van Sickle's FFmpeg Static Builds](https://johnvansickle.com/ffmpeg/)
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) 

### Adapted Plugins
- [ffmpeg-peaks](https://github.com/t4nz/ffmpeg-peaks) by [Gaetano Fiorello](https://github.com/t4nz) - for generating waveform data
- [rails's browser client](https://github.com/rails/rails/tree/master/activestorage/app/javascript/activestorage) - direct uploads with rails


### Testing
- [jest](https://github.com/facebook/jest) as framework 
- [nock](https://github.com/nock/nock) for mocking network calls in unit tests
- [serverless-offline](https://github.com/dherault/serverless-offline) for local integration testing

# Setup
There are a couple steps you have to take before being able to deploy the function locally or to a cloud services provider.

Most importantly, you have to get a static build of the **ffmpeg** and **ffprobe** binaries and make it available to your function. John Van Sickle maintains [static builds](https://johnvansickle.com/ffmpeg/) of Ffmpeg - you can download a zip which contains the two binaries (and support his great work by becoming a patron of [his Patreon](https://www.patreon.com/johnvansickle)). 

The binary is too big for a deployment package for most cloud providers, but at least on AWS you can make it available as a layer. After creating the layer, add it to your function in the AWS console or in your Serverless Framework, SAM, or CloudFormation template.

For local integration testing I use [serverless-offline](https://github.com/dherault/serverless-offline). You don't need to be using Serverless Framework or have even have account to use the offline plugin, but you do need your cloud provider credentials set up locally so serverless-offline can download your layers. Using layers with serverless-offline also requires Docker running on your machine.

# Notes on Performance

### Memory Size 
On AWS Lambda, I found that the optimal memory size for transcoding _audio_ files was somewhere between 1536MB and 2048MB and _video_ was somewhere between 6144MB and 8192MB. Gains past that point are marginal and are costing you more - whereas up until those memory sizes, scaling up is cost effective because it reduces billled duration nearly proportionally. 

Unless you're transcoding very large files, the problem is not actually memory availability - FFmpeg is quite memory efficient and the function doesn't use much memory in comparison to the actual files. Increasing memory size is effective, however, because Lambda CPU power is allocated proportionally.

### Concurrency
Running multiple transcodings in parallel (as opposed to one transcoding with many outputs) was found to not make much of a difference in billed duration. Separating conversions across different functions is signicantly faster, although the cumulative duration and cost will be higher than bundling them together.

### Duration Rule of Thumb

How long does serverless media conversion take? With so many factors, it's very difficult to predict. As a very loose rule of thumb, to convert one minute of one compressed format to another takes about 4 seconds for audio-only and 30 seconds for video with audio. Multiple outputs, higher sample rates or frame rates, and higher bit depths or sizes will slow that down.