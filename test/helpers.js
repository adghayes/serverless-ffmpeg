const nock = require('nock')
const mime = require('mime-types')
const fs = require('fs')
const md5file = require('md5-file')
const projectRoot = require('app-root-path')

const TestFile = {
    localPath: projectRoot + '/test/files/mini.wav',
    name: 'music'
    byteSize: fs.statSync(TestFile.localPath).size
}
const filename = projectRoot + '/test/files/mini.wav'
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