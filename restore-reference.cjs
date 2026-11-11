const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const bundleDirectory = path.join(__dirname, 'reference-bundle');
const {parts, pages} = require('./reference-bundle/manifest.json');
const bytes = Buffer.concat(parts.map(name => {
  if (!/^part-\d{2}\.bin$/.test(name)) throw Error('Invalid bundle part');
  return fs.readFileSync(path.join(bundleDirectory, name));
}));
const destination = path.join(__dirname, 'src/reference');
fs.mkdirSync(destination, {recursive: true});
let offset = 0;
for (const {name, size, sha256} of pages) {
  if (!/^page-\d{3}\.webp$/.test(name) || !Number.isInteger(size) || size < 1) {
    throw Error('Invalid image entry');
  }
  const data = bytes.subarray(offset, offset + size);
  if (data.length !== size || crypto.createHash('sha256').update(data).digest('hex') !== sha256) {
    throw Error('Reference image failed verification: ' + name);
  }
  fs.writeFileSync(path.join(destination, name), data);
  offset += size;
}
if (offset !== bytes.length) throw Error('Unexpected reference bundle length');
console.log('Restored and verified ' + pages.length + ' reference images.');
