const nock = require("nock");
const mime = require("mime-types");
const fs = require("fs");
const tmp = require("tmp");
const md5file = require("md5-file");

const sizeCache = {};
function size(filename) {
  if (!sizeCache[filename]) {
    sizeCache[filename] = fs.statSync(filename).size;
  }

  return sizeCache[filename];
}

const checksumCache = {};
function checksum(filename) {
  if (!checksumCache[filename]) {
    checksumCache[filename] = Buffer.from(
      md5file.sync(filename),
      "hex"
    ).toString("base64");
  }

  return checksumCache[filename];
}

function type(filename) {
  return mime.lookup(filename);
}

function auth(type) {
  return {
    Authorization: `bearer ${type}`,
  };
}

function downloadNock(filename, id) {
  return nock("https://www.example.com", {
    reqheaders: auth("download"),
  })
    .get(`/download/${id}`)
    .replyWithFile(200, filename, {
      "Content-Type": type(filename),
      "Content-Length": size(filename),
    });
}

const railsResponse = (id) => ({
  signed_id: id,
  direct_upload: {
    url: `https://www.example.com/upload/${id}`,
    headers: auth("upload"),
  },
});

const railsNock = (filename, id) => {
  return nock("https://www.example.com", {
    reqheaders: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...auth("rails"),
    },
  })
    .post(`/rails/${id}`, {
      blob: {
        filename: /.*/,
        content_type: type(filename),
        byte_size: /\d+/,
        checksum: /[a-zA-Z0-9+=]+/,
      },
    })
    .reply(200, () => railsResponse(id));
};

function uploadNock(filename, id) {
  return nock("https://www.example.com", {
    reqheaders: {
      "Content-Type": type(filename),
      "Content-Length": /\d+/,
      ...auth("upload"),
    },
  })
    .put(`/upload/${id}`, /.+/)
    .reply(200);
}

const successNock = (id, peaks = null, rails = null) =>
  nock("https://www.example.com", {
    reqheaders: auth("callback"),
  })
    .post(`/info/${id}`, (body) => {
      const peaksGood =
        !peaks ||
        (body.peaks && body.peaks.length && body.peaks.length === peaks * 2);
      const idsGood =
        !rails || body.outputs.every((output) => !output.upload || output.id);
      return body.status && body.input.metadata && peaksGood && idsGood;
    })
    .reply(200);

const failureNock = (id) =>
  nock("https://www.example.com", {
    reqheaders: auth("callback"),
  })
    .post(`/info/${id}`, (body) => {
      return body.status > 299 && body.statusText;
    })
    .reply(200);

module.exports = {
  size,
  type,
  checksum,
  auth,
  downloadNock,
  railsNock,
  uploadNock,
  successNock,
  failureNock,
};
