const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadHtml(path) {
    return fs.readFileSync(path, 'utf8');
}

function extractFunction(html, name, path) {
    const start = html.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `${name} should exist in ${path}`);

    const braceStart = html.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < html.length; i++) {
        if (html[i] === '{') depth++;
        if (html[i] === '}') depth--;
        if (depth === 0) return html.slice(start, i + 1);
    }
    throw new Error(`Could not extract ${name}`);
}

function loadReciprocityFunction(path) {
    const html = loadHtml(path);
    const sandbox = { Math };
    vm.createContext(sandbox);
    vm.runInContext(`
function clamp(x, min, max) {
    return Math.min(max, Math.max(min, x));
}
${extractFunction(html, 'reciprocityEfficiency', path)}
`, sandbox);
    return sandbox.reciprocityEfficiency;
}

function extractObjectLiteral(html, name, path) {
    const start = html.indexOf(`const ${name} = {`);
    assert.notStrictEqual(start, -1, `${name} should exist in ${path}`);

    const braceStart = html.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < html.length; i++) {
        if (html[i] === '{') depth++;
        if (html[i] === '}') depth--;
        if (depth === 0) return html.slice(braceStart, i + 1);
    }
    throw new Error(`Could not extract ${name}`);
}

function assertReciprocityBehavior(path) {
    const reciprocityEfficiency = loadReciprocityFunction(path);

    const normal = reciprocityEfficiency(5, 1 / 125);
    assert(normal > 0.985 && normal <= 1.0, `${path}: normal exposure should be near neutral, got ${normal}`);

    const longDim = reciprocityEfficiency(0.35, 30);
    assert(longDim < 0.75, `${path}: long dim exposure should lose efficiency, got ${longDim}`);

    // Ilford: no reciprocity correction needed 1/2 to 1/10000 s
    const shortShutter = reciprocityEfficiency(250, 1 / 4000);
    assert(shortShutter >= 0.99, `${path}: short shutter should be near 1.0 (Ilford: no correction 1/2–1/10000s), got ${shortShutter}`);

    for (const [lambda, seconds] of [[0, 1], [0.1, 60], [5, 1 / 125], [1000, 1 / 8000]]) {
        const eff = reciprocityEfficiency(lambda, seconds);
        assert(eff >= 0 && eff <= 1, `${path}: efficiency should be bounded for lambda=${lambda}, seconds=${seconds}: ${eff}`);
    }
}

assertReciprocityBehavior('index.html');
assertReciprocityBehavior('test-harness.html');

const indexHtml = loadHtml('index.html');
const harnessHtml = loadHtml('test-harness.html');

assert(indexHtml.includes('(4.0 / 0.18) * (iso / 125.0)'), 'index.html should anchor sensitivity to ISO 125');
assert(harnessHtml.includes('(4.0 / 0.18) * (iso / 125.0)'), 'test-harness.html should anchor sensitivity to ISO 125');
assert(!indexHtml.includes('(4.0 / 0.18) * (iso / 100.0)'), 'index.html should not use ISO 100 anchor');
assert(!harnessHtml.includes('(4.0 / 0.18) * (iso / 100.0)'), 'test-harness.html should not use ISO 100 anchor');

const fp4Sensitivity = (4.0 / 0.18) * (125 / 125.0);
assert(Math.abs(fp4Sensitivity * 0.18 - 4.0) < 1e-12, 'ISO 125 18% gray should map to lambda=4');

const filterSandbox = { Math };
vm.createContext(filterSandbox);
vm.runInContext(`FILTERS = ${extractObjectLiteral(indexHtml, 'FILTERS', 'index.html')};`, filterSandbox);

const expectedFactors = {
    yellow: 2,
    deepYellow: 3,
    orange: 4,
    red: 8,
    green: 8,
    blue: 5
};

for (const [key, factor] of Object.entries(expectedFactors)) {
    assert.strictEqual(filterSandbox.FILTERS[key].factor, factor, `${key} filter factor should be ${factor}`);
    const expectedEv = -Math.log2(factor);
    assert(Math.abs(filterSandbox.FILTERS[key].ev - expectedEv) < 1e-9, `${key} EV should be -log2(${factor})`);
}

console.log('e1 reciprocity tests passed');
