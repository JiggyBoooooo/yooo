import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve('netlify');
const files = [];
function walk(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);const st=fs.statSync(file);if(st.isDirectory())walk(file);else if(file.endsWith('.ts'))files.push(file);}}
walk(root);
let failed=false;
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,strict:true},reportDiagnostics:true,fileName:file});
  const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length){failed=true;console.error(`Syntax/type-surface errors in ${file}`);for(const d of errors)console.error(ts.flattenDiagnosticMessageText(d.messageText,'\n'));}
}
console.log(failed?'TS_SYNTAX_FAIL':'TS_SYNTAX_OK');
process.exit(failed?1:0);
