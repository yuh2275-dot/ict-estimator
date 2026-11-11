const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const dist = path.resolve(root, 'dist');
if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw Error('Invalid output directory');
fs.rmSync(dist, {recursive:true, force:true});
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
for (const name of ['index.html','src','vendor']) fs.cpSync(path.join(root,name),path.join(root,'dist',name),{recursive:true});
console.log('Static build complete. Only index.html, src and vendor included.');
