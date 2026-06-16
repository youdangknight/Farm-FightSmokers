const { ethers } = require('ethers');

const ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner) external',
];

const RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const NEW_OWNER_ADDRESS = process.env.NEW_OWNER_ADDRESS;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Missing PRIVATE_KEY for the current contract owner wallet');
  }

  if (!NEW_OWNER_ADDRESS || !ethers.isAddress(NEW_OWNER_ADDRESS)) {
    throw new Error('Missing or invalid NEW_OWNER_ADDRESS');
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error('Missing CONTRACT_ADDRESS');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  const currentOwner = await contract.owner();

  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Current owner: ${currentOwner}`);
  console.log(`Signer: ${wallet.address}`);
  console.log(`New owner: ${NEW_OWNER_ADDRESS}`);

  if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('The provided PRIVATE_KEY is not the current contract owner');
  }

  if (currentOwner.toLowerCase() === NEW_OWNER_ADDRESS.toLowerCase()) {
    console.log('New owner already matches current owner. No transaction sent.');
    return;
  }

  const tx = await contract.transferOwnership(NEW_OWNER_ADDRESS);
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

  const verifiedOwner = await contract.owner();
  console.log(`Verified owner: ${verifiedOwner}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
