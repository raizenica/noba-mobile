// Copyright (c) 2024-2026 Kevin Van Nieuwenhove. All rights reserved.
// NOBA Command Center — Licensed under Apache 2.0.
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
