async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TESTING HYPERLIQUID SYSTEM ADDRESS BRIDGE");
  console.log("=".repeat(70) + "\n");
  
  const SYSTEM_ADDRESS = "0x2222222222222222222222222222222222222222";
  const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
  
  const [user] = await ethers.getSigners();
  
  console.log("👤 User Address:", user.address);
  console.log("🎯 System Address:", SYSTEM_ADDRESS);
  console.log();
  
  // Give user ETH
  await hre.network.provider.send("hardhat_setBalance", [
    user.address,
    "0x56BC75E2D63100000" // 100 ETH
  ]);
  
  console.log("✅ User funded with 100 HYPE\n");
  
  // ============================================
  // STEP 1: Get USDC from a whale
  // ============================================
  
  console.log("📍 STEP 1: Getting USDC...\n");
  
  const usdc = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ],
    USDC
  );
  
  const whales = [
    "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b",
    "0xb50A96253aBDF803D85efcDce07Ad8becBc52BD5",
    "0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48",
  ];
  
  let funded = false;
  
  for (const whale of whales) {
    try {
      const balance = await usdc.balanceOf(whale);
      
      if (balance > ethers.parseUnits("100", 6)) {
        console.log("   ✅ Found whale:", whale);
        console.log("   Balance:", ethers.formatUnits(balance, 6), "USDC");
        
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [whale]
        });
        
        await hre.network.provider.send("hardhat_setBalance", [
          whale,
          "0x56BC75E2D63100000"
        ]);
        
        const whaleSigner = await ethers.getSigner(whale);
        
        await usdc.connect(whaleSigner).transfer(user.address, ethers.parseUnits("100", 6));
        
        console.log("   ✅ Transferred 100 USDC to user\n");
        funded = true;
        break;
      }
    } catch {
      continue;
    }
  }
  
  if (!funded) {
    console.log("   ❌ No whale found - test cannot continue\n");
    return;
  }
  
  // ============================================
  // STEP 2: Check balances BEFORE
  // ============================================
  
  console.log("📍 STEP 2: Initial Balances\n");
  
  const userUSDCBefore = await usdc.balanceOf(user.address);
  const userHYPEBefore = await ethers.provider.getBalance(user.address);
  const systemUSDCBefore = await usdc.balanceOf(SYSTEM_ADDRESS);
  const systemHYPEBefore = await ethers.provider.getBalance(SYSTEM_ADDRESS);
  
  console.log("   User USDC:   ", ethers.formatUnits(userUSDCBefore, 6));
  console.log("   User HYPE:   ", ethers.formatEther(userHYPEBefore));
  console.log("   System USDC: ", ethers.formatUnits(systemUSDCBefore, 6));
  console.log("   System HYPE: ", ethers.formatEther(systemHYPEBefore));
  console.log();
  
  // ============================================
  // STEP 3: Send USDC to System Address
  // ============================================
  
  console.log("📍 STEP 3: Sending USDC to System Address...\n");
  
  const sendAmount = ethers.parseUnits("50", 6);
  
  console.log("   Sending:", ethers.formatUnits(sendAmount, 6), "USDC");
  console.log("   To:     ", SYSTEM_ADDRESS);
  console.log();
  
  try {
    const tx = await usdc.transfer(SYSTEM_ADDRESS, sendAmount);
    console.log("   📤 Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed");
    console.log("   Gas used:", receipt.gasUsed.toString());
    console.log();
  } catch (error) {
    console.log("   ❌ Transfer failed!");
    console.log("   Error:", error.message);
    console.log();
    return;
  }
  
  // ============================================
  // STEP 4: Check balances AFTER
  // ============================================
  
  console.log("📍 STEP 4: Balances After Transfer\n");
  
  const userUSDCAfter = await usdc.balanceOf(user.address);
  const userHYPEAfter = await ethers.provider.getBalance(user.address);
  const systemUSDCAfter = await usdc.balanceOf(SYSTEM_ADDRESS);
  const systemHYPEAfter = await ethers.provider.getBalance(SYSTEM_ADDRESS);
  
  console.log("   User USDC:   ", ethers.formatUnits(userUSDCAfter, 6));
  console.log("   User HYPE:   ", ethers.formatEther(userHYPEAfter));
  console.log("   System USDC: ", ethers.formatUnits(systemUSDCAfter, 6));
  console.log("   System HYPE: ", ethers.formatEther(systemHYPEAfter));
  console.log();
  
  // ============================================
  // STEP 5: Calculate Changes
  // ============================================
  
  console.log("📍 STEP 5: Balance Changes\n");
  
  const userUSDCChange = userUSDCAfter - userUSDCBefore;
  const userHYPEChange = userHYPEAfter - userHYPEBefore;
  const systemUSDCChange = systemUSDCAfter - systemUSDCBefore;
  const systemHYPEChange = systemHYPEAfter - systemHYPEBefore;
  
  console.log("   User USDC:   ", ethers.formatUnits(userUSDCChange, 6));
  console.log("   User HYPE:   ", ethers.formatEther(userHYPEChange));
  console.log("   System USDC: ", ethers.formatUnits(systemUSDCChange, 6));
  console.log("   System HYPE: ", ethers.formatEther(systemHYPEChange));
  console.log();
  
  // ============================================
  // STEP 6: Test Native HYPE Transfer
  // ============================================
  
  console.log("📍 STEP 6: Testing Native HYPE Transfer...\n");
  
  const hypeAmount = ethers.parseEther("1.0");
  
  console.log("   Sending:", ethers.formatEther(hypeAmount), "HYPE");
  console.log("   To:     ", SYSTEM_ADDRESS);
  console.log();
  
  const systemHYPEBefore2 = await ethers.provider.getBalance(SYSTEM_ADDRESS);
  
  try {
    const tx = await user.sendTransaction({
      to: SYSTEM_ADDRESS,
      value: hypeAmount
    });
    
    console.log("   📤 Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed");
    console.log("   Gas used:", receipt.gasUsed.toString());
    console.log();
  } catch (error) {
    console.log("   ❌ Transfer failed!");
    console.log("   Error:", error.message);
    console.log();
  }
  
  const systemHYPEAfter2 = await ethers.provider.getBalance(SYSTEM_ADDRESS);
  const systemHYPEChange2 = systemHYPEAfter2 - systemHYPEBefore2;
  
  console.log("   System HYPE change:", ethers.formatEther(systemHYPEChange2), "HYPE");
  console.log();
  
  // ============================================
  // RESULTS
  // ============================================
  
  console.log("=".repeat(70));
  console.log("📊 RESULTS");
  console.log("=".repeat(70) + "\n");
  
  if (systemUSDCChange > 0n) {
    console.log("✅ System address received USDC!");
    console.log("   Amount:", ethers.formatUnits(systemUSDCChange, 6), "USDC");
  } else {
    console.log("❌ System address did NOT receive USDC");
  }
  console.log();
  
  if (userHYPEChange > 0n) {
    console.log("🎉 USER RECEIVED HYPE BACK!");
    console.log("   Amount:", ethers.formatEther(userHYPEChange), "HYPE");
    console.log("   This means the bridge is WORKING!");
  } else if (userHYPEChange < 0n) {
    console.log("⚠️  User lost HYPE (gas costs)");
    console.log("   Net change:", ethers.formatEther(userHYPEChange), "HYPE");
    console.log("   No bridge reward received");
  } else {
    console.log("⚠️  No HYPE change detected");
    console.log("   Bridge might not work on forknet");
  }
  console.log();
  
  if (systemHYPEChange2 > 0n) {
    console.log("✅ System address received native HYPE!");
    console.log("   Amount:", ethers.formatEther(systemHYPEChange2), "HYPE");
  } else {
    console.log("❌ System address did NOT receive native HYPE");
  }
  console.log();
  
  console.log("=".repeat(70));
  console.log("💡 INTERPRETATION");
  console.log("=".repeat(70) + "\n");
  
  if (userHYPEChange > 0n) {
    console.log("✅ The system address bridge is FUNCTIONAL on forknet!");
    console.log("   You can use this for testing EVM ↔ Core transfers");
    console.log("   Sending tokens to 0x222...222 triggers bridge rewards");
  } else {
    console.log("⚠️  The system address bridge does NOT work on forknet");
    console.log("   Possible reasons:");
    console.log("   1. Bridge requires real HyperCore connection");
    console.log("   2. Forknet doesn't simulate bridge logic");
    console.log("   3. Bridge rewards happen async (not in same block)");
    console.log();
    console.log("   However, you can still:");
    console.log("   - Test sending tokens to system address");
    console.log("   - Verify contract logic");
    console.log("   - Test event emissions");
  }
  
  console.log("\n" + "=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
