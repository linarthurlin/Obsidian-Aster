import {readFile,writeFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile('package.json','utf8'));if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw new Error('Expected x.y.z');
const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.version=pkg.version;await writeFile('manifest.json',JSON.stringify(manifest,null,2)+'\n');
const versions=JSON.parse(await readFile('versions.json','utf8'));versions[pkg.version]=manifest.minAppVersion;await writeFile('versions.json',JSON.stringify(versions,null,2)+'\n');

const component=JSON.parse(await readFile('component.json','utf8'));component.version=pkg.version;await writeFile('component.json',JSON.stringify(component,null,2)+'\n');
