const path = require('path')

const { uploadAll, upload, basicUpload, 
    railsDirectUpload, postRailsBlob } = require('../lib/upload.js')

const { size, type, checksum, auth,
    railsNock, uploadNock } = require('./helpers.js')

const projectRoot = require('app-root-path')
const filename = projectRoot + '/test/files/cantina.wav'

test('basicUpload PUTS file to specified URL with appropriate headers', async () => {
    uploadNock(filename, 1)

    const response = await basicUpload(filename, {
        byteSize: size(filename), 
        contentType: type(filename), 
        url: 'https://www.example.com/upload/1',
        headers: auth('upload')
    })
    expect(response.status).toBe(200)
})

test('postRailsBlob posts necessary attributes and headers', async () => {
    railsNock(filename, 1)

    const blobInfo = await postRailsBlob({
        filename: 'music',
        byte_size: size(filename),
        content_type: type(filename),
        checksum: checksum(filename)
    }, {
        headers: auth('rails'),
        url: 'https://www.example.com/rails/1'
    })
    expect(blobInfo).toBeTruthy()
    expect(blobInfo.signed_id).toBeTruthy()
})

test('railsDirectUpload posts blob then uploads file', async () => {
    railsNock(filename, 2)
    uploadNock(filename, 2)

    const { signed_id, upload } = await railsDirectUpload(filename, {
        url: 'https://www.example.com/rails/2',
        headers: auth('rails'),
        byteSize: size(filename),
        contentType: type(filename),
        name: 'music'
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
    const railsScope = railsNock(filename, 3)
    uploadNock(filename, 3)

    const response = await upload(filename, {
        format: path.extname(filename),
        upload: {
            url: 'https://www.example.com/upload/3',
            headers: auth('upload')
        }
    })
    
    expect(response.status).toBe(200)
    expect(railsScope.isDone()).toBe(false)
})

test('upload handles rails_direct_upload', async () => {
    railsNock(filename, 4)
    uploadNock(filename, 4)

    const output = {
        format: path.extname(filename),
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/4',
            headers: auth('rails'),
            name: 'music'
        }
    }

    const response = await upload(filename, output)
    
    expect(response.status).toBe(200)
    expect(output.id).toBeTruthy()
})

test('uploadAll handles multiple uploads', async () => {
    railsNock(filename, 5)
    railsNock(filename, 6)
    uploadNock(filename, 5)
    uploadNock(filename, 6)

    const outputs = [{
        format: path.extname(filename),
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/5',
            headers: auth('rails'),
            name: 'music'
        }
    }, {
        format: path.extname(filename),
        upload: {
            type: 'rails_direct_upload',
            url: 'https://www.example.com/rails/6',
            headers: auth('rails'),
            name: 'music'
        }
    }]

    const responses = await Promise.all(uploadAll([filename, filename], outputs))
    responses.forEach(response => expect(response.status).toBe(200))
})
