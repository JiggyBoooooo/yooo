import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const skip=new Set(['.git','node_modules','.netlify']);
const bad=[/sk_(?:live|test)_[A-Za-z0-9]+/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/password\s*[:=]\s*["']?[^\s"']+/gi];
let findings=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(?:js|mjs|html|css|json|toml|yml|yaml|env|txt)$/i.test(ent.name)){const text=fs.readFileSync(p,'utf8');bad.forEach(rx=>{if(rx.test(text))findings.push(path.relative(root,p));rx.lastIndex=0})}}}
walk(root);
console.log(findings.length?`Potential secret patterns found in: ${[...new Set(findings)].join(', ')}`:'No obvious private-key/Stripe-secret patterns found.');
process.exitCode=findings.length?1:0;
