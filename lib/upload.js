const fetch = require('node-fetch')
const fs = require('fs')
const mime = require('mime-types')
const path = require('path')
const md5file = require('md5-file')

function uploadAll(outputs){
    const uploads = []
    outputs.forEach(output => {
        if(output.upload) uploads.push(upload(output))
    })
    return uploads
}      

function upload(output){
    output.upload.byteSize = fs.statSync(output.local).size
    output.upload.contentType = contentType(output)

    if(output.upload.type === 'rails') {
        return railsDirectUpload(output)
            .then(({signedId, upload}) =>{
                output.id = signedId
                return upload
            })
    } else {
        return basicUpload(output)
    }
}

function basicUpload({local, upload}){
    return fetch(upload.url, {
        method: 'PUT',
        body: fs.createReadStream(local),
        headers: {
            'Content-Length': upload.byteSize,
            'Content-Type': upload.contentType,
            ...upload.headers
        }
    })
    .then(res => {
        if(res.ok) return res

        const error = new Error(`failed to upload ${upload.contentType}: ${res.statusText}`)
        error.status = res.status
        throw error
    })
}

function contentType(output){
    return mime.lookup(output.extension) || mime.lookup(output.format) || 'application/octet-stream'
}

const checksumBase64 = filename => Buffer.from(md5file.sync(filename), 'hex').toString('base64')

async function railsDirectUpload({local, upload}){
    const attributes = {
        checksum: checksumBase64(local), 
        byte_size: upload.byteSize,
        content_type: upload.contentType,
        filename: upload.name || path.basename(local)
    }

    const blob = await postRailsBlob(attributes, upload)
    console.log(JSON.stringify(blob.direct_upload.headers))
    const fileUpload = {
        ...upload,
        url: blob.direct_upload.url,
        headers: blob.direct_upload.headers
    }

    return { signedId: blob.signed_id, upload: basicUpload({local, upload: fileUpload}) }
}
  
function postRailsBlob(attributes, options){
    return fetch(options.url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
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

module.exports = { uploadAll, upload, basicUpload, railsDirectUpload, postRailsBlob }
