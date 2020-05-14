import fs, { rmdirSync } from 'fs';
import path from 'path';
import webpack, { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';
import EventHooksPlugin from 'event-hooks-webpack-plugin';
import { emitMessage, extensions as fallbackExtensions } from '../../utils';
import { Config, WebpackMessage, Options } from '../../types';

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import loadStorybookWebpackConfig from '@storybook/core/dist/server/config';

let isInitiated = false;
let filePath = 'storybook.js';

// TODO Output summary of success builds
// TODO send messages to master process
function handleWebpackBuild(error: Error, stats: webpack.Stats): void {
  if (error || !stats || stats.hasErrors()) {
    emitMessage<WebpackMessage>({ type: isInitiated ? 'rebuild failed' : 'failed' });
    console.error('=> Failed to build the preview'); // TODO Change message

    if (error) return console.error(error.message);
    if (stats && (stats.hasErrors() || stats.hasWarnings())) {
      const { warnings, errors } = stats.toJson();

      errors.forEach((e) => console.error(e));
      warnings.forEach((e) => console.error(e));

      return;
    }
  }
  stats.toJson().warnings.forEach((e) => console.warn(e));

  if (!isInitiated) {
    isInitiated = true;
    emitMessage<WebpackMessage>({ type: 'ready', payload: { filePath } });
  } else {
    emitMessage<WebpackMessage>({ type: 'rebuild succeeded' });
  }

  return;
}

export default async function compile(config: Config, { debug }: Options): Promise<void> {
  const storybookCorePath = require.resolve('@storybook/core');
  const [storybookParentDirectory] = storybookCorePath.split('@storybook');
  const startStorybookBinaryPath = path.join(storybookParentDirectory, '.bin/start-storybook');
  const startStorybookRelativePath = fs.readlinkSync(startStorybookBinaryPath);
  const [, , storybookFramework] = startStorybookRelativePath.split(path.sep);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: storybookFrameworkOptions } = require(`@storybook/${storybookFramework}/dist/server/options`);

  // TODO Move into node_modules/.cache
  const outputDir = path.join(config.reportDir, 'storybook');
  filePath = path.join(outputDir, path.basename(filePath));

  rmdirSync(outputDir, { recursive: true });

  const storybookWebpackConfig: Configuration = await loadStorybookWebpackConfig({
    quiet: true,
    configType: 'PRODUCTION',
    outputDir,
    cache: {},
    corePresets: [require.resolve('@storybook/core/dist/server/preview/preview-preset')],
    overridePresets: [require.resolve('@storybook/core/dist/server/preview/custom-webpack-preset')],
    ...storybookFrameworkOptions,
    configDir: config.storybookDir,
  });

  const extensions = storybookWebpackConfig.resolve?.extensions ?? fallbackExtensions;

  delete storybookWebpackConfig.optimization;
  delete storybookWebpackConfig.devtool;
  storybookWebpackConfig.mode = 'development';
  storybookWebpackConfig.target = 'node';
  storybookWebpackConfig.output = {
    ...storybookWebpackConfig.output,
    filename: path.basename(filePath),
  };
  storybookWebpackConfig.module?.rules.unshift({
    enforce: 'pre',
    test: new RegExp(`\\.(${extensions.map((x) => x.slice(1))?.join('|')})$`),
    exclude: /node_modules/,
    use: { loader: require.resolve('./loader'), options: { debug } },
  });
  // TODO Remove this after migrate react-ui to cjs
  storybookWebpackConfig.externals = [
    nodeExternals({ whitelist: [/^@skbkontur/, /^@babel\/runtime/] }),
    // TODO Don't work well with monorepos
    nodeExternals({ modulesDir: storybookParentDirectory }),
  ];
  storybookWebpackConfig.plugins?.push(
    new EventHooksPlugin({
      invalid() {
        emitMessage<WebpackMessage>({ type: 'rebuild started' });
      },
    }),
  );

  const storybookWebpackCompiler = webpack(storybookWebpackConfig);

  storybookWebpackCompiler.watch({}, handleWebpackBuild);
}