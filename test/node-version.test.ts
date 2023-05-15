import assert = require('assert');

describe('Check your minimal LTS version of NodeJS ', () => {
  it('Should test version assert', async () => {
    const { version } = process;
    const check = parseFloat(version.substring(1, version.length)) >= 18.0;
    console.log(`version: ${version}`);
    console.log(`check: ${check}`);
    assert.equal(check, true);
  });
});
