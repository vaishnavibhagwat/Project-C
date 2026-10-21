import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => {
    // App chunking rules are for the production app bundle, not Storybook's own build.
    const output = viteConfig.build?.rollupOptions?.output;
    if (output && !Array.isArray(output)) delete output.manualChunks;
    return viteConfig;
  },
};

export default config;
