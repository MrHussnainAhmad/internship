"use strict";

require("./patch-readlink.cjs");

const [, , ...args] = process.argv;
const nextBin = require.resolve("next/dist/bin/next");
process.argv = [process.execPath, nextBin, ...args];
require(nextBin);
