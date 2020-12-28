const nock = require('nock')
const mime = require('mime-types')
const fs = require('fs')
const tmp = require('tmp')
const md5file = require('md5-file')

const sizeCache = {}
function size(filename){
    if (!sizeCache[filename]){
        sizeCache[filename] = fs.statSync(filename).size
    }

    return sizeCache[filename]
}

const checksumCache = {}
function checksum(filename){
    if (!checksumCache[filename]){
        checksumCache[filename] = Buffer.from(md5file.sync(filename), 'hex').toString('base64')
    }

    return checksumCache[filename]
}

function type(filename){
    return mime.lookup(filename)
}

function auth(type){
    return {
        'Authorization': `bearer ${type}`
    }
}

function downloadNock(filename, id){
    return nock('https://www.example.com', {
        reqheaders: auth('download')
    })
        .get(`/download/${id}`)
        .replyWithFile(200, filename, {
            'Content-Type': type(filename),
            'Content-Length': size(filename)
        })
}

const railsResponse = id => ({
    "signed_id": id,
    "direct_upload": {
        "url": `https://www.example.com/upload/${id}`,
        "headers": auth('upload')
    }
})

const railsNock = (filename, id, exact = true) => {
    return nock('https://www.example.com', {
        reqheaders: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...auth('rails')
    }})
        .post(`/rails/${id}`, { blob: {
            filename: /.*/,
            content_type: type(filename),
            byte_size: (exact ? size(filename) : /\d+/),
            checksum: (exact ? checksum(filename) : /.+/)
        }})
        .reply(200, () => railsResponse(id))
    }

function uploadNock(filename, id, exact = true){
        return nock('https://www.example.com',{
            reqheaders: {
                'Content-Type': type(filename),
                'Content-Length': (exact ? size(filename) : /\d+/),
                ...auth('upload')
            }})
            .put(`/upload/${id}`, (exact ? fs.readFileSync(filename) : undefined))
            .reply(200)
}

const callbackNock = (id, peaksCount, rails = false) => nock('https://www.example.com', {
        reqheaders: auth('callback')
    })
    .post(`/info/${id}`, body => {
        const hasIds = body.outputs.every(output => !output.upload || output.id)
        const hasPeaks = body.peaks && body.peaks.length && body.peaks.length === peaksCount * 2
        const hasMetadata = body.input.metadata
        return hasPeaks && hasMetadata && body.status && (!rails || hasIds)
    })
    .reply(200)

const failureNock = id => nock('https://www.example.com', {
        reqheaders: auth('callback')
    })
    .post(`/info/${id}`, body => {
        return body.status > 299
    })
    .reply(200)


module.exports = {
    size, type, checksum, auth, downloadNock, 
    railsNock, uploadNock, callbackNock, failureNock
}