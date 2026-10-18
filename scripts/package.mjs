import {zipSync,strToU8} from 'fflate';
import {readFile,writeFile,mkdir,readdir,lstat,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const c=JSON.parse(await readFile('component.json','utf8')),p=JSON.parse(await readFile('package.json','utf8'));await mkdir('release/current',{recursive:true});const sums=[];
// Clean only this component's recognized generated release files; preserve unknown files.
for(const name of await readdir('release/current')){if(!/^(?:theme\.css|main\.js|manifest\.json|styles\.css|SHA256SUMS\.txt|knowledge-agent-plugin-\d+\.\d+\.\d+\.zip|knowledge-agent-workflow-\d+\.\d+\.\d+\.zip)$/.test(name))throw new Error('Unknown release file: '+name);const path='release/current/'+name;if(!(await lstat(path)).isFile())throw new Error('Unsafe release path');await unlink(path)}

async function output(name,bytes){await writeFile('release/current/'+name,bytes);sums.push(createHash('sha256').update(bytes).digest('hex')+'  '+name)}
const files={},names=c.kind==='theme'?['theme.css','manifest.json']:['main.js','manifest.json','styles.css'];for(const name of names){const bytes=new Uint8Array(await readFile('dist/'+c.kind+'/'+name));files[name]=bytes;await output(name,bytes)}files.LICENSE=strToU8(await readFile('LICENSE','utf8'));await output(c.artifact+'-'+p.version+'.zip',zipSync(files));
const tools={};async function collect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await collect(path);else if(e.isFile())tools[path]=new Uint8Array(await readFile(path))}}await collect('workflow');tools.LICENSE=files.LICENSE;await output('knowledge-agent-workflow-'+p.version+'.zip',zipSync(tools));
await writeFile('release/current/SHA256SUMS.txt',sums.join('\n')+'\n');console.log('Packaged only '+c.title+' assets');
