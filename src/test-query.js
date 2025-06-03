//const { findTDsByType } = require("./td-filter");
const { findTDsByTypes } = require("./td-filter");
// const { findTDsByType, findTDsByTypes } = require("./td-filter");

async function test() {
   // const tds = await findTDsByType("temperature");
    const tds = await findTDsByTypes(["temperature", "humidity"]);
    console.log(JSON.stringify(tds, null, 2));
}

test();

