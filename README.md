# Alternun Protocol - Base Implementation 🌱

> Regenerative Finance Protocol tokenizing verified underground gold reserves to fund environmental projects in Colombia

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)

## 🎯 Overview

Alternun bridges real-world gold reserves with decentralized regenerative finance, creating a paradigm where tangible underground gold underlies digital tokens that fund environmental impact projects.

**Key Innovation**: Instead of extracting gold, we tokenize verified underground reserves to preserve the environment while unlocking capital for sustainability initiatives.

### The Problem We Solve
- 💰 Gold extraction is environmentally destructive
- 🌍 Regenerative projects struggle to access capital
- 🏦 Traditional finance lacks transparency in asset backing
- 📊 Communities near reserves don't benefit from their resources

### Our Solution
1. **Tokenize Underground Gold**: Verified reserves (NI 43-101 standard) become GBT tokens
2. **Fund Impact Projects**: Token sales finance solar farms, reforestation, sustainable agriculture
3. **Community Participation**: Local communities earn equity tokens (ePT) by supporting projects
4. **Transparent Backing**: Every token is backed by verifiable gold reserves

## 🏗️ Architecture

### Technology Stack
- **Blockchain**: Base (Coinbase L2 on Ethereum)
- **Language**: Solidity ^0.8.24
- **Framework**: Hardhat + TypeScript
- **Token Standard**: ERC-20
- **Upgradeability**: OpenZeppelin UUPS Proxies
- **Treasury Token**: USDT (Phase 1) → xAUT/Tether Gold (Phase 2)

### Why Base?
- ✅ Direct Coinbase integration
- ✅ Access to 110M+ verified users
- ✅ Instant tradability on Coinbase for tokens launched on Base
- ✅ Active Base Builder Grants program
- ✅ Low fees and fast transactions
- ✅ Strong ReFi ecosystem

### Smart Contracts

#### Core Tokens
1. **GBT Token** - Gold-Backed Token (7 decimals)
   - Backed 1:1 by verified underground gold reserves
   - Mintable only when new reserves are verified
   - Burnable if reserves are re-evaluated

2. **pGBT Token** - Potential Gold-Backed Token
   - Represents reserves under verification
   - Convertible to GBT upon full verification
   - Higher risk profile during verification period

3. **ePT Token** - Environmental Project Token
   - Issued to project supporters
   - Governance voting rights
   - Impact tracking credential

#### Core Contracts
4. **Treasury Manager** (Upgradeable)
   - Manages protocol reserves (USDT → xAUT migration ready)
   - Enforces 50/30/20 split: Projects/Recovery/Alternun
   - Validates backing ratios

5. **GBT Minter**
   - Mints GBT based on verified reserve capacity
   - Implements weighted reserve categories (NI 43-101)
   - Oracle integration for gold pricing
   - 2% minting fee, 80% commercial factor

6. **Project Vaults**
   - Manages regenerative project lifecycle
   - Handles staking/unstaking of GBT
   - Tracks debt and profit distribution
   - Issues ePT tokens at 50% debt threshold

7. **Oracle** (Mock for testing, Chainlink for production)
   - Provides gold/USD price feeds
   - Critical for mint calculations

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/alternun-development/alternun-v2-base.git
cd alternun-v2-base

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your private key and API keys

# Compile contracts
npm run compile

# Run tests
npm test
```

### Deployment

#### Testnet (Base Sepolia)
```bash
npm run deploy:sepolia
```

#### Mainnet (Base)
```bash
npm run deploy:base
```

### Contract Verification
```bash
# Base Sepolia
npm run verify:sepolia -- DEPLOYED_CONTRACT_ADDRESS "Constructor Args"

