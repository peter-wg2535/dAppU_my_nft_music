const { ethers } = require("hardhat");

async function main() {
  //define lambda function to convert string to money
  const convertToWei= (n)=>ethers.utils.parseEther(n.toString())

  // set price / song and rpralFee
  let royaltyFee=convertToWei(0.01)
  let prices = [convertToWei(1), convertToWei(2), convertToWei(3), convertToWei(4)
    , convertToWei(5), convertToWei(6), convertToWei(7), convertToWei(8)]

  // set fee to each artist and // get account
  let deploymentFee=convertToWei(prices.length*0.01)
  const [deployer, artist] = await ethers.getSigners();

  // kovan 


  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());


  // deploy contracts here:
  //constructor (uint256 _royaltyFee,address _artist,uint256[] memory _prices)   payable
  const MusicNFTMarketplace=await ethers.getContractFactory("MusicNFTMarketplace")
  const music_nft= await MusicNFTMarketplace.deploy(
                 royaltyFee,       artist.address,      prices,         {value: deploymentFee} )
  

  console.log("Smart contract address:",music_nft.address)
  
  // For each contract, pass the deployed contract and name to this function to save a copy of the contract ABI and address to the front end.
  saveFrontendFiles(music_nft,"MusicNFTMarketplace");
}
// save abi json file to folder for web front-end 
function saveFrontendFiles(contract, name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../../frontend/contractsData";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + `/${name}-address.json`,
    JSON.stringify({ address: contract.address }, undefined, 2)
  );

  const contractArtifact = artifacts.readArtifactSync(name);

  fs.writeFileSync(
    contractsDir + `/${name}.json`,
    JSON.stringify(contractArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
