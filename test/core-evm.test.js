const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HyperCoreEVMBridge - Forknet Integration Tests", function () {
  let bridge;
  let usdc;
  let owner;
  let vault;
  let user1;
  let user2;
  
  // ✅ REAL ADDRESSES
  const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  const USDT0 = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb";
  const HYPE_SYSTEM_ADDRESS = "0x2222222222222222222222222222222222222222";
  
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function approve(address, uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  before(async function () {
    this.timeout(300000);
    
    [owner, vault, user1, user2] = await ethers.getSigners();
    
    console.log("\n" + "=".repeat(70));
    console.log("🔥 HYPERCORE ↔ HYPEREVM BRIDGE FORKNET TESTS");
    console.log("=".repeat(70) + "\n");
    
    const network = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlockNumber();
    
    console.log("Network:", hre.network.name);
    console.log("Chain ID:", network.chainId);
    console.log("Block Number:", block);
    console.log();
    
    console.log("🔍 System Addresses...\n");
    console.log("✅ HYPE System Address:", HYPE_SYSTEM_ADDRESS);
    console.log("✅ Vault Address:", vault.address);
    console.log();
    
    console.log("🚀 Deploying HyperCoreEVMBridge...\n");
    
    const HyperCoreEVMBridge = await ethers.getContractFactory("HyperCoreEVMBridge");
    bridge = await HyperCoreEVMBridge.deploy(vault.address);
    await bridge.waitForDeployment();
    
    console.log("✅ Bridge deployed:", await bridge.getAddress());
    console.log("✅ Owner:", await bridge.owner());
    console.log("✅ Vault:", await bridge.vaultContract());
    console.log("✅ Paused:", await bridge.paused());
    console.log();
    
    usdc = new ethers.Contract(USDC, ERC20_ABI, ethers.provider);
    
    console.log("📦 Token Contracts:");
    console.log("USDC:  ", USDC);
    console.log("USDT0: ", USDT0);
    console.log();
    
    console.log("💰 Funding test accounts...\n");
    await fundAccounts();
    
    console.log("=".repeat(70) + "\n");
  });

  async function fundAccounts() {
    // Give everyone ETH
    await hre.network.provider.send("hardhat_setBalance", [
      vault.address,
      "0x56BC75E2D63100000" // 100 ETH
    ]);
    await hre.network.provider.send("hardhat_setBalance", [
      user1.address,
      "0x56BC75E2D63100000"
    ]);
    await hre.network.provider.send("hardhat_setBalance", [
      user2.address,
      "0x2B5E3AF16B1880000" // 50 ETH
    ]);
    
    console.log("✅ Accounts funded with HYPE");
    console.log("   Vault: 100 HYPE");
    console.log("   User1: 100 HYPE");
    console.log("   User2: 50 HYPE\n");
    
    // Try to fund with USDC from whale
    const whales = [
      "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b",
      "0xb50A96253aBDF803D85efcDce07Ad8becBc52BD5",
      "0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48",
    ];
    
    for (const whale of whales) {
      try {
        const balance = await usdc.balanceOf(whale);
        
        if (balance > ethers.parseUnits("100", 6)) {
          console.log("✅ Found USDC whale:", whale);
          
          await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [whale]
          });
          
          await hre.network.provider.send("hardhat_setBalance", [
            whale,
            "0x56BC75E2D63100000"
          ]);
          
          const whaleSigner = await ethers.getSigner(whale);
          
          await usdc.connect(whaleSigner).transfer(vault.address, ethers.parseUnits("1000", 6));
          await usdc.connect(whaleSigner).transfer(user1.address, ethers.parseUnits("500", 6));
          
          console.log("✅ Vault & User1 funded with USDC\n");
          break;
        }
      } catch {
        continue;
      }
    }
    
    console.log("📊 Final Balances:");
    console.log("Vault USDC:", ethers.formatUnits(await usdc.balanceOf(vault.address), 6));
    console.log("Vault HYPE:", ethers.formatEther(await ethers.provider.getBalance(vault.address)));
    console.log("User1 USDC:", ethers.formatUnits(await usdc.balanceOf(user1.address), 6));
    console.log();
  }

  describe("1. Deployment & Configuration", function () {
    
    it("✅ Should deploy with correct config", async function () {
      expect(await bridge.owner()).to.equal(owner.address);
      expect(await bridge.vaultContract()).to.equal(vault.address);
      expect(await bridge.HYPE_SYSTEM_ADDRESS()).to.equal(HYPE_SYSTEM_ADDRESS);
      expect(await bridge.paused()).to.equal(false);
      
      console.log("      ✅ All config verified");
    });
    
    it("✅ Should have correct system addresses", async function () {
      const systemAddr = await bridge.HYPE_SYSTEM_ADDRESS();
      
      expect(systemAddr).to.equal("0x2222222222222222222222222222222222222222");
      
      console.log("      ✅ HYPE system address:", systemAddr);
    });
  });

  describe("2. System Address Calculation", function () {
    
    it("✅ Should calculate system address for token index 0", async function () {
      const tokenIndex = 0;
      const systemAddr = await bridge.getSystemAddress(tokenIndex);
      
      console.log("\n      Token Index 0:");
      console.log("      System Address:", systemAddr);
      
      // Should start with 0x20
      expect(systemAddr.substring(0, 4)).to.equal("0x20");
    });
    
    it("✅ Should calculate system address for token index 200", async function () {
      const tokenIndex = 200;
      const systemAddr = await bridge.getSystemAddress(tokenIndex);
      
      console.log("\n      Token Index 200 (USDT0):");
      console.log("      System Address:", systemAddr);
      console.log("      Expected format: 0x20...00c8");
      
      expect(systemAddr.substring(0, 4)).to.equal("0x20");
      // Last byte should be 0xc8 (200 in hex)
      expect(systemAddr.substring(38, 42).toLowerCase()).to.equal("00c8");
    });
    
    it("✅ Should calculate system address for token index 201", async function () {
      const tokenIndex = 201;
      const systemAddr = await bridge.getSystemAddress(tokenIndex);
      
      console.log("\n      Token Index 201 (USDHL):");
      console.log("      System Address:", systemAddr);
      console.log("      Expected format: 0x20...00c9");
      
      expect(systemAddr.substring(0, 4)).to.equal("0x20");
      expect(systemAddr.substring(38, 42).toLowerCase()).to.equal("00c9");
    });
    
    it("✅ Should handle large token indices", async function () {
      const tokenIndex = 65535; // Max for uint16
      const systemAddr = await bridge.getSystemAddress(tokenIndex);
      
      console.log("\n      Token Index 65535:");
      console.log("      System Address:", systemAddr);
      
      expect(systemAddr.substring(0, 4)).to.equal("0x20");
    });
    
    it("❌ Should reject token index too large", async function () {
      const tokenIndex = BigInt(2) ** BigInt(64); // Larger than uint64
      
      await expect(
        bridge.getSystemAddress(tokenIndex)
      ).to.be.revertedWith("Token index too large");
      
      console.log("      ✅ Large index rejected");
    });
  });

  describe("3. EVM → Core Transfers", function () {
    
    it("✅ Should transfer ERC20 to Core", async function () {
      const vaultBalance = await usdc.balanceOf(vault.address);
      
      if (vaultBalance < ethers.parseUnits("100", 6)) {
        console.log("      ⚠️  Insufficient vault balance, skipping");
        this.skip();
      }
      
      const amount = ethers.parseUnits("100", 6);
      
      // Approve bridge
      await usdc.connect(vault).approve(await bridge.getAddress(), amount);
      
      // Transfer to Core
      const tx = await bridge.connect(vault).transferToCore(USDC, amount);
      const receipt = await tx.wait();
      
      // Get transfer ID from event
      const event = receipt.logs.find(log => {
        try {
          return bridge.interface.parseLog(log).name === "TransferToCore";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
      
      console.log("      ✅ Transfer to Core executed");
      console.log("      Amount:", ethers.formatUnits(amount, 6), "USDC");
    });
    
    it("✅ Should emit TransferToCore event", async function () {
      const vaultBalance = await usdc.balanceOf(vault.address);
      
      if (vaultBalance < ethers.parseUnits("50", 6)) {
        console.log("      ⚠️  Insufficient balance, skipping");
        this.skip();
      }
      
      const amount = ethers.parseUnits("50", 6);
      
      await usdc.connect(vault).approve(await bridge.getAddress(), amount);
      
      await expect(
        bridge.connect(vault).transferToCore(USDC, amount)
      ).to.emit(bridge, "TransferToCore");
      
      console.log("      ✅ Event emitted correctly");
    });
    
    it("❌ Should reject zero amount", async function () {
      await expect(
        bridge.connect(vault).transferToCore(USDC, 0)
      ).to.be.revertedWith("Amount must be > 0");
      
      console.log("      ✅ Zero amount rejected");
    });
    
    it("❌ Should reject invalid token", async function () {
      await expect(
        bridge.connect(vault).transferToCore(ethers.ZeroAddress, ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Invalid token");
      
      console.log("      ✅ Invalid token rejected");
    });
    
    it("❌ Should reject non-vault caller", async function () {
      await expect(
        bridge.connect(user1).transferToCore(USDC, ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Only vault");
      
      console.log("      ✅ Non-vault caller rejected");
    });
  });

  describe("4. Core → EVM Transfers", function () {
    
    it("✅ Should register transfer from Core", async function () {
      const tokenIndex = 200; // USDT0
      const amount = ethers.parseUnits("100", 6);
      const recipient = user1.address;
      
      const tx = await bridge.connect(vault).transferFromCore(
        tokenIndex,
        amount,
        recipient
      );
      
      await expect(tx)
        .to.emit(bridge, "TransferFromCore")
        .withArgs(
          ethers.keccak256(ethers.solidityPacked(
            ["uint256", "uint256", "uint256", "address"],
            [tokenIndex, amount, await ethers.provider.getBlock(tx.blockNumber).then(b => b.timestamp), recipient]
          )),
          tokenIndex,
          amount,
          recipient
        );
      
      console.log("      ✅ Transfer from Core registered");
    });
    
    it("❌ Should reject zero amount", async function () {
      await expect(
        bridge.connect(vault).transferFromCore(200, 0, user1.address)
      ).to.be.revertedWith("Amount must be > 0");
      
      console.log("      ✅ Zero amount rejected");
    });
    
    it("❌ Should reject invalid recipient", async function () {
      await expect(
        bridge.connect(vault).transferFromCore(200, ethers.parseUnits("100", 6), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
      
      console.log("      ✅ Invalid recipient rejected");
    });
  });

  describe("5. Native HYPE Transfers", function () {
    
    it("✅ Should transfer HYPE to Core", async function () {
      const amount = ethers.parseEther("1.0");
      
      const systemBalanceBefore = await ethers.provider.getBalance(HYPE_SYSTEM_ADDRESS);
      
      const tx = await bridge.connect(vault).transferHYPEToCore({ value: amount });
      const receipt = await tx.wait();
      
      const systemBalanceAfter = await ethers.provider.getBalance(HYPE_SYSTEM_ADDRESS);
      
      expect(systemBalanceAfter - systemBalanceBefore).to.equal(amount);
      
      console.log("      ✅ 1.0 HYPE transferred to system address");
      console.log("      System balance:", ethers.formatEther(systemBalanceAfter), "HYPE");
    });
    
    it("✅ Should emit HYPETransferred event", async function () {
      const amount = ethers.parseEther("0.5");
      
      await expect(
        bridge.connect(vault).transferHYPEToCore({ value: amount })
      ).to.emit(bridge, "HYPETransferred");
      
      console.log("      ✅ HYPE transfer event emitted");
    });
    
    it("❌ Should reject zero HYPE", async function () {
      await expect(
        bridge.connect(vault).transferHYPEToCore({ value: 0 })
      ).to.be.revertedWith("Must send HYPE");
      
      console.log("      ✅ Zero HYPE rejected");
    });
  });

  describe("6. Transfer Status Tracking", function () {
    
    it("✅ Should check transfer completion", async function () {
      const vaultBalance = await usdc.balanceOf(vault.address);
      
      if (vaultBalance < ethers.parseUnits("10", 6)) {
        console.log("      ⚠️  Insufficient balance, skipping");
        this.skip();
      }
      
      const amount = ethers.parseUnits("10", 6);
      
      await usdc.connect(vault).approve(await bridge.getAddress(), amount);
      
      const tx = await bridge.connect(vault).transferToCore(USDC, amount);
      const receipt = await tx.wait();
      
      // Get transfer ID from event
      const event = receipt.logs.find(log => {
        try {
          return bridge.interface.parseLog(log).name === "TransferToCore";
        } catch {
          return false;
        }
      });
      
      const transferId = bridge.interface.parseLog(event).args.transferId;
      
      // Initially not complete
      expect(await bridge.isTransferComplete(transferId)).to.equal(false);
      
      // Mark as complete
      await bridge.connect(vault).completeTransfer(transferId);
      
      // Now complete
      expect(await bridge.isTransferComplete(transferId)).to.equal(true);
      
      console.log("      ✅ Transfer status tracked correctly");
    });
    
    it("✅ Should emit TransferCompleted event", async function () {
      const vaultBalance = await usdc.balanceOf(vault.address);
      
      if (vaultBalance < ethers.parseUnits("10", 6)) {
        console.log("      ⚠️  Insufficient balance, skipping");
        this.skip();
      }
      
      const amount = ethers.parseUnits("10", 6);
      
      await usdc.connect(vault).approve(await bridge.getAddress(), amount);
      
      const tx = await bridge.connect(vault).transferToCore(USDC, amount);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return bridge.interface.parseLog(log).name === "TransferToCore";
        } catch {
          return false;
        }
      });
      
      const transferId = bridge.interface.parseLog(event).args.transferId;
      
      await expect(
        bridge.connect(vault).completeTransfer(transferId)
      ).to.emit(bridge, "TransferCompleted");
      
      console.log("      ✅ Completion event emitted");
    });
  });

  describe("7. Gas Estimation", function () {
    
    it("✅ Should estimate EVM → Core gas cost", async function () {
      const gasCost = await bridge.getTransferGasCost(false);
      
      console.log("\n      ⛽ EVM → Core Gas:");
      console.log("      Estimated:", gasCost.toString(), "gas");
      console.log("      Cost @ 1 gwei:", ethers.formatEther(gasCost * 1n), "HYPE\n");
      
      expect(gasCost).to.equal(50000);
    });
    
    it("✅ Should estimate Core → EVM gas cost", async function () {
      const gasCost = await bridge.getTransferGasCost(true);
      
      console.log("      ⛽ Core → EVM Gas:");
      console.log("      Estimated:", gasCost.toString(), "gas");
      console.log("      Cost @ 1 gwei:", ethers.formatEther(gasCost * 1n), "HYPE\n");
      
      expect(gasCost).to.equal(200000);
    });
  });

  describe("8. Admin Functions", function () {
    
    it("✅ Should update vault contract", async function () {
      const newVault = user2.address;
      
      await bridge.setVaultContract(newVault);
      expect(await bridge.vaultContract()).to.equal(newVault);
      
      // Reset
      await bridge.setVaultContract(vault.address);
      
      console.log("      ✅ Vault contract updated");
    });
    
    it("❌ Should reject invalid vault", async function () {
      await expect(
        bridge.setVaultContract(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid vault");
      
      console.log("      ✅ Invalid vault rejected");
    });
    
    it("✅ Should pause and unpause", async function () {
      await bridge.pause();
      expect(await bridge.paused()).to.equal(true);
      
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
      
      console.log("      ✅ Pause/unpause works");
    });
    
    it("❌ Should reject transfers when paused", async function () {
      await bridge.pause();
      
      await expect(
        bridge.connect(vault).transferHYPEToCore({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Contract paused");
      
      await bridge.unpause();
      
      console.log("      ✅ Paused state blocks transfers");
    });
    
    it("✅ Should transfer ownership", async function () {
      const newOwner = user1.address;
      
      await bridge.transferOwnership(newOwner);
      expect(await bridge.owner()).to.equal(newOwner);
      
      // Reset
      await bridge.connect(user1).transferOwnership(owner.address);
      
      console.log("      ✅ Ownership transferred");
    });
    
    it("❌ Should reject non-owner admin calls", async function () {
      await expect(
        bridge.connect(user1).pause()
      ).to.be.revertedWith("Only owner");
      
      console.log("      ✅ Non-owner rejected");
    });
  });

  describe("9. Edge Cases", function () {
    
    it("✅ Should handle receive() fallback", async function () {
      const amount = ethers.parseEther("0.1");
      
      await expect(
        user1.sendTransaction({
          to: await bridge.getAddress(),
          value: amount
        })
      ).to.emit(bridge, "Received")
        .withArgs(user1.address, amount);
      
      console.log("      ✅ Fallback receive works");
    });
    
    it("✅ Should handle multiple transfers", async function () {
      const amount1 = ethers.parseEther("0.5");
      const amount2 = ethers.parseEther("0.3");
      
      await bridge.connect(vault).transferHYPEToCore({ value: amount1 });
      await bridge.connect(vault).transferHYPEToCore({ value: amount2 });
      
      console.log("      ✅ Multiple transfers work");
    });
    
    it("✅ Should handle different token indices", async function () {
      const indices = [0, 100, 200, 201, 999];
      
      for (const idx of indices) {
        const addr = await bridge.getSystemAddress(idx);
        expect(addr.substring(0, 4)).to.equal("0x20");
      }
      
      console.log("      ✅ All token indices handled");
    });
  });

  describe("10. Real-World Scenarios", function () {
    
    it("✅ Should simulate full EVM → Core → EVM cycle", async function () {
      const vaultBalance = await usdc.balanceOf(vault.address);
      
      if (vaultBalance < ethers.parseUnits("100", 6)) {
        console.log("      ⚠️  Insufficient balance for full cycle");
        this.skip();
      }
      
      const amount = ethers.parseUnits("100", 6);
      
      // Step 1: Transfer EVM → Core
      console.log("\n      Step 1: EVM → Core");
      await usdc.connect(vault).approve(await bridge.getAddress(), amount);
      const tx1 = await bridge.connect(vault).transferToCore(USDC, amount);
      const receipt1 = await tx1.wait();
      
      const event1 = receipt1.logs.find(log => {
        try {
          return bridge.interface.parseLog(log).name === "TransferToCore";
        } catch {
          return false;
        }
      });
      
      const transferId = bridge.interface.parseLog(event1).args.transferId;
      console.log("      Transfer ID:", transferId);
      
      // Step 2: Mark as complete
      console.log("      Step 2: Complete transfer");
      await bridge.connect(vault).completeTransfer(transferId);
      
      // Step 3: Register return transfer from Core
      console.log("      Step 3: Core → EVM");
      await bridge.connect(vault).transferFromCore(200, amount, vault.address);
      
      console.log("      ✅ Full cycle completed\n");
    });
  });
});
