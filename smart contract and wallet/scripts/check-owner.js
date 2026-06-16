const { ethers } = require('ethers');

const ABI = [
  'function owner() view returns (address)',
  'function treasury() view returns (uint256)',
  'function getBalance(address user) view returns (uint256 playerBalance, uint256 treasuryBalance)',
];

const RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const USER_ADDRESS = process.env.USER_ADDRESS;

async function main() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Missing CONTRACT_ADDRESS');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const owner = await contract.owner();
  const treasury = await contract.treasury();

  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Owner: ${owner}`);
  console.log(`Treasury: ${treasury.toString()}`);

  if (USER_ADDRESS) {
    if (!ethers.isAddress(USER_ADDRESS)) {
      throw new Error('USER_ADDRESS is not a valid EVM address');
    }

    const [playerBalance] = await contract.getBalance(USER_ADDRESS);
    console.log(`User: ${USER_ADDRESS}`);
    console.log(`User balance: ${playerBalance.toString()}`);
    console.log(`User is owner: ${owner.toLowerCase() === USER_ADDRESS.toLowerCase()}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
