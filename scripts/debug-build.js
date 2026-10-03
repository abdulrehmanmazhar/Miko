import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";

import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

// ============================================================
// Paths
// ============================================================

const rootDir = resolve(import.meta.dirname, "..");

const envPath = join(rootDir, ".env");

const neutralinoDistApp = join(rootDir, "apps", "neutralino", "dist", "todo");

const debugRoot = join(rootDir, "dist", "msix", "debug");

const layoutDir = join(debugRoot, "layout");

const assetsDir = join(layoutDir, "Assets");

const outputMsix = join(debugRoot, "Todo.msix");

const certificateDir = join(rootDir, ".msix");

const certificatePfx = join(certificateDir, "FiggoTodo.Debug.pfx");

const certificateCer = join(certificateDir, "FiggoTodo.Debug.cer");

// ============================================================
// Environment
// ============================================================

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`.env file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

loadEnvFile(envPath);

// ============================================================
// MSIX configuration
// ============================================================

const config = {
  identityName: requiredEnv("MSIX_IDENTITY_NAME"),
  publisher: requiredEnv("MSIX_PUBLISHER"),

  displayName: process.env.MSIX_DISPLAY_NAME ?? "Todo",

  publisherDisplayName: process.env.MSIX_PUBLISHER_DISPLAY_NAME ?? "Figgo Labs",

  description: process.env.MSIX_DESCRIPTION ?? "Todo application",

  executable: process.env.MSIX_EXECUTABLE ?? "todo-win_x64.exe",

  version: process.env.MSIX_VERSION ?? "1.0.0.0",
};

// ============================================================
// Utility
// ============================================================

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function copyRecursiveSync(source, destination) {
  mkdirSync(destination, {
    recursive: true,
  });

  for (const entry of readdirSync(source, {
    withFileTypes: true,
  })) {
    const sourcePath = join(source, entry.name);

    const destinationPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      copyRecursiveSync(sourcePath, destinationPath);

      continue;
    }

    if (entry.isFile()) {
      copyFileSync(sourcePath, destinationPath);
    }
  }
}

// ============================================================
// Windows SDK
// ============================================================

function findSdkTool(toolName) {
  const sdkRoots = [
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin",
    "C:\\Program Files\\Windows Kits\\10\\bin",
  ];

  const candidates = [];

  for (const sdkRoot of sdkRoots) {
    if (!existsSync(sdkRoot)) {
      continue;
    }

    for (const version of readdirSync(sdkRoot)) {
      const toolPath = join(sdkRoot, version, "x64", toolName);

      if (existsSync(toolPath)) {
        candidates.push({
          version,
          path: toolPath,
        });
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(`${toolName} was not found in the Windows SDK.`);
  }

  candidates.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );

  return candidates[0].path;
}

// ============================================================
// Prepare staging
// ============================================================

function prepareStaging() {
  console.log("Cleaning debug staging directory...");

  rmSync(debugRoot, {
    recursive: true,
    force: true,
  });

  mkdirSync(assetsDir, {
    recursive: true,
  });
}

// ============================================================
// Copy Neutralino application
// ============================================================

function copyAppPayload() {
  if (!existsSync(neutralinoDistApp)) {
    throw new Error(
      `Neutralino build directory does not exist:\n${neutralinoDistApp}`,
    );
  }

  console.log("Copying Neutralino application...");

  for (const entry of readdirSync(neutralinoDistApp, {
    withFileTypes: true,
  })) {
    const sourcePath = join(neutralinoDistApp, entry.name);

    const destinationPath = join(layoutDir, entry.name);

    // Copy directories such as extensions/
    if (entry.isDirectory()) {
      copyRecursiveSync(sourcePath, destinationPath);

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    // Ignore temporary/log files.
    if (entry.name.endsWith(".tmp") || entry.name.endsWith(".log")) {
      continue;
    }

    // Ignore binaries for other platforms.
    if (
      entry.name.includes("-linux_") ||
      entry.name.includes("-mac_") ||
      entry.name.endsWith(".so") ||
      entry.name.endsWith(".dylib")
    ) {
      continue;
    }

    console.log(`  ${entry.name}`);

    copyFileSync(sourcePath, destinationPath);
  }
}

function copyPackageAssets(destinationAssetsDir) {
  const iconCandidates = [
    process.env.MSIX_ICON_PATH?.trim(),
    join(rootDir, "apps", "neutralino", "resources", "icons", "appIcon.png"),
  ].filter(Boolean);

  const iconPath = iconCandidates.find((candidate) => existsSync(candidate));
  if (!iconPath) {
    throw new Error(
      "No package icon found. Set MSIX_ICON_PATH or provide apps/neutralino/resources/icons/appIcon.png",
    );
  }

  // Store certification prefers correct sizes; one PNG is enough for local packaging.
  const assetNames = [
    "StoreLogo.png",
    "Square44x44Logo.png",
    "Square150x150Logo.png",
    "Wide310x150Logo.png",
    "SplashScreen.png",
  ];

  for (const name of assetNames) {
    copyFileSync(iconPath, join(destinationAssetsDir, name));
  }
}

// ============================================================
// Package manifest
// ============================================================

function writeAppxManifest() {
  const manifestPath = join(layoutDir, "AppxManifest.xml");

  //   const manifest = `<?xml version="1.0" encoding="utf-8"?>

  // <Package
  //     xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  //     xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  //   xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  //     xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">

  //   <Identity
  //       Name="${escapeXml(config.identityName)}"
  //       Publisher="${escapeXml(config.publisher)}"
  //       Version="${escapeXml(config.version)}"
  //       ProcessorArchitecture="x64" />

  //   <Properties>
  //     <DisplayName>${escapeXml(config.displayName)}</DisplayName>
  //     <PublisherDisplayName>${escapeXml(config.publisherDisplayName)}</PublisherDisplayName>
  //     <Description>${escapeXml(config.description)}</Description>
  //     <Logo>Assets\\StoreLogo.png</Logo>
  //   </Properties>

  //   <Resources>
  //     <Resource Language="en-us" />
  //   </Resources>

  //   <Dependencies>
  //     <TargetDeviceFamily
  //         Name="Windows.Desktop"
  //         MinVersion="10.0.17763.0"
  //         MaxVersionTested="10.0.26100.0" />
  //   </Dependencies>

  //   <Applications>

  //     <Application
  //         Id="App"
  //         Executable="${escapeXml(config.executable)}"
  //         EntryPoint="Windows.FullTrustApplication">

  //       <uap:VisualElements
  //           DisplayName="${escapeXml(config.displayName)}"
  //           Description="${escapeXml(config.description)}"
  //           BackgroundColor="#FFFFFF"
  //           Square150x150Logo="Assets\\Square150x150Logo.png"
  //           Square44x44Logo="Assets\\Square44x44Logo.png" />

  //     </Application>

  //     <Application
  //       Id="Server"
  //       Executable="extensions\\dist\\server.exe"
  //       EntryPoint="Windows.FullTrustApplication"
  //       uap10:RuntimeBehavior="packagedClassicApp"
  //       uap10:TrustLevel="mediumIL">

  //       <uap:VisualElements
  //           AppListEntry="none"
  //           DisplayName="Figgo Todo Server"
  //           Description="Figgo Todo backend service."
  //           BackgroundColor="#FFFFFF"
  //           Square150x150Logo="Assets\\Square150x150Logo.png"
  //           Square44x44Logo="Assets\\Square44x44Logo.png" />

  //     </Application>

  //   </Applications>

  //   <Capabilities>
  //     <rescap:Capability Name="runFullTrust" />
  //   </Capabilities>

  // </Package>
  // `;

  const manifest = `<?xml version="1.0" encoding="utf-8"?>

<Package
    xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
    xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
    xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
    xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
    xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
    xmlns:uap11="http://schemas.microsoft.com/appx/manifest/uap/windows10/11"
    xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
    IgnorableNamespaces="uap uap3 desktop uap10 uap11">

  <Identity
      Name="${escapeXml(config.identityName)}"
      Publisher="${escapeXml(config.publisher)}"
      Version="${escapeXml(config.version)}"
      ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>${escapeXml(config.displayName)}</DisplayName>
    <PublisherDisplayName>${escapeXml(config.publisherDisplayName)}</PublisherDisplayName>
    <Description>${escapeXml(config.description)}</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Dependencies>
    <TargetDeviceFamily
        Name="Windows.Desktop"
        MinVersion="10.0.17763.0"
        MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Applications>

    <Application
        Id="App"
        Executable="${escapeXml(config.executable)}"
        EntryPoint="Windows.FullTrustApplication">

      <uap:VisualElements
          DisplayName="${escapeXml(config.displayName)}"
          Description="${escapeXml(config.description)}"
          BackgroundColor="#FFFFFF"
          Square150x150Logo="Assets\\StoreLogo.png"
          Square44x44Logo="Assets\\StoreLogo.png" />

      <!-- Fixed Container: The root block must be the base namespace <Extensions> -->
      <Extensions>
        <uap3:Extension
            Category="windows.appExecutionAlias"
            Executable="extensions\\dist\\server.exe"
          EntryPoint="Windows.FullTrustApplication"
            uap11:Subsystem="console">
          <uap3:AppExecutionAlias>
            <desktop:ExecutionAlias Alias="figgo-todo-server.exe" />
          </uap3:AppExecutionAlias>
        </uap3:Extension>
      </Extensions>

    </Application>

  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>

</Package>
`;

  writeFileSync(manifestPath, manifest, "utf8");

  console.log("Created AppxManifest.xml");
}

