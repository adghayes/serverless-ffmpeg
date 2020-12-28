const path = require('path')

const { uploadAll, upload, basicUpload, 
    railsDirectUpload, postRailsBlob } = require('../lib/upload.js')

const { size, type, checksum, auth,
    railsNock, uploadNock } = require('./helpers.js')

const projectRoot = require('app-root-path')
const testFile = projectRoot + '/test/files/cantina.wav'

test('basicUpload PUTS file to specified URL with appropriate headers', async () => {
    uploadNock(testFile, 1)

    const response = await basicUpload({
        local: testFile,
        upload: {
            byteSize: size(testFile), 
            contentType: type(testFile), 
            url: 'https://www.example.com/upload/1',
            headers: auth('upload')
        }
    })
    expect(response.status).toBe(200)
})

test('postRailsBlob posts necessary attributes and headers', async () => {
    railsNock(testFile, 1)

    const blobInfo = await postRailsBlob({
        filename: 'anything',
        byte_size: size(testFile),
        content_type: type(testFile),
        checksum: checksum(testFile)
    }, {
        headers: auth('rails'),
        url: 'https://www.example.com/rails/1'
    })
    expect(blobInfo).toBeTruthy()
    expect(blobInfo.signed_id).toBeTruthy()
})

test('railsDirectUpload posts blob then uploads file', async () => {
    railsNock(testFile, 2)
    uploadNock(testFile, 2)

    const { signedId, upload } = await railsDirectUpload({
        local: testFile, 
        upload: {
            url: 'https://www.example.com/rails/2',
            headers: auth('rails'),
            byteSize: size(testFile),
            contentType: type(testFile),
            name: 'anything'
        }
    })

    expect(signedId).toBeTruthy()

    const response = await upload
    expect(response.status).toBe(200)
})

test('upload defaults to basic upload', async () => {
    const railsScope = railsNock(testFile, 3)
    uploadNock(testFile, 3)

    const response = await upload({
        local: testFile,
        format: path.extname(testFile),
        upload: {
            url: 'https://www.example.com/upload/3',
            headers: auth('upload')
        }
    })
    
    expect(response.status).toBe(200)
    expect(railsScope.isDone()).toBe(false)
})

test('upload handles rails-type uploads', async () => {
    railsNock(testFile, 4)
    uploadNock(testFile, 4)

    const output = {
        local: testFile,
        format: path.extname(testFile),
        upload: {
            type: 'rails',
            url: 'https://www.example.com/rails/4',
            headers: auth('rails'),
            name: 'music'
        }
    }

    const response = await upload(output)
    
    expect(response.status).toBe(200)
    expect(output.id).toBeTruthy()
})

test('uploadAll handles multiple uploads', async () => {
    railsNock(testFile, 5)
    railsNock(testFile, 6)
    uploadNock(testFile, 5)
    uploadNock(testFile, 6)

    const outputs = [{
        local: testFile,
        format: path.extname(testFile),
        upload: {
            type: 'rails',
            url: 'https://www.example.com/rails/5',
            headers: auth('rails'),
            name: 'music'
        }
    }, {
        local: testFile,
        format: path.extname(testFile),
        upload: {
            type: 'rails',
            url: 'https://www.example.com/rails/6',
            headers: auth('rails'),
            name: 'music'
        }
    }]

    const responses = await Promise.all(uploadAll(outputs))
    responses.forEach(response => expect(response.status).toBe(200))
})
