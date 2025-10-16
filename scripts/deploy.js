const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\n" + "=".repeat(70));
  console.log("🚀 DEPLOYING AARNA DEFI SUITE");
  console.log("=".repeat(70) + "\n");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HYPE\n");

  // Contract addresses (update these for mainnet)
  const DEBRIDGE_GATE = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA"; // deBridge Gate (update if needed)
  const USDC_ADDRESS = "0xb88339CB7199b77E23DB6E890353E22632Ba630f"; // USDC on HyperEVM
  const HYPERSWAP_ROUTER = "0xda0f518d521e0dE83fAdC8500C2D21b6a6C39bF9"; // HyperSwap V2 Router

  // ======================================
  // 1. Deploy AarnaBridge (deBridge)
  // ======================================
  console.log("📦 1/3 Deploying AarnaBridge (deBridge Integration)...\n");
  
  const AarnaBridge = await ethers.getContractFactory("AarnaBridge");
  const aarnaBridge = await AarnaBridge.deploy(DEBRIDGE_GATE, USDC_ADDRESS);
  await aarnaBridge.waitForDeployment();
  
  const aarnaBridgeAddress = await aarnaBridge.getAddress();
  console.log("✅ AarnaBridge deployed to:", aarnaBridgeAddress);
  console.log("   Owner:", await aarnaBridge.owner());
  console.log("   deBridge Gate:", await aarnaBridge.deBridgeGate());
  console.log("   USDC Address:", await aarnaBridge.usdcAddress());
  console.log("   Fee Recipient:", await aarnaBridge.feeRecipient());
  console.log("   Min Amount:", ethers.formatUnits(await aarnaBridge.minBridgeAmount(), 6), "USDC");
  console.log("   Max Amount:", ethers.formatUnits(await aarnaBridge.maxBridgeAmount(), 6), "USDC");
  console.log("   Slippage:", await aarnaBridge.slippageBps(), "bps");
  console.log("   Paused:", await aarnaBridge.paused());

  // ======================================
  // 2. Deploy HyperCoreEVMBridge
  // ======================================
  console.log("\n📦 2/3 Deploying HyperCoreEVMBridge...\n");
  
  const HyperCoreEVMBridge = await ethers.getContractFactory("HyperCoreEVMBridge");
  const bridge = await HyperCoreEVMBridge.deploy(deployer.address);
  await bridge.waitForDeployment();
  
  const bridgeAddress = await bridge.getAddress();
  console.log("✅ HyperCoreEVMBridge deployed to:", bridgeAddress);
  console.log("   Owner:", await bridge.owner());
  console.log("   Vault:", await bridge.vaultContract());
  console.log("   Paused:", await bridge.paused());

  // ======================================
  // 3. Deploy HyperSwap
  // ======================================
  console.log("\n📦 3/3 Deploying HyperSwap...\n");
  
  const HyperSwap = await ethers.getContractFactory("HyperSwap");
  const hyperSwap = await HyperSwap.deploy(HYPERSWAP_ROUTER);
  await hyperSwap.waitForDeployment();
  
  const hyperSwapAddress = await hyperSwap.getAddress();
  console.log("✅ HyperSwap deployed to:", hyperSwapAddress);
  console.log("   Owner:", await hyperSwap.owner());
  console.log("   Router:", await hyperSwap.hyperswapRouter());
  console.log("   Slippage:", await hyperSwap.defaultSlippageBps(), "bps (0.5%)");
  console.log("   Paused:", await hyperSwap.paused());

  // ======================================
  // 4. Display Supported Tokens
  // ======================================
  console.log("\n📋 Supported Tokens on HyperSwap:");
  const tokens = await hyperSwap.getSupportedTokens();
  
  const tokenNames = [
    "WHYPE",
    "USDT0",
    "USDC",
    "USDH",
    "USR",
    "sUSDe",
    "USDe",
    "UBTC",
    "wstHYPE",
    "UETH",
    "beHYPE",
    "USDHL",
    "USOL"
  ];
  
  tokens.forEach((token, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${tokenNames[i].padEnd(10)} → ${token}`);
  });

  // ======================================
  // 5. Get Bridge Statistics
  // ======================================
  console.log("\n📊 AarnaBridge Statistics:");
  const [totalDeposits, totalWithdrawals, totalFees] = await aarnaBridge.getStats();
  console.log("   Total Deposited:", ethers.formatUnits(totalDeposits, 6), "USDC");
  console.log("   Total Withdrawn:", ethers.formatUnits(totalWithdrawals, 6), "USDC");
  console.log("   Total Fees Collected:", ethers.formatEther(totalFees), "ETH");

  // ======================================
  // 6. Summary
  // ======================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\nContracts:");
  console.log("  AarnaBridge:          ", aarnaBridgeAddress);
  console.log("  HyperCoreEVMBridge:   ", bridgeAddress);
  console.log("  HyperSwap:            ", hyperSwapAddress);
  console.log("\nIntegrations:");
  console.log("  deBridge Gate:        ", DEBRIDGE_GATE);
  console.log("  HyperSwap Router:     ", HYPERSWAP_ROUTER);
  console.log("  USDC Address:         ", USDC_ADDRESS);
  console.log("=".repeat(70));
  
  console.log("\n✅ All contracts deployed successfully!\n");
  
  // ======================================
  // 7. Verification Commands
  // ======================================
  console.log("🔍 Verification Commands:\n");
  console.log("npx hardhat verify --network hyperevm " + aarnaBridgeAddress + ` "${DEBRIDGE_GATE}" "${USDC_ADDRESS}"`);
  console.log("npx hardhat verify --network hyperevm " + bridgeAddress + ` "${deployer.address}"`);
  console.log("npx hardhat verify --network hyperevm " + hyperSwapAddress + ` "${HYPERSWAP_ROUTER}"`);
  
  // ======================================
  // 8. Save Deployment Info
  // ======================================
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AarnaBridge: {
        address: aarnaBridgeAddress,
        deBridgeGate: DEBRIDGE_GATE,
        usdc: USDC_ADDRESS,
        minAmount: ethers.formatUnits(await aarnaBridge.minBridgeAmount(), 6),
        maxAmount: ethers.formatUnits(await aarnaBridge.maxBridgeAmount(), 6)
      },
      HyperCoreEVMBridge: {
        address: bridgeAddress,
        vault: await bridge.vaultContract()
      },
      HyperSwap: {
        address: hyperSwapAddress,
        router: HYPERSWAP_ROUTER,
        slippage: await hyperSwap.defaultSlippageBps()
      }
    },
    tokens: {
      WHYPE: tokens[0],
      USDT0: tokens[1],
      USDC: tokens[2],
      USDH: tokens[3],
      USR: tokens[4],
      sUSDe: tokens[5],
      USDe: tokens[6],
      UBTC: tokens[7],
      wstHYPE: tokens[8],
      UETH: tokens[9],
      beHYPE: tokens[10],
      USDHL: tokens[11],
      USOL: tokens[12]
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to file
  const filename = `${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n💾 Deployment info saved to: deployments/${filename}\n`);

  // ======================================
  // 9. Quick Start Guide
  // ======================================
  console.log("📚 Quick Start:\n");
  console.log("1. Bridge USDC from Ethereum:");
  console.log(`   aarnaBridge.deposit(amount, { value: bridgeFee })\n`);
  
  console.log("2. Swap tokens on HyperEVM:");
  console.log(`   hyperSwap.swap(tokenIn, tokenOut, amount, minOut, false, [])\n`);
  
  console.log("3. Bridge HyperCore ↔ HyperEVM:");
  console.log(`   bridge.transferToHyperCore(amount, "hypercore-address")\n`);
  
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
