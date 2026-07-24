const { defineConfig } = require("vitest/config");

// Los tests legacy (tests/*.test.js) son scripts a la antigua que llaman
// process.exit() al terminar — si Vitest los recogiera junto a los nuevos,
// ese process.exit() mataría el worker a mitad de la corrida. Por eso los
// suites nuevas usan el sufijo .vitest.test.js y el include las aísla.
module.exports = defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.vitest.test.js"],
    testTimeout: 10000,
  },
});
