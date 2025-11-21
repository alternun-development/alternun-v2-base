# Migration Analysis: Stellar → Celo

## 📦 Contracts Inventory

### Current Stellar/Soroban Contracts
1. **gbt_token** (88 lines) - Gold-Backed Token with standard interface
2. **pgbt_token** (88 lines) - Potential Gold-Backed Token (identical structure)
3. **ept_token** (88 lines) - Environmental Project Token (identical structure)
4. **gbt_minter** (259 lines) - Complex minting logic with capacity calculations
5. **treasury** (68 lines) - Fund routing (50/30/20 split)
6. **project_vaults** (471 lines) - Most complex - project funding and staking
7. **oracle_mock** (48 lines) - Price oracle simulator

**Total**: ~1,110 lines of Soroban/Rust code

## 🔍 Key Discoveries from Code Review

### Token Configuration
- **Decimals**: 7 (to represent grams * 10,000)
  - Example: 1 gram = 1.0000000 tokens (7 decimals)
  - This is CRITICAL to maintain in migration
- **Standard**: Following Soroban token interface (similar to ERC-20)
- **Mintable**: Only by admin/authorized contracts

### Mining/Minting Logic (gbt_minter)

**Reserve Categories with Weights:**
```rust
W_INFERIDOS: 15% (1,500 bps) - Inferred resources
W_INDICADOS: 30% (3,000 bps) - Indicated resources  
W_MEDIDOS: 60% (6,000 bps) - Measured resources
W_PROBABLES: 50% (5,000 bps) - Probable reserves
W_PROBADAS: 70% (7,000 bps) - Proven reserves
```

**Capacity Calculation:**
```
capacity = (inferidos*W_INFERIDOS + indicados*W_INDICADOS + 
            medidos*W_MEDIDOS + probables*W_PROBABLES + 
            probadas*W_PROBADAS) * fc_bps / (10000 * 10000)
```

**Key Parameters:**
- `fee_bps`: Minting fee (default 200 = 2%)
- `fc_bps`: Commercial factor (default 8000 = 80%)
- Minimum mint: 1 gram (1,000 units in grams*1000 scale)

**Flow:**
1. User deposits stablecoins
2. Fee (2%) goes to admin
3. Net amount (98%) goes to Treasury routing
4. GBT minted based on gold price from oracle
5. Capacity tracking prevents over-minting

### Treasury Routing
**Split percentages (hardcoded):**
- 50% → Projects pool
- 30% → Recovery pool  
- 20% → Alternun treasury

**Critical**: This is called FROM the minter, not directly by users

### Project Vaults (Most Complex)

**Project Lifecycle:**
```
Proposed → Active → Funded → InConstruction → Operational → Completed/Failed
```

**Key Mechanics:**
- Users stake GBT to projects
- Receive pGBT (project-specific token)
- After paying 50% of debt → can claim ePT (equity token)
- Profits distributed based on stake
- KYC verification required for ePT claims
- Unstaking penalty (configurable, for early withdrawal)

**Unique Features:**
- Minimum stake units (e.g., 5 grams)
- Debt tracking per user
- Gold price locked at project creation
- Funding deadline enforcement

## 🔄 Migration Strategy

### Phase 1: Token Contracts (Simple)
**Migrate to ERC-20 standard:**
- GBT Token
- pGBT Token  
- ePT Token

**Changes needed:**
- Use OpenZeppelin ERC-20 base
- Keep 7 decimals (CRITICAL)
- Add Ownable/AccessControl for admin
- Implement mintable/burnable

### Phase 2: Treasury Contract
**Relatively straightforward:**
- Keep 50/30/20 split
- Make it **upgradeable** (UUPS proxy)
- Add abstraction for treasury token (USDT → xAUT ready)
- Same routing logic

### Phase 3: GBT Minter (Complex)
**Most challenging migration:**
- Port capacity calculation logic exactly
- Implement mine data structures
- Oracle integration (Chainlink or custom)
- Maintain all weights and formulas
- Preview function for UI
- Pausing mechanism

### Phase 4: Project Vaults (Very Complex)
**Most features to preserve:**
- All project statuses
- Staking/unstaking logic
- Debt tracking
- ePT claim logic with 50% threshold
- Profit distribution
- KYC integration
- Penalty calculations

