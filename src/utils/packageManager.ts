import path from "path";
import fs from "fs-extra";

import { logger } from "./logger";

/**
 * Available package managers
 */
type PackageManager = "npm" | "yarn" | "pnpm";

/**
 * Detect which package manager is being used in the project
 * @returns The detected package manager command ('npm', 'yarn', or 'pnpm')
 */
export function detectPackageManager(): PackageManager {
  const cwd = process.cwd();

  // Check for lockfiles
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    logger.debug("Detected pnpm lockfile");
    return "pnpm";
  }

  if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    logger.debug("Detected yarn lockfile");
    return "yarn";
  }

  if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
    logger.debug("Detected npm lockfile");
    return "npm";
  }

  // Check for packageManager field in package.json
  try {
    const packageJsonPath = path.join(cwd, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = fs.readJSONSync(packageJsonPath);
      if (packageJson.packageManager) {
        if (packageJson.packageManager.startsWith("pnpm")) {
          logger.debug("Detected pnpm in packageManager field");
          return "pnpm";
        }
        if (packageJson.packageManager.startsWith("yarn")) {
          logger.debug("Detected yarn in packageManager field");
          return "yarn";
        }
        if (packageJson.packageManager.startsWith("npm")) {
          logger.debug("Detected npm in packageManager field");
          return "npm";
        }
      }
    }
  } catch (error) {
    logger.debug(`Error reading package.json: ${error}`);
  }

  // Default to npm
  logger.debug("No package manager detected, defaulting to npm");
  return "npm";
}

/**
 * Get the install command for the detected package manager
 * @returns The install command for the detected package manager
 */
export function getInstallCommand(): string {
  const packageManager = detectPackageManager();

  switch (packageManager) {
    case "yarn":
      return "yarn add";
    case "pnpm":
      return "pnpm add";
    case "npm":
    default:
      return "npm install";
  }
}

/**
 * Get the dev install command for the detected package manager
 * @returns The dev install command for the detected package manager
 */
export function getDevInstallCommand(): string {
  const packageManager = detectPackageManager();

  switch (packageManager) {
    case "yarn":
      return "yarn add -D";
    case "pnpm":
      return "pnpm add -D";
    case "npm":
    default:
      return "npm install --save-dev";
  }
}