// ============================================================
// Development certificate
// ============================================================

function ensureCertificate() {
  mkdirSync(certificateDir, {
    recursive: true,
  });

  if (existsSync(certificatePfx) && existsSync(certificateCer)) {
    console.log("Using existing debug certificate.");

    return;
  }

  console.log("Creating development certificate...");

  const certificatePassword =
    process.env.MSIX_DEBUG_CERT_PASSWORD ?? "figgo-debug";

  const command = [
    `$ErrorActionPreference = "Stop"`,
    ``,
    `$cert = New-SelfSignedCertificate \``,
    `  -Type Custom \``,
    `  -KeyUsage DigitalSignature \``,
    `  -Subject "${config.publisher}" \``,
    `  -CertStoreLocation "Cert:\\CurrentUser\\My" \``,
    `  -TextExtension @(`,
    `    "2.5.29.37={text}1.3.6.1.5.5.7.3.3",`,
    `    "2.5.29.19={text}"`,
    `  )`,
    ``,
    `$password = ConvertTo-SecureString \``,
    `  "${certificatePassword}" \``,
    `  -AsPlainText \``,
    `  -Force`,
    ``,
    `Export-PfxCertificate \``,
    `  -Cert $cert \``,
    `  -FilePath "${certificatePfx}" \``,
    `  -Password $password | Out-Null`,
    ``,
    `Export-Certificate \``,
    `  -Cert $cert \``,
    `  -FilePath "${certificateCer}" | Out-Null`,
    ``,
    `Write-Host $cert.Thumbprint`,
  ].join("\n");

  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      stdio: "inherit",
    },
  );

  console.log("Development certificate created.");
}

