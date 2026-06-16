const { ethers } = require('ethers');

const ABI = [
  'function owner() view returns (address)',
  'function treasury() view returns (uint256)',
  'function INITIAL_OWNER_BALANCE() view returns (uint256)',
  'function INITIAL_PLAYER_BALANCE() view returns (uint256)',
  'function SEED_UNIT_PRICE() view returns (uint256)',
  'function playerBalances(address) view returns (uint256)',
  'function initializedPlayers(address) view returns (bool)',
  'function processedReports(bytes32) view returns (bool)',
  'function rewardUser(address user, uint256 score, string reportId) external',
  'function buySeeds(uint256 amount) external',
  'function getBalance(address user) view returns (uint256 playerBalance, uint256 treasuryBalance)',
  'function transferOwnership(address newOwner) external',
];
const RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const USER_ADDRESS = process.env.USER_ADDRESS;
const SCORE = process.env.SCORE;
const REPORT_ID = process.env.REPORT_ID;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Missing PRIVATE_KEY');
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error('Missing CONTRACT_ADDRESS');
  }

  if (!USER_ADDRESS) {
    throw new Error('Missing USER_ADDRESS');
  }

  if (SCORE === undefined) {
    throw new Error('Missing SCORE');
  }

  if (!REPORT_ID) {
    throw new Error('Missing REPORT_ID');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  console.log(`Using admin wallet: ${wallet.address}`);
  console.log(`Rewarding user: ${USER_ADDRESS}`);
  console.log(`Score: ${SCORE}`);
  console.log(`Report ID: ${REPORT_ID}`);

  const tx = await contract.rewardUser(USER_ADDRESS, BigInt(SCORE), REPORT_ID);
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