# Base Mainnet
npm run verify:base -- DEPLOYED_CONTRACT_ADDRESS "Constructor Args"
```

## 📊 Tokenomics

### GBT (Gold-Backed Token)
- **Decimals**: 7 (to represent grams * 10,000)
- **Backing**: Verified underground gold reserves
- **Minting**: Only through verified reserve increases
- **Minimum Mint**: 1 gram

### Reserve Categories (NI 43-101 Standard)
| Category | Weight | Description |
|----------|--------|-------------|
| Proven Reserves | 70% | Highest confidence, ready for extraction |
| Probable Reserves | 50% | High confidence, needs more study |
| Measured Resources | 60% | Detailed sampling completed |
| Indicated Resources | 30% | Reasonable confidence level |
| Inferred Resources | 15% | Limited sampling, lowest confidence |

**Capacity Formula**:
```
Capacity = Σ(Category Amount × Weight × Commercial Factor) / 10,000
```

### Treasury Split
- **50%** → Project Funding Pool
- **30%** → Recovery Pool (backup/insurance)
- **20%** → Alternun Treasury (8% to mine owners, rest operational)

## 🧪 Testing
```bash
# Run all tests
npm test

# Generate coverage report
npm run test:coverage

# Run gas reporter
REPORT_GAS=true npm test
```

## 📁 Project Structure
```
alternun-v2-base/
├── contracts/
│   ├── tokens/          # GBT, pGBT, ePT token contracts
│   ├── core/            # Treasury, Minter, ProjectVaults
│   ├── governance/      # Governance contracts (future)
│   └── interfaces/      # Contract interfaces
├── scripts/
│   ├── deploy.ts        # Deployment script
│   └── verify.ts        # Verification helpers
├── test/                # Contract tests
├── docs/                # Additional documentation
├── SPECIFICATIONS.md    # Technical specifications
├── MIGRATION_ANALYSIS.md # Stellar → Base migration notes
└── README.md           # This file
```

## 🔐 Security

### Audit Status
- [ ] Internal review completed
- [ ] External audit scheduled
- [ ] Bug bounty program

### Security Features
- Multi-signature for critical operations
- Timelock for sensitive parameter changes
- Circuit breakers for rapid changes
- Upgradeable treasury for token migration
- Rate limiting on mints/burns

### Responsible Disclosure
If you discover a security vulnerability, please email: security@alternun.io

## 🌍 Impact Metrics

Track our environmental impact:
- **CO2 Offset**: [Coming soon]
- **Hectares Reforested**: [Coming soon]
- **Clean Energy Generated**: [Coming soon] MWh
- **Projects Funded**: [Coming soon]

## 🗺️ Roadmap

### Phase 1: Foundation (Q1 2025) ✅
- [x] Smart contract architecture
- [x] Stellar code analysis
- [x] Base contract migration
- [ ] Base Sepolia testnet deployment

### Phase 2: Launch (Q2 2025)
- [ ] Security audit
- [ ] Mainnet deployment
- [ ] First mine tokenization (Nechí, Antioquia)
- [ ] Launch first regenerative project

### Phase 3: Growth (Q3 2025)
- [ ] xAUT integration (gold-backed treasury)
- [ ] Celo blockchain deployment (parallel)
- [ ] Additional mine onboarding
- [ ] Mobile app launch

### Phase 4: Scale (Q4 2025)
- [ ] Cross-chain bridges
- [ ] DeFi integrations
- [ ] DAO governance activation
- [ ] International expansion

## 👥 Team & Contact

**Alternun Development Team**
- Website: [alternun.io](https://alternun.io)
- Email: info@alternun.io
- Twitter: [@alternun_io](https://twitter.com/alternun_io)

### Community
- Discord: [Join our community](https://discord.gg/alternun)
- Telegram: [@alternun_official](https://t.me/alternun_official)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Coinbase & Base** - For building accessible L2 infrastructure
- **Stellar Development Foundation** - For initial development support
- **OpenZeppelin** - For secure smart contract libraries
- **Local Communities** - In Nechí and Amalfi, Antioquia

---

**Built with 🌱 for regenerative finance in Latin America**

*Turning liability into legacy. Keeping gold underground while creating above-ground value.*
