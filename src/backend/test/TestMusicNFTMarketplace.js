const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Col } = require("react-bootstrap");

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

//Test
describe("MusicNFTMarketplace", function () {

    const nftName = "JOMO MUSIC NFT"
    const nftSymbol = "JOMOMS"
    const fee_val=0.01

    let nftMarketplace
    let deployer, artist, user1, user2, users;
    let royaltyFee = toWei(fee_val); // 1 ether = 10^18 wei
    let URI = "https://bafybeidhjjbjonyqcahuzlpt7sznmh4xrlbspa3gstop5o47l6gsiaffee.ipfs.nftstorage.link/"
    let prices = [toWei(1), toWei(2), toWei(3), toWei(4), toWei(5), toWei(6), toWei(7), toWei(8)]
    let deploymentFees = toWei(prices.length * fee_val)
    beforeEach(async function () {
      // Get the ContractFactory and Signers here.
      const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");
      [deployer, artist, user1, user2, ...users] = await ethers.getSigners();
  
      // Deploy music nft marketplace contract 
      nftMarketplace = await NFTMarketplaceFactory.deploy(
        royaltyFee,
        artist.address,
        prices,
        { value: deploymentFees }
      );
  
    });
    describe("1-Deployment",  ()=> {
      
      it("1.1-Test Constructor Paramter", async function () {

      expect(await nftMarketplace.name()).to.equal(nftName);
      expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
      expect(await nftMarketplace.baseURI()).to.equal(URI);
      expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
      expect(await nftMarketplace.artist()).to.equal(artist.address);
      });
      it("1.2-Test mint list all the music nfts", async function () {
        expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(8);
        // Get each item from the marketItems array then check fields to ensure they are correct
        await Promise.all(prices.map(async (value, indx) => {
          const item = await nftMarketplace.marketItems(indx)
          expect(item.tokenId).to.equal(indx)
          expect(item.seller).to.equal(deployer.address)
          expect(item.price).to.equal(value)
        }))
      });
      it("1.3-Ether balance should equal deployment fees", async function () {
        expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees)
      });

    })
    describe("2-Update royalty fee",()=>{

      it("2.1 Just owner can update royalty fee",async ()=>{
        
        const new_royaltyFee=toWei(0.02)
        // update royalty fee by owner (deployer)
        await nftMarketplace.updateRoyaltyFee(new_royaltyFee);
        
        // update by  someone but it is nothing changed 
        await expect(
          nftMarketplace.connect(user1).updateRoyaltyFee(new_royaltyFee)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        //the fee  it is still what is updated by owner in prev step
        expect(await nftMarketplace.royaltyFee()).to.equal(new_royaltyFee)

      });

    })

    describe("3-Buy tokens", ()=>{
    
       it("3.1-Update seller to zero address, transfer NFT, pay seller, pay royalty to artist and emit a MarketItemBought event",async ()=>{
         const deployerInitalEthBal = await deployer.getBalance()
         const artistInitialEthBal = await artist.getBalance()
        
         console.log("Initial balance")
         console.log("deployer-bal:"+ (+fromWei(deployerInitalEthBal))+"  and artist-bal:"+ (+fromWei(artistInitialEthBal)))
         console.log("=======================================================================")

         const tokenId_to_buy=0
         const price_to_buy=prices[tokenId_to_buy]
         
         await expect(nftMarketplace.connect(user1).buyToken(tokenId_to_buy,{value:price_to_buy}))
         .to.emit(nftMarketplace,"MarketItemBought")
         .withArgs(tokenId_to_buy,deployer.address,user1.address,price_to_buy)

         const deployerFinalEthBal=await deployer.getBalance()
         const artistFinalEthBal=await artist.getBalance()
         console.log("Final balance")
         console.log("deployer-bal:"+ (+fromWei(deployerFinalEthBal))+"  and artist-bal:"+ (+fromWei( artistFinalEthBal)))
         console.log("=======================================================================")
         // Item seller should be zero address
         expect( (await nftMarketplace.marketItems(tokenId_to_buy)).seller).to.equal("0x0000000000000000000000000000000000000000")
         
         // Seller should receive payment for the price of the NFT sold.
         expect( +fromWei(deployerFinalEthBal) ).to.equal( (+fromWei(price_to_buy)) + (+fromWei(deployerInitalEthBal)) )

         // Artist should receive royalty
         expect( +fromWei( artistFinalEthBal )).to.equal( ( +fromWei(royaltyFee) ) + ( +fromWei(artistInitialEthBal) )  )

         // The buyer should now own the nft
         expect(await nftMarketplace.ownerOf(tokenId_to_buy) ).to.equal(user1.address)
       })

       it("3.2-Fail when amount sent  to market is not equal to asking price",async ()=>{

        const tokenId_0=0 
        const price_1=prices[1] 
        // price doesn't match tokenId
        await expect(
          nftMarketplace.connect(user1).buyToken(tokenId_0, { value: price_1 })
        ).to.be.revertedWith("Please send the asking price in order to complete the purchase");
       })
    })

    describe("4-Reselling tokens", ()=> {

      const tokenId_0=0 
      const price_to_buy=prices[tokenId_0]

      beforeEach(async ()=>{
        await nftMarketplace.connect(user1). buyToken(tokenId_0,{value:price_to_buy})
      })

      it("4.1-track resale item, incr. ether bal by royalty fee, transfer NFT to marketplace and emit MarketItemRelisted event",async ()=>{
        
        const resaleprice = toWei(2)

        const initMarketBal=await ethers.provider.getBalance(nftMarketplace.address)
        console.log("Init Market Bal: "+  (+toWei (initMarketBal)))

        console.log("Resale price : "+ (+ resaleprice))
        
        // user1 lists the nft for a price of 2 hoping to flip it and double their money
        await expect(nftMarketplace.connect(user1).resellToken(tokenId_0,resaleprice ,{value:royaltyFee}))
        .to.emit(nftMarketplace,"MarketItemRelisted")
        .withArgs(tokenId_0,user1.address,resaleprice)

        const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
        console.log("Final Market Bal: "+ (+toWei(finalMarketBal)))

        expect(+fromWei(finalMarketBal)).to.equal( +fromWei(royaltyFee) + (+fromWei(initMarketBal)))

        // Owner of NFT should now be the marketplace
        expect(await nftMarketplace.ownerOf(tokenId_0)).to.equal(nftMarketplace.address);

        // // Get item as struct info from items mapping then check fields to ensure they are correct
        const item = await nftMarketplace.marketItems(tokenId_0)
        expect(item.tokenId).to.equal(tokenId_0)
        expect(item.seller).to.equal(user1.address)
        expect(item.price).to.equal(resaleprice)

      })

      it("4.2:Fail if price is zero or not enough to pay",async ()=>{
        await expect(
          nftMarketplace.connect(user1).resellToken(tokenId_0, 0, { value: royaltyFee })
        ).to.be.revertedWith("Price must be greater than zero");
        await expect(
          nftMarketplace.connect(user1).resellToken(tokenId_0, toWei(1), { value: 0 })
        ).to.be.revertedWith("Must pay royalty");
      })

    })

    describe("5-Getter functions", ()=> {
      let soldItems = [0, 1, 4]
      let ownedByUser1 = [0, 1]
      let ownedByUser2 = [4]

      beforeEach(async function () {
        // user1 purchases item 0.
        await (await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })).wait();
        // user1 purchases item 1.
        await (await nftMarketplace.connect(user1).buyToken(1, { value: prices[1] })).wait();
        // user2 purchases item 4.
        await (await nftMarketplace.connect(user2).buyToken(4, { value: prices[4] })).wait();
      })

      it("getAllUnsoldTokens should fetch all the marketplace items up for sale", async function () {
        const unsoldItems = await nftMarketplace.getAllUnsoldTokens()
        // Check to make sure that all the returned unsoldItems have filtered out the sold items.
        expect(unsoldItems.every(i => !soldItems.some(j => j === i.tokenId.toNumber()))).to.equal(true)
        // Check that the length is correct
        expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true)
      });

      it("getMyTokens should fetch all tokens the user owns", async function () {
        // Get items owned by user1
        let myItems = await nftMarketplace.connect(user1).getMyTokens()

        // Check that the returned my items array is correct
        expect(myItems.every(i => ownedByUser1.some(j => j === i.tokenId.toNumber()))).to.equal(true)
        expect(ownedByUser1.length === myItems.length).to.equal(true)

        // Get items owned by user2
        myItems = await nftMarketplace.connect(user2).getMyTokens()
        // Check that the returned my items array is correct
        expect(myItems.every(i => ownedByUser2.some(j => j === i.tokenId.toNumber()))).to.equal(true)
        expect(ownedByUser2.length === myItems.length).to.equal(true)
      });


    })
})