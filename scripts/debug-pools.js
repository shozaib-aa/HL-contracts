async function main() {
  const ROUTER = "0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A";
  const FACTORY = "0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48";
  
  const WHYPE = "0x5555555555555555555555555555555555555555";
  const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
  
  console.log("\n🔍 DEBUGGING HYPERSWAP POOLS\n");
  
  // Get factory
  const factory = await ethers.getContractAt(
    [
      "function getPair(address, address) view returns (address)",
      "function allPairs(uint256) view returns (address)",
      "function allPairsLength() view returns (uint256)"
    ],
    FACTORY
  );
  
  // Check specific pairs
  console.log("1️⃣  Checking WHYPE/USDC pair:");
  try {
    const pair1 = await factory.getPair(WHYPE, USDC);
    console.log("   Pair address:", pair1);
    
    if (pair1 !== ethers.ZeroAddress) {
      const pairContract = await ethers.getContractAt(
        ["function getReserves() view returns (uint112, uint112, uint32)"],
        pair1
      );
      const reserves = await pairContract.getReserves();
      console.log("   Reserve0:", reserves[0].toString());
      console.log("   Reserve1:", reserves[1].toString());
      console.log("   ✅ Pool has liquidity!\n");
    } else {
      console.log("   ❌ No pool exists\n");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message.substring(0, 60), "\n");
  }
  
  console.log("2️⃣  Checking WHYPE/USDT0 pair:");
  try {
    const pair2 = await factory.getPair(WHYPE, USDT0);
    console.log("   Pair address:", pair2);
    
    if (pair2 !== ethers.ZeroAddress) {
      const pairContract = await ethers.getContractAt(
        ["function getReserves() view returns (uint112, uint112, uint32)"],
        pair2
      );
      const reserves = await pairContract.getReserves();
      console.log("   Reserve0:", reserves[0].toString());
      console.log("   Reserve1:", reserves[1].toString());
      console.log("   ✅ Pool has liquidity!\n");
    } else {
      console.log("   ❌ No pool exists\n");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message.substring(0, 60), "\n");
  }
  
  console.log("3️⃣  Checking USDT0/USDC pair:");
  try {
    const pair3 = await factory.getPair(USDT0, USDC);
    console.log("   Pair address:", pair3);
    
    if (pair3 !== ethers.ZeroAddress) {
      const pairContract = await ethers.getContractAt(
        ["function getReserves() view returns (uint112, uint112, uint32)"],
        pair3
      );
      const reserves = await pairContract.getReserves();
      console.log("   Reserve0:", reserves[0].toString());
      console.log("   Reserve1:", reserves[1].toString());
      console.log("   ✅ Pool has liquidity!\n");
    } else {
      console.log("   ❌ No pool exists\n");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message.substring(0, 60), "\n");
  }
  
  // List all pairs
  console.log("4️⃣  Listing ALL pairs in factory:");
  try {
    const pairsLength = await factory.allPairsLength();
    console.log("   Total pairs:", pairsLength.toString(), "\n");
    
    for (let i = 0; i < Math.min(10, Number(pairsLength)); i++) {
      const pairAddr = await factory.allPairs(i);
      console.log(`   Pair ${i}:`, pairAddr);
    }
  } catch (e) {
    console.log("   ❌ Error listing pairs:", e.message.substring(0, 60));
  }
  
  // Try getting a quote
  console.log("\n5️⃣  Testing quote on router:");
  const router = await ethers.getContractAt(
    [
      "function getAmountsOut(uint, address[]) view returns (uint[])",
      "function WETH() view returns (address)"
    ],
    ROUTER
  );
  
  try {
    const weth = await router.WETH();
    console.log("   Router's WETH address:", weth);
    console.log("   Expected WHYPE:", WHYPE);
    console.log("   Match:", weth.toLowerCase() === WHYPE.toLowerCase(), "\n");
  } catch (e) {
    console.log("   ❌ Can't get WETH:", e.message.substring(0, 60));
  }
  
  try {
    const path = [WHYPE, USDC];
    const amount = ethers.parseEther("1");
    const amounts = await router.getAmountsOut(amount, path);
    
    console.log("   Quote for 1 WHYPE → USDC:");
    console.log("   Output:", ethers.formatUnits(amounts[1], 6), "USDC");
    console.log("   ✅ Quote works!\n");
  } catch (e) {
    console.log("   ❌ Quote failed:", e.message.substring(0, 80), "\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
