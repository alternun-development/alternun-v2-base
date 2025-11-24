# Alternun Protocol - Deployment Guide

## Prerequisites

1. **Get Base Sepolia ETH**
   - Visit: https://www.alchemy.com/faucets/base-sepolia
   - Or: https://docs.base.org/tools/network-faucets

2. **Set up environment variables**
```bash
   cp .env.example .env
   # Edit .env and add your PRIVATE_KEY
```

3. **Get Basescan API Key** (for verification)
   - Visit: https://basescan.org/myapikey
   - Add to .env as BASESCAN_API_KEY

## Deployment Steps

### Base Sepolia Testnet
```bash
npm run deploy:sepolia
```

### Base Mainnet
```bash
npm run deploy:base
```

## Post-Deployment

### 1. Verify Contracts
```bash
# Verify GBT Token
npx hardhat verify --network baseSepolia <GBT_ADDRESS> "<DEPLOYER_ADDRESS>"

# Verify Treasury (proxy)
npx hardhat verify --network baseSepolia <TREASURY_PROXY_ADDRESS>

# Verify Minter
npx hardhat verify --network baseSepolia <MINTER_ADDRESS> \
  "<GBT_ADDRESS>" "<TREASURY_ADDRESS>" "<ORACLE_ADDRESS>" \
  "<USDT_ADDRESS>" "200" "8000" "<DEPLOYER_ADDRESS>"
```

### 2. Update Configuration

Update the following addresses in production:
- Project Pool address
- Recovery Pool address
- Alternun Treasury address
- KYC Verifier address

### 3. Set Up Oracle

For production, replace MockPriceOracle with Chainlink oracle:
- Base Mainnet: Use Chainlink Gold/USD feed
- Update minter to use new oracle address

### 4. Upload Documentation

- Upload NI 43-101 reports to IPFS
- Register mine data on-chain
- Update reserves based on verified reports

## Testing on Testnet

### Mint some test USDT (if using mock)
```javascript
// In Hardhat console
const usdt = await ethers.getContractAt("MockERC20", "<USDT_ADDRESS>");
await usdt.mint("<YOUR_ADDRESS>", ethers.parseUnits("10000", 6));
```

### Test GBT Minting
```javascript
const minter = await ethers.getContractAt("GBTMinter", "<MINTER_ADDRESS>");
await usdt.approve(minter.address, ethers.parseUnits("1000", 6));
await minter.mint(ethers.parseUnits("100", 6));
```

## Mainnet Considerations

1. Use real USDT: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
2. Set up multi-sig for admin operations
3. Implement timelock for critical parameters
4. Complete security audit before mainnet
5. Set up monitoring and alerts
6. Prepare emergency pause mechanism

## Base Builder Grants

After successful testnet deployment:
1. Document your test results
2. Prepare demo video
3. Apply at: https://base.org/grants