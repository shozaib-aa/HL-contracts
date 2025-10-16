const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\n" + "=".repeat(70));
  console.log("🚀 DEPLOYING HYPERLEND AUTO VAULT");
  console.log("=".repeat(70) + "\n");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HYPE\n");

  // Contract addresses (Hyperlend Mainnet)
  const HYPERLEND_POOL = "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b";
  const PROTOCOL_DATA_PROVIDER = "0x5481bf8d3946E6A3168640c1D7523eB59F055a29";
  const HYPERLEND_ORACLE = "0xC9Fb4fbE842d57EAc1dF3e641a281827493A630e";
  
  // Asset addresses
  const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
  const WHYPE = "0x5555555555555555555555555555555555555555";
  const wstHYPE = "0x94e8396e0869c9F2200760aF0621aFd240E1CF38";
  
  // ======================================
  // Deploy HyperlendAutoVault
  // ======================================
  console.log("📦 Deploying HyperlendAutoVault...\n");
  
  const HyperlendAutoVault = await ethers.getContractFactory("HyperlendAutoVault");
  const vault = await HyperlendAutoVault.deploy();
  await vault.waitForDeployment();
  
  const vaultAddress = await vault.getAddress();
  console.log("✅ HyperlendAutoVault deployed to:", vaultAddress);
  console.log("   Owner:", await vault.owner());
  console.log("   Hyperlend Pool:", await vault.HYPERLEND_POOL());
  console.log("   Protocol Data Provider:", await vault.PROTOCOL_DATA_PROVIDER());
  console.log("   Hyperlend Oracle:", await vault.HYPERLEND_ORACLE());

  // ======================================
  // Test Market Fetching
  // ======================================
  console.log("\n📊 Fetching Market Data...\n");
  
  try {
    // Get all markets
    const [assets, apys, ltvs] = await vault.displayMarkets();
    
    console.log("Available Markets:");
    console.log("─".repeat(70));
    
    const assetNames = ["USDT0", "WHYPE", "wstHYPE", "USDe", "sUSDe", "USDHL", "kHYPE", "UBTC", "UETH"];
    
    for (let i = 0; i < assets.length; i++) {
      if (assets[i] === ethers.ZeroAddress) continue;
      
      const name = assetNames[i] || "Unknown";
      const apy = apys[i].toString();
      const ltv = ltvs[i].toString();
      
      console.log(`${(i + 1).toString().padStart(2)}. ${name.padEnd(10)} | APY: ${apy.padStart(5)}% | LTV: ${ltv}%`);
    }
    
    console.log("─".repeat(70));
    
    // Find best market
    const [bestAsset, highestAPY] = await vault.findBestMarket();
    console.log(`\n🏆 Best Market: ${bestAsset} with ${highestAPY}% APY`);
    
  } catch (error) {
    console.log("⚠️  Market data not available (may need mainnet fork)");
    console.log("   Error:", error.message.substring(0, 100));
  }

  // ======================================
  // Verify Contract Info
  // ======================================
  console.log("\n📋 Vault Configuration:");
  console.log("─".repeat(70));
  
  const supportedAssets = await vault.getSupportedAssets();
  console.log(`Supported Assets: ${supportedAssets.length}`);
  
  supportedAssets.slice(0, 5).forEach((asset, i) => {
    if (asset !== ethers.ZeroAddress) {
      console.log(`  ${i + 1}. ${asset}`);
    }
  });

  // ======================================
  // Summary
  // ======================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\nContract:");
  console.log("  HyperlendAutoVault:    ", vaultAddress);
  console.log("\nIntegrations:");
  console.log("  Hyperlend Pool:        ", HYPERLEND_POOL);
  console.log("  Data Provider:         ", PROTOCOL_DATA_PROVIDER);
  console.log("  Oracle:                ", HYPERLEND_ORACLE);
  console.log("\nSupported Assets:");
  console.log("  USDT0:                 ", USDT0);
  console.log("  WHYPE:                 ", WHYPE);
  console.log("  wstHYPE:               ", wstHYPE);
  console.log("=".repeat(70));
  
  console.log("\n✅ Deployment successful!\n");
  
  // ======================================
  // Verification Command
  // ======================================
  console.log("🔍 To verify contract:");
  console.log(`npx hardhat verify --network hyperevm ${vaultAddress}\n`);
  
  // ======================================
  // Save Deployment
  // ======================================
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      HyperlendAutoVault: {
        address: vaultAddress,
        hyperlendPool: HYPERLEND_POOL,
        dataProvider: PROTOCOL_DATA_PROVIDER,
        oracle: HYPERLEND_ORACLE
      }
    },
    supportedAssets: {
      USDT0: USDT0,
      WHYPE: WHYPE,
      wstHYPE: wstHYPE
    }
  };

  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `hyperlend-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`💾 Deployment info saved to: deployments/${filename}\n`);
  
  // ======================================
  // Quick Start Guide
  // ======================================
  console.log("📚 Quick Start:\n");
  console.log("1. Deposit to auto-select best APY:");
  console.log(`   vault.deposit(USDT0, amount)\n`);
  
  console.log("2. Check your position:");
  console.log(`   vault.getUserPosition(userAddress)\n`);
  
  console.log("3. Withdraw anytime:");
  console.log(`   vault.withdraw(amount)\n`);
  
  console.log("4. Borrow against collateral:");
  console.log(`   vault.borrow(USDT0, amount)\n`);
  
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
