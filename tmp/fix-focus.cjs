const fs=require('fs');
const p='src/features/prompt-workbench/prompt-workbench-tool.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace('<Textarea aria-label={`${section.label} idea`}', '<Textarea ref={node => { if (node && nextFocus.current === idea.id) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); nextFocus.current = null; } }} aria-label={`${section.label} idea`}');
fs.writeFileSync(p,s);