// ============================================================
// Trust development certificate
// ============================================================

function trustCertificate() {
  console.log("Trusting development certificate...");

  const elevatedCommand = `
$ErrorActionPreference = "Stop"

$cert = Get-PfxCertificate -FilePath "${certificateCer}"

foreach ($store in @("Cert:\\LocalMachine\\Root", "Cert:\\LocalMachine\\TrustedPeople")) {
  $existing = Get-ChildItem -Path $store |
    Where-Object { $_.Thumbprint -eq $cert.Thumbprint }

  if (-not $existing) {
    Import-Certificate -FilePath "${certificateCer}" -CertStoreLocation $store | Out-Null
    Write-Host "Trusted certificate in \${store}:"
    Write-Host $cert.Thumbprint
  }
}

Write-Host "Certificate trust is ready:"
Write-Host $cert.Thumbprint
`.trim();

  const encodedCommand = Buffer.from(elevatedCommand, "utf16le").toString(
    "base64",
  );

  const command = `
$process = Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait -PassThru -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-EncodedCommand",
  "${encodedCommand}"
)

if ($process.ExitCode -ne 0) {
  exit $process.ExitCode
}
`.trim();

  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      stdio: "inherit",
    },
  );

  console.log("Development certificate trusted.");
}

// ============================================================
// Pack MSIX
// ============================================================