### Phase 5: Oracle
**Replace with Chainlink or custom:**
- For testnet: MockOracle
- For mainnet: Chainlink Gold/USD feed
- Or build custom oracle with Tether Gold price

## 🎯 Critical Elements to Preserve

### 1. Numerical Precision
- **Grams scale**: grams * 1,000 (3 decimals)
- **Token decimals**: 7 decimals
- **USD scale**: amount * 1e7 (7 decimals)
- **Basis points**: 10,000 = 100%

### 2. Exact Formulas
- Capacity calculation with weights
- GBT output: `(net_stable * 1000) / price`
- Token units: `grams * 10,000` (for 7 decimals)

### 3. Business Logic
- 50/30/20 treasury split
- 2% minting fee default
- 80% commercial factor default
- 1 gram minimum mint
- 50% debt threshold for ePT
- All status transitions

### 4. Security Features
- Admin-only functions
- Pausing mechanism
- Capacity limits
- Deadline enforcement
- KYC verification

## 📋 Migration Checklist

### Pre-Migration
- [x] Review all Stellar contracts
- [x] Document all formulas and constants
- [x] Identify complex logic areas
- [x] Plan upgrade strategy

### During Migration
- [ ] Create ERC-20 tokens (GBT, pGBT, ePT)
- [ ] Implement Treasury with UUPS proxy
- [ ] Port GBT Minter with exact formulas
- [ ] Migrate Project Vaults logic
- [ ] Create Mock Oracle for testing
- [ ] Write comprehensive tests
- [ ] Frontend integration updates

### Post-Migration
- [ ] Deploy to Celo Alfajores testnet
- [ ] Extensive testing
- [ ] Security review
- [ ] Deploy to Celo mainnet
- [ ] Verify contracts on Celoscan

## 🔧 Technical Considerations

### Solidity vs Rust/Soroban
**Key differences:**
- Storage: Mapping vs instance storage
- Authorization: msg.sender vs require_auth()
- Token interface: ERC-20 vs Soroban token
- Error handling: require/revert vs panic_with_error
- Math: SafeMath patterns (though built-in Solidity 0.8+)

### OpenZeppelin Integration
Use these libraries:
- `@openzeppelin/contracts/token/ERC20/ERC20.sol`
- `@openzeppelin/contracts/access/AccessControl.sol`
- `@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol`
- `@openzeppelin/contracts/security/Pausable.sol`
- `@openzeppelin/contracts/security/ReentrancyGuard.sol`

### Upgradeability Strategy
**Must be upgradeable:**
- Treasury (for USDT → xAUT migration)

**Can be immutable (if logic solid):**
- Token contracts
- GBT Minter (unless we expect formula changes)
- Project Vaults (complex, better if immutable after thorough testing)

## 🚀 Development Order

1. **Week 1**: Tokens + Treasury
   - Deploy and test tokens
   - Implement upgradeable Treasury
   - Test USDT integration on testnet

2. **Week 2**: GBT Minter + Oracle
   - Port all minting logic
   - Implement mock oracle
   - Test capacity calculations

3. **Week 3**: Project Vaults
   - Migrate full project lifecycle
   - Test staking/unstaking
   - Verify debt and ePT logic

4. **Week 4**: Integration + Testing
   - Connect all contracts
   - Frontend updates
   - End-to-end testing
   - Prepare for mainnet

## 📊 Data Migration (If Needed)

**If you have existing data on Stellar:**
- Mine configurations (IDs, capacities, weights)
- Active projects
- User balances and stakes

**Migration options:**
1. Fresh start on Celo (recommended if POC only)
2. Manual migration of critical data
3. Snapshot and airdrop for token holders

**Recommendation**: Start fresh on Celo since Stellar was denied. This gives clean slate with proper backing from day 1.

## ✅ Ready to Start

**Next steps:**
1. Create token contracts (GBT, pGBT, ePT)
2. Implement Treasury with upgrade capability
3. Port GBT Minter with exact logic
4. Test everything on Alfajores
5. Deploy to mainnet

All code is analyzed and ready for precise migration.
