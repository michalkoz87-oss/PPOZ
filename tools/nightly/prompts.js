// Polecenia etapów z verify-block.js bez narzędzia Workflow (gdy jest niedostępne): ten sam tekst, uruchamiany jako osobni agenci.
// Użycie: node tools/nightly/prompts.js <plik argumentów JSON> <etap> [część] [dodatkowe]
//   etap: solverA | solverB | judge (dodatkowe = ścieżka pliku {"ids":[...],"why":"..."}) | skeptic (dodatkowe = obecny klucz części)
//         | author (część = id lekcji) | checker (część = id lekcji)
const fs = require('fs'), path = require('path')
const [argsFile, stage, part, extra] = process.argv.slice(2)
const args = JSON.parse(fs.readFileSync(argsFile, 'utf8'))
let src = fs.readFileSync(path.join(__dirname, 'verify-block.js'), 'utf8').replace(/^export const meta/m, 'const meta')
src = src.slice(0, src.indexOf('if (args.skepticOnly)')) + '\nreturn { solver, judge, skeptic, author, checker }'
const f = new Function('args', src)(args)
let out
if (stage === 'solverA' || stage === 'solverB') out = f.solver(part, stage.slice(-1))
else if (stage === 'judge') { const j = JSON.parse(fs.readFileSync(extra, 'utf8')); out = f.judge(part, j.ids, j.why) }
else if (stage === 'skeptic') out = f.skeptic(part, extra)
else if (stage === 'author') out = f.author(part)
else if (stage === 'checker') out = f.checker(part)
else throw new Error('nieznany etap: ' + stage)
process.stdout.write(out)
