module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // WatermelonDB decorators install getters/setters on the prototype.
    // Default class-field semantics (`Object.defineProperty`) shadow
    // them with own undefined fields, which silently breaks every
    // model. `setPublicClassFields: true` falls back to `[[Set]]`
    // semantics so decorator-defined accessors win.
    assumptions: { setPublicClassFields: true },
    plugins: [
      // WatermelonDB requires legacy decorators for its `@field`,
      // `@text`, `@relation` model annotations.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // Loose class-properties pairs with the decorator legacy mode.
      // Without this Babel emits class-field initializers that the
      // legacy-decorator transform rejects with "Definitely assigned
      // fields cannot be initialized here".
      ['@babel/plugin-transform-class-properties', { loose: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
