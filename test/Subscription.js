const { expect } = require("chai");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

const TierType = {
  VeryHappy: 1,
  Happy: 2,
  Moody: 3,
  Sad: 4,
  VerySad: 5
}

const TierPrice = {
  VeryHappy: ethers.utils.parseUnits("50000", "ether"),
  Happy: ethers.utils.parseUnits("10000", "ether"),
  Moody: ethers.utils.parseUnits("1000", "ether"),
  Sad: ethers.utils.parseUnits("500", "ether"),
  VerySad: ethers.utils.parseUnits("100", "ether"),
}

const TierIpfsCID = {
  VeryHappy: 'QmZY5rc2BBWUy5fvj1SopJZ5Dns2sDz14a5DqaJaE2ecVq',
  Happy: 'QmYUtLEMPsbRuUdrqCo2d6VqSuSCYRGApVssLrSbmFTEKD',
  Moody: 'QmR16twEdHLRGXVLqvRUq4h4PDbkiofaAXoCmaZTVkqprF',
  Sad: 'QmWGYsk3E5bpX7q5ZR6N8tny1xpCWu4aC9bdSvBfPG81Sr',
  VerySad: 'QmXn8MndJKifq1JNuUbkLvhTTga5DEjnysddCp2kGt1b6E',
}

describe("Subscription", function () {

  async function deployFixture() {
    const [owner, admin, user1, user2, user3, user4, user5, user6, user7] = await ethers.getSigners();

    const BUSD = await ethers.getContractFactory("BUSD");
    const busd = await BUSD.deploy();

    const Subscription = await ethers.getContractFactory("Subscription");
    const subscription = await Subscription.deploy(busd.address, admin.address);

    // send BUSD to users so they can buy NFT
    await busd.transfer(user1.address, ethers.utils.parseUnits("50000", "ether"))
    await busd.transfer(user2.address, ethers.utils.parseUnits("100", "ether"))

    return { subscription, busd, admin, user1, user2, user3, user4, user5, user6, user7 };
  }

  describe("buy", function () {
    it("should user1 can buy VeryHappy NFT", async function () {
      const { subscription, busd, user1 } = await loadFixture(deployFixture);

      const tier = TierType.VeryHappy;
      const price = TierPrice.VeryHappy;
      const ipfsCID = TierIpfsCID.VeryHappy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      expect(await subscription.tierOf(user1.address)).to.equal(tier)

      const tokenId = await subscription.userToken(user1.address)

      expect(await subscription.tokenURI(tokenId)).to.be.equal(`ipfs://${ipfsCID}`)
    })

    it('should not able to buy NFT when already has one', async function () {
      const { subscription, busd, user1 } = await loadFixture(deployFixture);

      let tier;
      let price;

      tier = TierType.Happy;
      price = TierPrice.Happy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      expect(await subscription.tierOf(user1.address)).to.equal(tier)

      tier = TierType.Moody;
      price = TierPrice.Moody;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(Moody)
      await expect(subscription.connect(user1).buy(tier))
        .to.be.revertedWithCustomError(subscription, 'AlreadyHasNFT')
    })

  })

  describe("transfer", function () {
    it('should be able to transfer NFT to another user', async function () {
      const { subscription, busd, user1, user2 } = await loadFixture(deployFixture);

      let tier;
      let price;

      tier = TierType.Happy;
      price = TierPrice.Happy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      const tokenId = await subscription.userToken(user1.address);
      await expect(subscription.connect(user1).transferFrom(user1.address, user2.address, tokenId))
        .to.emit(subscription, "TransferNFT")
        .withArgs(user1.address, user2.address, tokenId, tier)

    })

    it('should not able to transfer NFT when `to` address already has one', async function () {
      const { subscription, busd, user1, user2 } = await loadFixture(deployFixture);

      let tier;
      let price;

      tier = TierType.Happy;
      price = TierPrice.Happy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      tier = TierType.VerySad;
      price = TierPrice.VerySad;
      // approve BUSD
      await busd.connect(user2).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user2).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user2.address, 2, tier);



      const tokenId = await subscription.userToken(user1.address);
      // Transfer will revert
      await expect(subscription.connect(user1).transferFrom(user1.address, user2.address, tokenId))
        .to.revertedWithCustomError(subscription, 'AlreadyHasNFT')
    })
  })

  describe("withdraw", function () {

    it('should not able to widthdraw normal users', async function () {
      const { subscription, busd, admin, user1 } = await loadFixture(deployFixture);

      const tier = TierType.VeryHappy;
      const price = TierPrice.VeryHappy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      expect(await busd.balanceOf(subscription.address)).to.be.equal(price);

      await expect(subscription.connect(user1).withdraw())
        .to.be.revertedWith("Ownable: caller is not the owner")

    })

    it('should be withdrawable by admin', async function () {
      const { subscription, busd, admin, user1 } = await loadFixture(deployFixture);

      const tier = TierType.VeryHappy;
      const price = TierPrice.VeryHappy;
      // approve BUSD
      await busd.connect(user1).approve(subscription.address, price)
      // Buy NFT(VeryHappy)
      await expect(subscription.connect(user1).buy(tier))
        .to.emit(subscription, 'BuyNFT')
        .withArgs(user1.address, 1, tier);

      expect(await busd.balanceOf(subscription.address)).to.be.equal(price);

      await expect(subscription.connect(admin).withdraw())
        .to.be.emit(subscription, "Withdraw")
        .withArgs(subscription.address, admin.address, price)

      expect(await busd.balanceOf(subscription.address)).to.be.equal(0);
      expect(await busd.balanceOf(admin.address)).to.be.equal(price);
    })
  })
})