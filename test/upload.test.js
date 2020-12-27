const nock = require('nock')
const mime = require('mime-types')
const fs = require('fs')
const md5file = require('md5-file')

const { uploadAll, upload, basicUpload, 
    railsDirectUpload, postRailsBlob } = require('../lib/upload.js')

const projectRoot = require('app-root-path')
const filename = projectRoot + '/test/files/cantina.wav'
const uploadName = 'music'
const byteSize = fs.statSync(filename).size
const contentType = mime.lookup(filename)
const checksum = Buffer.from(md5file.sync(filename), 'hex').toString('base64')
const uploadAuth = {'Authorization': 'bearer upload'}
const railsAuth = {'Authorization': 'bearer blob'}

const railsBlobResponse = id => ({
    "filename": uploadName,
    "content_type": contentType,
    "byte_size": byteSize,
    "signed_id": id,
    "direct_upload": {
        "url": `https://www.example.com/upload/${id}`,
        "headers": uploadAuth
    }
})

const railsBlobNock = id => nock('https://www.example.com', {
    reqheaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...railsAuth
    }})
    .post(`/rails/${id}`, { blob: {
        filename: 'music',
        content_type: contentType,
        byte_size: byteSize,
        checksum
    }})
    .reply(200, () => railsBlobResponse(id))

const uploadNock = id => nock('https://www.example.com',{
    reqheaders: {
        'Content-Type': contentType,
        'Content-Length': byteSize,
        ...uploadAuth
    }})
    .put(`/upload/${id}`, fs.readFileSync(filename))
    .reply(200)


test('basicUpload PUTS file to specified URL with appropriate headers', async () => {
    uploadNock(1)

    const response = await basicUpload(filename, {
        byteSize, contentType, url: 'https://www.example.com/upload/1',
        headers: uploadAuth
    })
    expect(response.status).toBe(200)
})

test('postRailsBlob posts necessary attributes and headers', async () => {
    railsBlobNock(1)

    const blobInfo = await postRailsBlob({
        filename: uploadName,
        byte_size: byteSize,
        content_type: contentType,
        checksum
    }, {
        headers: railsAuth,
        url: 'https://www.example.com/rails/1'
    })
    expect(blobInfo).toBeTruthy()
    expect(blobInfo.signed_id).toBeTruthy()
})

test('railsDirectUpload posts blob then uploads file', async () => {
    railsBlobNock(2)
    uploadNock(2)

    const { signed_id, upload } = await railsDirectUpload(filename, {
        url: 'https://www.example.com/rails/2',
        headers: railsAuth,
        byteSize, contentType,
        name: uploadName
    })

    expect(signed_id).toBeTruthy()

    const response = await upload
    expect(response.status).toBe(200)
})

test('upload throws error if no url', () => {
    expect(() => {
        upload(filename, {upload:{}})
    }).toThrow('url')
})

test('upload defaults to basic upload', async () => {
    const railsScope = railsBlobNock(3)
    uploadNock(3)

    const response = await upload(filename, {
        format: 'wav',
        upload: {
            url: 'https://www.example.com/upload/3',
            headers: uploadAuth
        }
    })
    
    expect(response.status).toBe(200)
    expect(railsScope.isDone()).toBe(false)
})

test('upload handles rails_direct_upload', async () => {
    railsBlobNock(4)
    uploadNock(4)

    const output = {
        format: 'wav',
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/4',
            headers: railsAuth,
            name: uploadName
        }
    }

    const response = await upload(filename, output)
    
    expect(response.status).toBe(200)
    expect(output.id).toBeTruthy()
})

test('uploadAll handles multiple uploads', async () => {
    railsBlobNock(5)
    railsBlobNock(6)
    uploadNock(5)
    uploadNock(6)

    const outputs = [{
        format: 'wav',
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/5',
            headers: railsAuth,
            name: uploadName
        }
    }, {
        format: 'wav',
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/6',
            headers: railsAuth,
            name: uploadName
        }
    }]

    const responses = await Promise.all(uploadAll([filename, filename], outputs))
    responses.forEach(response => expect(response.status).toBe(200))
})
