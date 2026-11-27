export function createInputHolds(onChange) {
  const sources = new Map();
  return {
    press(source, input) {
      if (sources.has(source)) return;
      const alreadyHeld = [...sources.values()].includes(input);
      sources.set(source, input);
      if (!alreadyHeld) onChange(input, true);
    },
    release(source) {
      if (!sources.has(source)) return;
      const input = sources.get(source);
      sources.delete(source);
      if (![...sources.values()].includes(input)) onChange(input, false);
    },
    clear() {
      for (const input of new Set(sources.values())) onChange(input, false);
      sources.clear();
    },
  };
}
