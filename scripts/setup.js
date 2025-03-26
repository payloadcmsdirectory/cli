#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Ensure bin directory has executable permissions
try {
  const binPath = path.join(__dirname, "..", "bin", "index.js");

  if (fs.existsSync(binPath)) {
    // Make the bin file executable (chmod +x)
    fs.chmodSync(binPath, "755");
    console.log("✅ Made bin/index.js executable");
  } else {
    console.log("⚠️ bin/index.js not found, skipping chmod");
  }
} catch (error) {
  console.error("Error setting permissions:", error);
}

// Create symlink for local development if needed
if (process.argv.includes("--link")) {
  try {
    execSync("npm link", { stdio: "inherit" });
    console.log("✅ Linked package globally");
  } catch (error) {
    console.error("Error linking package:", error);
  }
}

console.log("�� Setup complete!");
