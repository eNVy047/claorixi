const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to enable android.r8.optimizedResourceShrinking
 */
module.exports = function withOptimizedResourceShrinking(config) {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'android.r8.optimizedResourceShrinking',
      value: 'true',
    });
    return config;
  });
};
