import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = join(rootDir, "dist");
const migrationsSourceDir = join(rootDir, "migrations");
const migrationsDistDir = join(distDir, "migrations");
const bundlePath = join(distDir, "index.cjs");
const blobPath = join(distDir, "sea.blob");
const configPath = join(distDir, "sea-config.json");
const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf8"),
);
const externalizedPackages = packageJson.externalize ?? [];
if (
  !Array.isArray(externalizedPackages) ||
  externalizedPackages.some(
    (packageName) =>
      typeof packageName !== "string" || packageName.length === 0,
  )
) {
  throw new Error(
    '"externalize" must be an array of non-empty package name strings',
  );
}
if (!packageJson.name || !packageJson.version) {
  throw new Error('package.json must define "name" and "version"');
}
const runtimeDependencies = Object.fromEntries(
  externalizedPackages.map((packageName) => {
    const version = packageJson.dependencies?.[packageName];
    if (!version) {
      throw new Error(
        `Externalized package must be declared in dependencies: ${packageName}`,
      );
    }
    return [packageName, version];
  }),
);
const executableName =
  process.platform === "win32" ? `${packageJson.name}.exe` : packageJson.name;
const executablePath = join(distDir, executableName);

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [join(rootDir, "src/index.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: externalizedPackages,
  sourcemap: true,
  legalComments: "none",
  define: {
    "import.meta.dirname": "__dirname",
    "import.meta.filename": "__filename",
  },
});
assertFile(bundlePath, "bundled entrypoint");

writeFileSync(
  join(distDir, "package.json"),
  `${JSON.stringify({ name: `${packageJson.name}-runtime`, private: true, dependencies: runtimeDependencies }, null, 2)}\n`,
);

if (externalizedPackages.length > 0) {
  const npmCliPath = join(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  run(process.execPath, [npmCliPath, "install", "--omit=dev"], distDir);
  assertDirectory(join(distDir, "node_modules"), "runtime node_modules");
  assertFile(join(distDir, "package-lock.json"), "runtime package lock");
}

writeFileSync(
  configPath,
  `${JSON.stringify(
    {
      main: bundlePath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useCodeCache: true,
      useSnapshot: false,
    },
    null,
    2,
  )}\n`,
);

run(process.execPath, ["--experimental-sea-config", configPath]);
assertFile(blobPath, "SEA blob");
copyFileSync(process.execPath, executablePath);
assertFile(executablePath, "SEA executable");

if (process.platform === "win32") {
  const signTool = findSdkTool("signtool.exe");
  if (!signTool) {
    throw new Error("SignTool.exe was not found in the Windows SDK.");
  }
  console.log("Removing Node.js signature");
  assertFile(executablePath, "SEA executable");

  run(signTool, ["remove", "/as", "/s", executablePath]);

  applyWindowsResources(executablePath, packageJson, executableName);
}

const postjectCliPath = join(
  rootDir,
  "node_modules",
  "postject",
  "dist",
  "cli.js",
);
run(process.execPath, [
  postjectCliPath,
  executablePath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
]);

rmSync(blobPath, { force: true });
rmSync(configPath, { force: true });

if (process.platform === "win32") {
  verifyWindowsResources(executablePath, packageJson, executableName);
}

for (const entry of readdirSync(distDir)) {
  if (
    !new Set([
      "node_modules",
      "package.json",
      "package-lock.json",
      executableName,
      "migrations",
    ]).has(entry)
  ) {
    rmSync(join(distDir, entry), { recursive: true, force: true });
  }
}

const allowedEntries = new Set([
  "node_modules",
  "package.json",
  "package-lock.json",
  executableName,
  "migrations",
]);
const unexpectedEntries = readdirSync(distDir).filter(
  (entry) => !allowedEntries.has(entry),
);
if (unexpectedEntries.length > 0) {
  throw new Error(
    `Build left unexpected dist entries: ${unexpectedEntries.join(", ")}`,
  );
}
assertFile(executablePath, "final SEA executable");

console.log(`SEA executable created at ${executablePath}`);

function run(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

function assertDirectory(directoryPath, label) {
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    throw new Error(`Missing ${label}: ${directoryPath}`);
  }
}

function verifyWindowsResources(filePath, metadata, originalFilename) {
  const escapedPath = filePath.replaceAll("'", "''");
  const description = (metadata.description || metadata.name).replaceAll(
    "'",
    "''",
  );
  const name = metadata.name.replaceAll("'", "''");
  const command = `$info = (Get-Item -LiteralPath '${escapedPath}').VersionInfo; if ($info.FileDescription -ne '${description}' -or $info.FileVersion -ne '${metadata.version}' -or $info.ProductName -ne '${name}' -or $info.ProductVersion -ne '${metadata.version}' -or $info.InternalName -ne '${name}' -or $info.OriginalFilename -ne '${originalFilename}') { exit 1 }; Add-Type -AssemblyName System.Drawing; $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${escapedPath}'); if ($null -eq $icon) { exit 1 }; $icon.Dispose()`;
  run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ]);
}

function applyWindowsResources(filePath, metadata, originalFilename) {
  const rceditBinary =
    process.arch === "ia32" ? "rcedit.exe" : "rcedit-x64.exe";
  const rceditPath = join(
    rootDir,
    "node_modules",
    "rcedit",
    "bin",
    rceditBinary,
  );
  assertFile(rceditPath, "rcedit binary");
  run(rceditPath, [
    filePath,
    "--set-version-string",
    "FileDescription",
    metadata.description || metadata.name,
    "--set-version-string",
    "FileVersion",
    metadata.version,
    "--set-version-string",
    "InternalName",
    metadata.name,
    "--set-version-string",
    "OriginalFilename",
    originalFilename,
    "--set-version-string",
    "ProductName",
    metadata.name,
    "--set-version-string",
    "ProductVersion",
    metadata.version,
  ]);
}

function findSdkTool(toolName) {
  const roots = [
    join(
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Windows Kits",
      "10",
      "bin",
    ),
    join(
      process.env.ProgramFiles || "C:\\Program Files",
      "Windows Kits",
      "10",
      "bin",
    ),
  ];

  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    for (const versionDir of readdirSync(root)) {
      const candidate = join(root, versionDir, "x64", toolName);
      if (existsSync(candidate)) {
        found.push({ versionDir, candidate });
      }
    }
  }

  found.sort((a, b) =>
    b.versionDir.localeCompare(a.versionDir, undefined, { numeric: true }),
  );

  return found[0]?.candidate ?? null;
}
