// Keep Metro scoped to this Expo app. The parent folder may itself belong to a
// separate workspace, which would otherwise make Metro crawl unrelated files.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// The user's home folder is a broad Git worktree. Explicitly keep Metro inside
// this app so export/start never crawls unrelated private folders.
config.watchFolders = [];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
