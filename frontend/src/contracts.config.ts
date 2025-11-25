// Contract addresses - Base Sepolia Testnet
export const CONTRACTS = {
  sepolia: {
    gbtToken: "0x85b711F9d8629860696E215f1eFb5C51CeBd1F91",
    pgbtToken: "0xa70ccE827C1fD64a9A56b4f92685E521E1c398FC",
    eptToken: "0x11d772E59c0548f97e91D3b6325ef028fAc2a20f",
    treasury: "0x381556c226b8fCb9f026dcafdf9d44cf78dA54Be",
    minter: "0xE2179CF6fFe3dB4A0d5a473c1E53392d41d8E08f",
    vaults: "0x7201fADafe5eAa7cbab2982e204D0431651527a3",
    oracle: "0x530C977a22553Ad4140FEa0C137e9e163788DC26",
    usdt: "0x21db5aD253400eb396100f1E121b4b34bbc32bD6",
  },
  mainnet: {
    gbtToken: "0x0000000000000000000000000000000000000000",
    pgbtToken: "0x0000000000000000000000000000000000000000",
    eptToken: "0x0000000000000000000000000000000000000000",
    treasury: "0x0000000000000000000000000000000000000000",
    minter: "0x0000000000000000000000000000000000000000",
    vaults: "0x0000000000000000000000000000000000000000",
    oracle: "0x0000000000000000000000000000000000000000",
    usdt: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

export const ABIS = {
  erc20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function mint(address to, uint256 amount)",
  ],
  
  gbtToken: [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ],
  
  minter: [
    "function mint(uint256 stablecoinAmount) returns (uint256)",
    "function previewMint(uint256 stablecoinAmount) view returns (uint256 gbtAmount, uint256 feeAmount, uint256 goldPrice)",
    "function calculateCapacity() view returns (uint256)",
    "function getRemainingCapacity() view returns (uint256)",
    "function totalMinted() view returns (uint256)",
    "function feeBps() view returns (uint256)",
    "function commercialFactorBps() view returns (uint256)",
  ],
  
  vaults: [
    "function createProject(string name, string ipfsHash, uint256 fundingGoal, address fundingPool) returns (uint256)",
    "function activateProject(uint256 projectId)",
    "function stake(uint256 projectId, uint256 amount)",
    "function unstake(uint256 projectId, uint256 amount)",
    "function projects(uint256) view returns (string name, string ipfsHash, uint8 state, uint256 fundingGoal, uint256 totalStaked, uint256 totalProfits, uint256 createdAt, uint256 fundedAt, address projectOwner, bool acceptingStakes)",
    "function getUserStake(uint256 projectId, address user) view returns (uint256 amount, uint256 pGBTReceived, uint256 profitsClaimed, uint256 debtRepaid, bool hasConvertedToEPT, bool canConvertToEPT)",
    "function projectCount() view returns (uint256)",
  ],
  
  oracle: [
    "function getGoldPrice() view returns (uint256)",
  ],
};