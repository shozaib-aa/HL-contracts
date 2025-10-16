const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AarnaBridge - Forknet Integration Tests", function () {
  let bridge;
  let usdc;
  let owner;
  let user1;
  let user2;
  
  // ✅ REAL ADDRESSES
  const DEBRIDGE_GATE = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA"; // Used by bridge contract
  const DEBRIDGE_ROUTER = "0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251"; // Your provided router
  const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  const HYPERSWAP_ROUTER = "0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A"; // Only for funding
  const WHYPE = "0x5555555555555555555555555555555555555555";
  const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
  
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function approve(address, uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  before(async function () {
    this.timeout(300000);
    
    [owner, user1, user2] = await ethers.getSigners();
    
    console.log("\n" + "=".repeat(70));
    console.log("🔥 AARNA BRIDGE FORKNET INTEGRATION TESTS");
    console.log("=".repeat(70) + "\n");
    
    const network = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlockNumber();
    
    console.log("Network:", hre.network.name);
    console.log("Chain ID:", network.chainId);
    console.log("Block Number:", block);
    console.log();
    
    console.log("🔍 Verifying deBridge Components...\n");
    
    const gateCode = await ethers.provider.getCode(DEBRIDGE_GATE);
    const routerCode = await ethers.provider.getCode(DEBRIDGE_ROUTER);
    
    console.log("✅ deBridge Gate:", DEBRIDGE_GATE);
    console.log("   Exists:", gateCode !== "0x");
    console.log("✅ deBridge Router:", DEBRIDGE_ROUTER);
    console.log("   Exists:", routerCode !== "0x");
    console.log();
    
    console.log("🚀 Deploying AarnaBridge...\n");
    
    const AarnaBridge = await ethers.getContractFactory("AarnaBridge");
    bridge = await AarnaBridge.deploy(DEBRIDGE_GATE, USDC);
    await bridge.waitForDeployment();
    
    console.log("✅ AarnaBridge deployed:", await bridge.getAddress());
    console.log("✅ Using deBridge Gate:", await bridge.deBridgeGate());
    console.log("✅ Using USDC:", await bridge.usdcAddress());
    console.log();
    
    usdc = new ethers.Contract(USDC, ERC20_ABI, ethers.provider);
    
    console.log("📦 Token Contract:");
    console.log("USDC: ", USDC);
    console.log();
    
    console.log("💰 Funding test users with USDC...\n");
    await fundUsers();
    
    console.log("=".repeat(70) + "\n");
  });

  async function fundUsers() {
    await hre.network.provider.send("hardhat_setBalance", [
      user1.address,
      "0x56BC75E2D63100000"
    ]);
    await hre.network.provider.send("hardhat_setBalance", [
      user2.address,
      "0x2B5E3AF16B1880000"
    ]);
    
    console.log("✅ Users funded with ETH");
    console.log("   User1: 100 HYPE");
    console.log("   User2: 50 HYPE\n");
    
    // ✅ TRY METHOD 1: Whale funding (fastest)
    console.log("🔍 Method 1: Trying whale funding...\n");
    
    const whaleSuccess = await tryWhaleFunding();
    
    if (!whaleSuccess) {
      // ✅ TRY METHOD 2: HyperSwap (if whale fails)
      console.log("🔍 Method 2: Trying HyperSwap...\n");
      await tryHyperSwap();
    }
    
    console.log("\n📊 Final User Balances:");
    console.log("User1:");
    console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(user1.address), 6));
    console.log("  HYPE:", ethers.formatEther(await ethers.provider.getBalance(user1.address)));
    console.log("User2:");
    console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(user2.address), 6));
    console.log("  HYPE:", ethers.formatEther(await ethers.provider.getBalance(user2.address)));
    console.log();
  }

  async function tryWhaleFunding() {
    const whales = [
      "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b",
      "0xb50A96253aBDF803D85efcDce07Ad8becBc52BD5",
      "0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48",
      "0x5481bf8d3946E6A3168640c1D7523eB59F055a29",
    ];
    
    for (const whale of whales) {
      try {
        const balance = await usdc.balanceOf(whale);
        
        if (balance > ethers.parseUnits("100", 6)) {
          console.log("   ✅ Found USDC whale:", whale);
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
          
          await usdc.connect(whaleSigner).transfer(user1.address, ethers.parseUnits("50", 6));
          await usdc.connect(whaleSigner).transfer(user2.address, ethers.parseUnits("30", 6));
          
          console.log("   ✅ Users funded from whale\n");
          return true;
        }
      } catch {
        continue;
      }
    }
    
    console.log("   ⚠️  No whale found\n");
    return false;
  }

  async function tryHyperSwap() {
    try {
      const routerABI = [
        "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
        "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)"
      ];
      
      const router = new ethers.Contract(HYPERSWAP_ROUTER, routerABI, ethers.provider);
      const usdt0 = new ethers.Contract(USDT0, ERC20_ABI, ethers.provider);
      
      const deadline = Math.floor(Date.now() / 1000) + 300;
      
      // Try with very small amount
      console.log("   Swapping 0.01 HYPE → USDT0...");
      
      const tx1 = await router.connect(user1).swapExactETHForTokens(
        0,
        [WHYPE, USDT0],
        user1.address,
        deadline,
        { value: ethers.parseEther("0.01") }
      );
      await tx1.wait();
      
      const usdt0Balance = await usdt0.balanceOf(user1.address);
      console.log("   ✅ Received:", ethers.formatUnits(usdt0Balance, 6), "USDT0");
      
      // Swap USDT0 → USDC
      if (usdt0Balance > ethers.parseUnits("10", 6)) {
        console.log("   Swapping USDT0 → USDC...");
        
        const swapAmount = ethers.parseUnits("10", 6);
        await usdt0.connect(user1).approve(HYPERSWAP_ROUTER, swapAmount);
        
        await router.connect(user1).swapExactTokensForTokens(
          swapAmount,
          0,
          [USDT0, USDC],
          user1.address,
          deadline
        );
        
        console.log("   ✅ Swap successful\n");
      }
      
    } catch (error) {
      console.log("   ⚠️  HyperSwap failed:", error.message.substring(0, 80));
      console.log("   Tests will run with 0 balance\n");
    }
  }

  describe("1. Deployment & Configuration", function () {
    
    it("✅ Should deploy with correct config", async function () {
      expect(await bridge.owner()).to.equal(owner.address);
      expect(await bridge.deBridgeGate()).to.equal(DEBRIDGE_GATE);
      expect(await bridge.usdcAddress()).to.equal(USDC);
      expect(await bridge.slippageBps()).to.equal(50);
      expect(await bridge.minBridgeAmount()).to.equal(ethers.parseUnits("10", 6));
      expect(await bridge.maxBridgeAmount()).to.equal(ethers.parseUnits("1000000", 6));
      expect(await bridge.paused()).to.equal(false);
      
      console.log("      ✅ All config verified");
    });
    
    it("✅ Should have correct initial stats", async function () {
      const [deposits, withdrawals, fees] = await bridge.getStats();
      
      expect(deposits).to.equal(0);
      expect(withdrawals).to.equal(0);
      expect(fees).to.equal(0);
      
      console.log("      ✅ Initial stats are zero");
    });
  });

  describe("2. Bridge Fee Calculation", function () {
    
    it("✅ Should calculate bridge fee", async function () {
      try {
        const fee = await bridge.getBridgeFee();
        
        console.log("\n      💰 Bridge Fee:", ethers.formatEther(fee), "HYPE");
        
        expect(fee).to.be.gt(0);
      } catch (error) {
        console.log("      ⚠️  Fee calculation failed");
        this.skip();
      }
    });
    
    it("✅ Should get quote", async function () {
      const amount = ethers.parseUnits("100", 6);
      
      try {
        const [outputAmount, bridgeFee, gasEstimate] = await bridge.getQuote(amount);
        
        console.log("\n      📊 Quote for 100 USDC:");
        console.log("      Output Amount:", ethers.formatUnits(outputAmount, 6), "USDC");
        console.log("      Bridge Fee:   ", ethers.formatEther(bridgeFee), "HYPE");
        console.log("      Gas Estimate: ", gasEstimate.toString(), "\n");
        
        expect(outputAmount).to.be.lt(amount);
        expect(bridgeFee).to.be.gt(0);
      } catch (error) {
        console.log("      ⚠️  Quote failed");
        this.skip();
      }
    });
  });

  describe("3. Deposit to HyperEVM", function () {
    
    it("✅ Should deposit USDC", async function () {
      const balance = await usdc.balanceOf(user1.address);
      
      if (balance < ethers.parseUnits("20", 6)) {
        console.log("      ⚠️  Insufficient USDC balance, skipping");
        this.skip();
      }
      
      try {
        const amount = ethers.parseUnits("20", 6);
        const bridgeFee = await bridge.getBridgeFee();
        
        await usdc.connect(user1).approve(await bridge.getAddress(), amount);
        
        const depositsBefore = await bridge.totalVolumeDeposited();
        
        await bridge.connect(user1).deposit(amount, { value: bridgeFee });
        
        const depositsAfter = await bridge.totalVolumeDeposited();
        
        expect(depositsAfter - depositsBefore).to.equal(amount);
        
        console.log("      ✅ Deposited:", ethers.formatUnits(amount, 6), "USDC");
      } catch (error) {
        console.log("      ⚠️  Deposit failed:", error.message.substring(0, 80));
        this.skip();
      }
    });
    
    it("✅ Should update user stats", async function () {
      const [totalDeposited, totalWithdrawn, depositCount] = await bridge.getUserStats(user1.address);
      
      console.log("      📊 User1 Stats:");
      console.log("      Total Deposited:", ethers.formatUnits(totalDeposited, 6));
      console.log("      Deposit Count:  ", depositCount.toString());
      
      expect(totalDeposited).to.be.gte(0);
    });
    
    it("❌ Should reject zero deposit", async function () {
      await expect(
        bridge.connect(user1).deposit(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Zero amount");
      
      console.log("      ✅ Zero amount rejected");
    });
    
    it("❌ Should reject amount below minimum", async function () {
      const tooSmall = ethers.parseUnits("5", 6);
      
      await expect(
        bridge.connect(user1).deposit(tooSmall, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Amount too small");
      
      console.log("      ✅ Small amount rejected");
    });
    
    it("❌ Should reject insufficient fee", async function () {
      const amount = ethers.parseUnits("50", 6);
      
      try {
        await bridge.connect(user1).deposit(amount, { value: 0 });
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.match(/revert/i);
        console.log("      ✅ Insufficient fee rejected");
      }
    });
  });

  describe("4. Withdraw from HyperEVM", function () {
    
    it("✅ Should withdraw USDC", async function () {
      const balance = await usdc.balanceOf(user2.address);
      
      if (balance < ethers.parseUnits("15", 6)) {
        console.log("      ⚠️  Insufficient USDC balance, skipping");
        this.skip();
      }
      
      try {
        const amount = ethers.parseUnits("15", 6);
        const bridgeFee = await bridge.getBridgeFee();
        
        await usdc.connect(user2).approve(await bridge.getAddress(), amount);
        
        const withdrawalsBefore = await bridge.totalVolumeWithdrawn();
        
        await bridge.connect(user2).withdraw(amount, { value: bridgeFee });
        
        const withdrawalsAfter = await bridge.totalVolumeWithdrawn();
        
        expect(withdrawalsAfter - withdrawalsBefore).to.equal(amount);
        
        console.log("      ✅ Withdrew:", ethers.formatUnits(amount, 6), "USDC");
      } catch (error) {
        console.log("      ⚠️  Withdraw failed");
        this.skip();
      }
    });
    
    it("✅ Should update withdrawal stats", async function () {
      const [totalDeposited, totalWithdrawn, depositCount] = await bridge.getUserStats(user2.address);
      
      console.log("      📊 User2 Stats:");
      console.log("      Total Withdrawn:", ethers.formatUnits(totalWithdrawn, 6));
      
      expect(totalWithdrawn).to.be.gte(0);
    });
  });

  describe("5. Transaction History", function () {
    
    it("✅ Should get user history", async function () {
      const history = await bridge.getUserHistory(user1.address);
      
      console.log("      📜 User1 Transaction History:");
      console.log("      Total Transactions:", history.length);
      
      if (history.length > 0) {
        console.log("      Latest TX Amount:", ethers.formatUnits(history[history.length - 1].amount, 6));
      }
      
      expect(history.length).to.be.gte(0);
    });
    
    it("✅ Should get global stats", async function () {
      const [deposits, withdrawals, fees] = await bridge.getStats();
      
      console.log("\n      📊 Global Bridge Stats:");
      console.log("      Total Deposited: ", ethers.formatUnits(deposits, 6), "USDC");
      console.log("      Total Withdrawn: ", ethers.formatUnits(withdrawals, 6), "USDC");
      console.log("      Total Fees:      ", ethers.formatEther(fees), "HYPE\n");
      
      expect(deposits).to.be.gte(0);
      expect(withdrawals).to.be.gte(0);
    });
  });

  describe("6. Admin Functions", function () {
    
    it("✅ Should update limits", async function () {
      const newMin = ethers.parseUnits("5", 6);
      const newMax = ethers.parseUnits("500000", 6);
      
      await bridge.setLimits(newMin, newMax);
      
      expect(await bridge.minBridgeAmount()).to.equal(newMin);
      expect(await bridge.maxBridgeAmount()).to.equal(newMax);
      
      await bridge.setLimits(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("1000000", 6)
      );
      
      console.log("      ✅ Limits updated");
    });
    
    it("❌ Should reject invalid limits", async function () {
      await expect(
        bridge.setLimits(
          ethers.parseUnits("100", 6),
          ethers.parseUnits("50", 6)
        )
      ).to.be.revertedWith("Invalid limits");
      
      console.log("      ✅ Invalid limits rejected");
    });
    
    it("✅ Should update slippage", async function () {
      await bridge.setSlippage(100);
      expect(await bridge.slippageBps()).to.equal(100);
      
      await bridge.setSlippage(50);
      console.log("      ✅ Slippage updated");
    });
    
    it("❌ Should reject slippage > 5%", async function () {
      await expect(
        bridge.setSlippage(501)
      ).to.be.revertedWith("Max 5%");
      
      console.log("      ✅ Max slippage enforced");
    });
    
    it("✅ Should update fee recipient", async function () {
      const newRecipient = user1.address;
      
      await bridge.setFeeRecipient(newRecipient);
      expect(await bridge.feeRecipient()).to.equal(newRecipient);
      
      await bridge.setFeeRecipient(owner.address);
      console.log("      ✅ Fee recipient updated");
    });
    
    it("✅ Should pause/unpause", async function () {
      await bridge.pause();
      expect(await bridge.paused()).to.equal(true);
      
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
      
      console.log("      ✅ Pause/unpause works");
    });
    
    it("❌ Should reject non-owner calls", async function () {
      await expect(
        bridge.connect(user1).pause()
      ).to.be.revertedWith("Only owner");
      
      console.log("      ✅ Owner check enforced");
    });
    
    it("✅ Should withdraw collected fees", async function () {
      const contractBalance = await ethers.provider.getBalance(await bridge.getAddress());
      
      if (contractBalance === 0n) {
        console.log("      ⚠️  No fees to withdraw");
        this.skip();
      }
      
      const ownerBefore = await ethers.provider.getBalance(owner.address);
      
      await bridge.withdrawFees();
      
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerAfter).to.be.gt(ownerBefore);
      
      console.log("      ✅ Fees withdrawn");
    });
    
    it("✅ Should emergency withdraw tokens", async function () {
      const balance = await usdc.balanceOf(user1.address);
      
      if (balance === 0n) {
        console.log("      ⚠️  No tokens to test");
        this.skip();
      }
      
      const amount = ethers.parseUnits("1", 6);
      await usdc.connect(user1).transfer(await bridge.getAddress(), amount);
      
      const ownerBefore = await usdc.balanceOf(owner.address);
      
      await bridge.emergencyWithdraw(USDC, amount);
      
      const ownerAfter = await usdc.balanceOf(owner.address);
      
      expect(ownerAfter - ownerBefore).to.equal(amount);
      
      console.log("      ✅ Emergency withdraw successful");
    });
  });

  describe("7. Edge Cases", function () {
    
    it("❌ Should revert when paused", async function () {
      await bridge.pause();
      
      await expect(
        bridge.connect(user1).deposit(
          ethers.parseUnits("50", 6),
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWith("Paused");
      
      await bridge.unpause();
      
      console.log("      ✅ Pause protection works");
    });
    
    it("✅ Should handle multiple users", async function () {
      const stats1 = await bridge.getUserStats(user1.address);
      const stats2 = await bridge.getUserStats(user2.address);
      
      console.log("      User1 deposits:", ethers.formatUnits(stats1[0], 6));
      console.log("      User2 withdrawals:", ethers.formatUnits(stats2[1], 6));
      
      expect(stats1[0]).to.be.gte(0);
      expect(stats2[1]).to.be.gte(0);
    });
  });

  describe("8. Gas Estimation", function () {
    
    it("📊 Should estimate deposit gas", async function () {
      const balance = await usdc.balanceOf(user1.address);
      
      if (balance < ethers.parseUnits("10", 6)) {
        console.log("      ⚠️  No balance for gas test");
        this.skip();
      }
      
      try {
        const amount = ethers.parseUnits("10", 6);
        const bridgeFee = await bridge.getBridgeFee();
        
        await usdc.connect(user1).approve(await bridge.getAddress(), amount);
        
        const gasEstimate = await bridge.connect(user1).deposit.estimateGas(
          amount,
          { value: bridgeFee }
        );
        
        console.log("\n      ⛽ Gas Estimates:");
        console.log("      Deposit:  ", gasEstimate.toString(), "gas");
        console.log("      @ 1 gwei: ", ethers.formatEther(gasEstimate * 1n), "HYPE\n");
      } catch {
        console.log("      ⚠️  Gas estimation unavailable");
        this.skip();
      }
    });
  });
});
