module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ],
    // Reanimated 4 moved the Babel plugin into react-native-worklets. It must
    // stay LAST in the list. (The old "react-native-reanimated/plugin" path is a
    // deprecated shim that just re-exports this one.)
    plugins: ["react-native-worklets/plugin"]
  };
};
