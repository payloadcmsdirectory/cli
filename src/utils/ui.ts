import chalk from "chalk";

import { packageVersion } from "./version";

/**
 * ASCII art banner for the CLI
 */
const ASCII_BANNER = `
╔═════════════════════════════════════════╗
║                                         ║
║            ██████╗    ██████╗           ║
║            ██╔══██╗   ██╔══██╗          ║
║            ██████╔╝   ██║  ██║          ║
║            ██╔═══╝    ██║  ██║          ║
║            ██║        ██████╔╝          ║
║            ╚═╝        ╚═════╝           ║
║                                         ║
║           PayloadCMS.Directory          ║
║                                         ║
╚═════════════════════════════════════════╝
`;

/**
 * Displays the CLI banner with version and colors
 */
export function displayBanner() {
  // Print colorful ASCII banner with gradient
  const lines = ASCII_BANNER.split("\n");
  lines.forEach((line, i) => {
    // Create a blue to cyan gradient
    const color = i / lines.length;
    console.log(chalk.rgb(41, 128, 185 - Math.floor(color * 50))(line));
  });

  // Print version and description
  console.log(
    chalk.bold.blue("📦 PayloadCMS Directory CLI") +
      chalk.gray(` v${packageVersion}`),
  );
  console.log(chalk.gray("The unofficial CLI tool for PayloadCMS"));
  console.log(); // Empty line for spacing
}

/**
 * Creates a boxed section with a title
 */
export function createSection(title: string, description?: string) {
  console.log(chalk.bold.blue(`\n${title}`));
  if (description) {
    console.log(chalk.white(description));
  }
}

/**
 * Formats a code block
 */
export function codeBlock(code: string) {
  console.log(chalk.gray("```"));
  console.log(chalk.white(code));
  console.log(chalk.gray("```"));
}

/**
 * Creates a formatted list item with an icon
 */
export function listItem(text: string, icon?: string) {
  console.log(`${icon ? `${icon} ` : ""}${text}`);
}
