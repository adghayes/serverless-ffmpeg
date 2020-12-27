const fetch = require('node-fetch')
const fs = require('fs')
const mime = require('mime-types')
const path = require('path')
const md5file = require('md5-file')
const { PeakFinder } = require('./peaks')

function uploadAll(outputFilenames, outputs){
    return outputs.map((output, i) => {
        return upload(outputFilenames[i], output)
    })
}      

function upload(filename, output){
    if (!output.upload || !output.upload.url) throw new Error('no upload url specified')

    output.upload.contentType = mime.lookup(output.format)
    output.upload.byteSize = fs.statSync(filename).size

    if(output.upload.type === 'rails_direct_upload') {
        return railsDirectUpload(filename, output.upload)
            .then(({signed_id, upload}) =>{
                output.id = signed_id
                return upload
            })
    } else {
        return basicUpload(filename, output.upload)
    }
}

function basicUpload(filename, upload){
    return fetch(upload.url, {
        method: 'PUT',
        body: fs.createReadStream(filename),
        headers: {
            'Content-Length': upload.byteSize,
            'Content-Type': upload.contentType,
            ...upload.headers
        }
    })
    .then(response => {
        if(response.ok) return response

        const error = new Error(`failed to upload ${upload.contentType}: ${response.statusText}`)
        error.status = response.status
        throw error
    })
}

async function railsDirectUpload(filename, upload){
    const attributes = {
        checksum: Buffer.from(md5file.sync(filename), 'hex').toString('base64'), 
        byte_size: upload.byteSize,
        content_type: upload.contentType,
        filename: upload.name || path.basename(filename)
    }

    const blob = await postRailsBlob(attributes, upload)
    const fileUpload = {
        ...upload,
        url: blob.direct_upload.url,
        headers: blob.direct_upload.headers
    }

    return { signed_id: blob.signed_id, upload: basicUpload(filename, fileUpload) }
}
  
function postRailsBlob(attributes, details){
    return fetch(details.url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...details.headers
        }, 
        body: JSON.stringify({ blob: attributes})
    })
    .then(response => {
        if (response.ok) return response.json()

        const error = new Error(`failed to post blob to rails: ${response.statusText}`)
        error.status = response.status
        throw error
    })
}

module.exports = { uploadAll, upload, basicUpload, railsDirectUpload, postRailsBlob,
    default: uploadAll }
