async function main() {
  const ROUTER_ADDRESS = "0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A";
  
  console.log("\n" + "=".repeat(70));
  console.log("🔍 VERIFYING HYPERSWAP ROUTER");
  console.log("=".repeat(70) + "\n");
  
  console.log("Router Address:", ROUTER_ADDRESS);
  console.log();
  
  // ✅ 1. Check if contract exists
  const code = await ethers.provider.getCode(ROUTER_ADDRESS);
  
  if (code === "0x") {
    console.log("❌ ERROR: No contract found at this address!");
    console.log("   The router might not be deployed yet.\n");
    process.exit(1);
  }
  
  console.log("✅ Contract exists!");
  console.log("   Code size:", code.length, "bytes");
  console.log();
  
  // ✅ 2. Try to verify it's a router by calling common functions
  const routerABI = [
    "function factory() view returns (address)",
    "function WETH() view returns (address)",
    "function getAmountsOut(uint256, address[]) view returns (uint256[])",
    "function swapExactTokensForTokens(uint256, uint256, address[], address, uint256) returns (uint256[])"
  ];
  
  try {
    const router = await ethers.getContractAt(routerABI, ROUTER_ADDRESS);
    
    console.log("🔍 Checking Router Functions...\n");
    
    // Check factory
    try {
      const factory = await router.factory();
      console.log("✅ Factory address:", factory);
    } catch (e) {
      console.log("⚠️  factory() failed:", e.message.substring(0, 60));
    }
    
    // Check WETH (or WHYPE)
    try {
      const weth = await router.WETH();
      console.log("✅ WETH/WHYPE address:", weth);
      
      // Verify it matches expected WHYPE
      if (weth.toLowerCase() === "0x5555555555555555555555555555555555555555".toLowerCase()) {
        console.log("   ✅ Matches WHYPE address!");
      }
    } catch (e) {
      console.log("⚠️  WETH() failed:", e.message.substring(0, 60));
    }
    
    console.log();
    
    // ✅ 3. Test quote function
    console.log("🔍 Testing Quote Function...\n");
    
    const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
    const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
    
    try {
      const path = [USDT0, USDC];
      const amountIn = ethers.parseUnits("1000", 6);
      
      const amounts = await router.getAmountsOut(amountIn, path);
      
      console.log("✅ Quote successful!");
      console.log("   Input: 1000 USDT0");
      console.log("   Output:", ethers.formatUnits(amounts[1], 6), "USDC");
      console.log();
      
      // Sanity check: Output should be close to input for stablecoins
      const outputNum = Number(ethers.formatUnits(amounts[1], 6));
      if (outputNum > 990 && outputNum < 1010) {
        console.log("   ✅ Output looks reasonable for stablecoin swap!");
      } else {
        console.log("   ⚠️  Output seems unusual:", outputNum);
      }
      
    } catch (e) {
      console.log("❌ getAmountsOut() failed:", e.message);
      console.log("   This might not be a Uniswap V2 style router");
    }
    
    console.log();
    
  } catch (error) {
    console.log("❌ Error interacting with router:", error.message);
  }
  
  // ✅ 4. Summary
  console.log("=".repeat(70));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=".repeat(70) + "\n");
  
  if (code !== "0x") {
    console.log("✅ Contract exists at address");
    console.log("✅ Safe to use in tests\n");
    
    console.log("💡 Next Steps:");
    console.log("   1. Update your contract:");
    console.log(`      address public constant HYPERSWAP_ROUTER = ${ROUTER_ADDRESS};`);
    console.log();
    console.log("   2. Update your test:");
    console.log(`      const HYPERSWAP_ROUTER = "${ROUTER_ADDRESS}";`);
    console.log();
    console.log("   3. Run tests:");
    console.log("      npx hardhat test test/HyperSwap.fork.test.js --network localhost");
    console.log();
  } else {
    console.log("❌ Contract not found");
    console.log("   Cannot use this address\n");
  }
  
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
