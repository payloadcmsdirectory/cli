import { Command } from "commander";

import { ShadcnPluginInstaller } from "../plugins";
import { logger } from "../utils/logger";

const PLUGIN_INSTALLERS = {
  shadcn: ShadcnPluginInstaller,
} as const;

type PluginType = keyof typeof PLUGIN_INSTALLERS;

export const installPlugin = new Command()
  .name("install-plugin")
  .description("Install and configure a Payload CMS plugin")
  .argument(
    "<plugin>",
    `Plugin to install (${Object.keys(PLUGIN_INSTALLERS).join(", ")})`,
  )
  .option("--force", "Force installation even if plugin is already installed")
  .action(async (pluginName: string, options: { force?: boolean }) => {
    try {
      const plugin = pluginName.toLowerCase() as PluginType;

      if (!Object.keys(PLUGIN_INSTALLERS).includes(plugin)) {
        logger.error(`Unknown plugin: ${pluginName}`);
        logger.info(
          `Available plugins: ${Object.keys(PLUGIN_INSTALLERS).join(", ")}`,
        );
        process.exit(1);
      }

      const InstallerClass = PLUGIN_INSTALLERS[plugin];
      const installer = new InstallerClass();

      await installer.install({ force: options.force });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to install plugin: ${error.message}`);
      } else {
        logger.error("An unknown error occurred while installing the plugin");
      }
      process.exit(1);
    }
  });