function packMsix() {
  const makeAppx = findSdkTool("makeappx.exe");

  console.log("");
  console.log("Using makeappx:");
  console.log(makeAppx);
  console.log("");

  execFileSync(makeAppx, ["pack", "/d", layoutDir, "/p", outputMsix, "/o"], {
    stdio: "inherit",
  });

  console.log("");
  console.log(`MSIX created: ${outputMsix}`);
}

// ============================================================
// Sign MSIX
// ============================================================

function signMsix() {
  const signtool = findSdkTool("signtool.exe");

  const certificatePassword =
    process.env.MSIX_DEBUG_CERT_PASSWORD ?? "figgo-debug";

  console.log("");
  console.log("Using signtool:");
  console.log(signtool);
  console.log("");

  execFileSync(
    signtool,
    [
      "sign",
      "/fd",
      "SHA256",
      "/f",
      certificatePfx,
      "/p",
      certificatePassword,
      outputMsix,
    ],
    {
      stdio: "inherit",
    },
  );

  console.log("");
  console.log("MSIX signed successfully.");
}

// ============================================================
// Verify MSIX signature
// ============================================================

function verifySignature() {
  const signtool = findSdkTool("signtool.exe");

  console.log("");
  console.log("Verifying MSIX signature...");
  console.log("");

  execFileSync(signtool, ["verify", "/pa", "/v", outputMsix], {
    stdio: "inherit",
  });

  console.log("");
  console.log("Signature verification successful.");
}

// ============================================================
// Install MSIX
// ============================================================

function installMsix() {
  console.log("");
  console.log("Installing debug MSIX...");
  console.log("");

  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Add-AppxPackage -Path "${outputMsix}"`,
    ],
    {
      stdio: "inherit",
    },
  );

  console.log("");
  console.log("Debug MSIX installed.");
}

// ============================================================
// Main
// ============================================================

function main() {
  const shouldInstall = process.argv.includes("--install");

  console.log("");
  console.log("========================================");
  console.log(" Figgo Todo - Debug MSIX Build");
  console.log("========================================");
  console.log("");

  console.log("Identity:");
  console.log(`  ${config.identityName}`);

  console.log("Publisher:");
  console.log(`  ${config.publisher}`);

  console.log("");

  prepareStaging();

  copyAppPayload();

  copyPackageAssets(assetsDir);

  writeAppxManifest();

  ensureCertificate();

  trustCertificate();

  packMsix();

  signMsix();

  verifySignature();

  if (shouldInstall) {
    installMsix();
  }

  console.log("");
  console.log("========================================");
  console.log(" Debug build completed");
  console.log("========================================");
  console.log("");

  console.log(`MSIX: ${outputMsix}`);

  console.log("");

  if (!shouldInstall) {
    console.log("Install with:");

    console.log("");

    console.log("npm run msix:debug -- --install");

    console.log("");
  }
}

// ============================================================
// Execute
// ============================================================

try {
  main();
} catch (error) {
  console.error("");
  console.error("Debug MSIX build failed.");
  console.error("");
  console.error(error.message);
  console.error("");

  process.exit(1);
}
