import { execSync } from "child_process";
import path from "path";
import chalk from "chalk";
import fs from "fs-extra";

import { ShadcnPluginInstaller } from "../plugins/shadcn/installer";
import { logger } from "./logger";
import { detectPackageManager } from "./packageManager";

export interface PluginInfo {
  name: string;
  packageName: string;
  description: string;
  version?: string;
  category: "ui" | "utilities" | "integrations" | "other";
  homepage?: string;
  repository?: string;
  dependencies?: string[];
  devDependencies?: string[];
  configFiles?: {
    tailwind?: string[]; // possible locations of tailwind config
    postcss?: string[]; // possible locations of postcss config
    css?: string[]; // possible locations of main CSS file
  };
  configOption?: string;
  configImport?: string;
  postInstallFunction?: () => Promise<void>;
  postInstallSteps?: (string | (() => Promise<void>))[];
  nextSteps?: string;
}

/**
 * Check the installed Tailwind CSS version
 * @returns Object containing version number and path to installed package
 */
export async function checkTailwindVersion(): Promise<{
  version: number;
  path: string | null;
}> {
  try {
    // Try to find tailwindcss in node_modules
    const possiblePaths = [
      path.join(process.cwd(), "node_modules/tailwindcss/package.json"),
      path.join(process.cwd(), "../node_modules/tailwindcss/package.json"), // For monorepo setups
    ];

    for (const pkgPath of possiblePaths) {
      if (await fs.pathExists(pkgPath)) {
        const pkgJson = await fs.readJson(pkgPath);
        const versionStr = pkgJson.version || "0.0.0";
        const majorVersion = parseInt(versionStr.split(".")[0], 10);
        return { version: majorVersion, path: pkgPath };
      }
    }

    // Try to check installed version using npm list
    try {
      const output = execSync("npm list tailwindcss --json", {
        stdio: "pipe",
      }).toString();
      const npmList = JSON.parse(output);
      if (npmList.dependencies?.tailwindcss?.version) {
        const versionStr = npmList.dependencies.tailwindcss.version;
        const majorVersion = parseInt(versionStr.split(".")[0], 10);
        return { version: majorVersion, path: null };
      }
    } catch (e) {
      // Ignore npm list errors
    }

    // Not found
    return { version: 0, path: null };
  } catch (error) {
    logger.debug(`Error checking Tailwind version: ${error}`);
    return { version: 0, path: null };
  }
}

/**
 * Find a configuration file from a list of possible paths
 * @param possiblePaths Array of possible file paths
 * @returns The first matching path that exists, or null if none found
 */
export async function findConfigFile(
  possiblePaths: string[],
): Promise<string | null> {
  for (const filePath of possiblePaths) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Create a backup of a file with .bak extension
 * @param filePath Path to the file to backup
 * @returns Path to the backup file or null if backup failed
 */
export async function backupFile(filePath: string): Promise<string | null> {
  try {
    const backupPath = `${filePath}.bak`;
    if (await fs.pathExists(filePath)) {
      await fs.copy(filePath, backupPath);
      return backupPath;
    }
    return null;
  } catch (error) {
    logger.debug(`Error creating backup of ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Calculate a relative path between two files
 * @param from Source file path
 * @param to Target file path
 * @returns Relative path suitable for import statements
 */
export function calculateRelativePath(from: string, to: string): string {
  let relativePath = path.relative(path.dirname(from), path.dirname(to));

  // Ensure path starts with ./ or ../
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Add filename
  relativePath = path.join(relativePath, path.basename(to));

  // Convert backslashes to forward slashes (for Windows)
  relativePath = relativePath.replace(/\\/g, "/");

  return relativePath;
}

// List of available plugins
export const availablePlugins: PluginInfo[] = [
  {
    name: "ShadCN UI",
    packageName: "@payloadcmsdirectory/shadcn-ui",
    description:
      "Beautifully designed components built with Radix UI and Tailwind CSS",
    category: "ui",
    repository: "https://github.com/payloadcmsdirectory/shadcn-ui",
    dependencies: ["@payloadcmsdirectory/shadcn-ui"],
    devDependencies: [
      "tailwindcss@latest",
      "postcss",
      "autoprefixer",
      "tailwindcss-animate",
    ],
    configOption: "shadcnPlugin",
    configImport:
      "import { shadcnPlugin } from '@payloadcmsdirectory/shadcn-ui';",
    configFiles: {
      tailwind: [
        "tailwind.config.js",
        "tailwind.config.mjs",
        "tailwind.config.ts",
      ],
      postcss: [
        "postcss.config.js",
        "postcss.config.cjs",
        "postcss.config.mjs",
      ],
      css: [
        "src/styles/globals.css",
        "styles/globals.css",
        "src/app/globals.css",
        "app/globals.css",
      ],
    },
    postInstallFunction: async () => {
      const installer = new ShadcnPluginInstaller();
      await installer.install({});
    },
  },
  // Add more plugins here as they become available
];

/**
 * Get a plugin by its package name, supporting both full package names and simpler aliases
 */
export function getPluginByName(
  packageName: string | undefined,
): PluginInfo | undefined {
  if (!packageName) return undefined;

  // Try direct match first
  const directMatch = availablePlugins.find(
    (plugin) => plugin.packageName === packageName,
  );
  if (directMatch) return directMatch;

  // Try to find by the last part of the package name (after the last slash)
  // This allows users to type 'shadcn-ui' instead of '@payloadcmsdirectory/shadcn-ui'
  const simpleName = packageName.includes("/")
    ? packageName
    : packageName.toLowerCase().replace(/[^a-z0-9-]/g, "");

  return availablePlugins.find((plugin) => {
    // Check if the simple name matches the last part of the package
    const pluginSimpleName = plugin.packageName
      .split("/")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    return (
      pluginSimpleName === simpleName ||
      // Compatibility with hyphenated vs non-hyphenated versions
      pluginSimpleName?.replace(/-/g, "") === simpleName.replace(/-/g, "")
    );
  });
}

/**
 * Filter plugins by category
 */
export function getPluginsByCategory(
  category: PluginInfo["category"],
): PluginInfo[] {
  return availablePlugins.filter((plugin) => plugin.category === category);
}
