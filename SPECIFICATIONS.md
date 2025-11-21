# Alternun Protocol - Technical Specifications

## Tokenomics Model

### GBT (Gold-Backed Token)
- **Backing**: 1 GBT = X grams of verified underground gold reserves
- **Minting**: Only through Mining Controller when reserves are verified
- **Burning**: When gold is extracted or reserves are re-evaluated
- **Use Cases**: 
  - Collateral for project funding
  - Trading/liquidity
  - Reserve representation

### pGBT (Potential Gold-Backed Token)
- **Backing**: Represents reserves under verification process
- **Minting**: When new reserves are identified but not yet fully verified
- **Conversion**: pGBT → GBT upon verification completion
- **Risk Profile**: Higher risk due to verification pending

### ePT (Environmental Project Token)
- **Generation**: Issued when regenerative projects are funded
- **Use Cases**:
  - Governance voting rights
  - Project impact tracking
  - Community rewards
- **Non-transferable**: Initially soulbound to project supporters

## Reserve Locations (Colombia)

### Active Reserves
1. **Nechí, Antioquia**
   - Estimated reserves: TBD tons
   - Verification status: TBD
   - Mining rights: TBD

2. **Amalfi, Antioquia**
   - Estimated reserves: TBD tons
   - Verification status: TBD
   - Mining rights: TBD

*[Santiago: Please fill in actual data from your Stellar implementation]*

## Smart Contract Architecture

### 1. Treasury Manager (Core)
**Responsibilities:**
- Hold protocol reserves (USDT → xAUT migration ready)
- Validate backing ratios
- Execute token mints/burns based on reserve changes
- Upgradeable proxy pattern for treasury token swap

**Key Functions:**
- `depositReserves(amount)`: Add USDT to treasury
- `validateBacking()`: Check if GBT supply is properly backed
- `authorizedMint(token, amount)`: Mint tokens when reserves increase
- `authorizedBurn(token, amount)`: Burn tokens when reserves decrease
- `migrateTreasuryToken(newToken)`: Admin function to swap USDT → xAUT

### 2. Mining Controller
**Responsibilities:**
- Convert verified reserves to GBT
- Rate limiting and security controls
- Integration with oracle for reserve verification
- Track reserve metadata (location, verification date, etc.)

**Key Functions:**
- `registerReserve(location, amount, metadata)`: Register new pGBT
- `verifyReserve(reserveId)`: Convert pGBT → GBT upon verification
- `updateReserveStatus(reserveId, status)`: Update reserve information
- `calculateMintAmount(reserveGrams)`: GBT calculation from gold weight

### 3. Project Funding
**Responsibilities:**
- Accept project proposals
- Distribute funding to approved projects
- Issue ePT tokens to funders
- Track project milestones and impact

**Key Functions:**
- `proposeProject(details, fundingGoal)`: Submit regenerative project
- `fundProject(projectId, amount)`: Contribute to project funding
- `releaseProjectFunds(projectId, milestone)`: Disburse funds by milestone
- `reportImpact(projectId, metrics)`: Record environmental impact

**Project Types:**
- Solar farms
- Reforestation
- Water treatment
- Sustainable agriculture

### 4. Governance
**Responsibilities:**
- ePT-based voting
- Protocol parameter updates
- Project approval voting
- Treasury management decisions

**Key Functions:**
- `createProposal(type, params)`: Submit governance proposal
- `vote(proposalId, support)`: Vote with ePT weight
- `executeProposal(proposalId)`: Execute passed proposals
- `delegateVotes(to)`: Delegate voting power

## Security Features

### Access Control
- Multi-signature for critical operations
- Role-based permissions (Admin, Verifier, Operator)
- Timelock for sensitive parameter changes

### Economic Security
- Collateralization ratio monitoring
- Circuit breakers for rapid changes
- Rate limiting on mints/burns
- Reserve audit trail

### Upgrade Strategy
- Transparent proxy pattern for upgradeability
- Treasury Manager MUST be upgradeable (USDT → xAUT)
- Other contracts can be immutable if logic is solid
- 48-hour timelock on upgrades

## Integration Points

### Oracles (Future)
- Reserve verification oracle
- Gold price feeds (for UI, not critical to protocol)
- Environmental impact metrics

### External Protocols
- DEX integration (liquidity pools)
- Lending protocols (GBT as collateral)
- Bridge protocols (future multi-chain)

## Migration from Stellar

### Maintained Elements
- Exact tokenomics ratios
- Business logic flow
- Reserve data and metadata
- Project information
- Historical context

### Changed Elements
- Blockchain: Stellar → Celo
- Language: Rust/Soroban → Solidity
- Treasury token: PAX Gold → USDT (Phase 1)
- Wallet integration: Freighter → MetaMask/Valora

## Deployment Checklist

### Pre-Deployment
- [ ] Security audit (internal)
- [ ] Testnet deployment and testing
- [ ] Frontend integration testing
- [ ] Oracle integration (if applicable)
- [ ] Documentation complete

### Deployment Steps
1. Deploy token contracts (GBT, pGBT, ePT)
2. Deploy Treasury Manager (proxy)
3. Deploy Mining Controller
4. Deploy Project Funding
5. Deploy Governance
6. Configure access controls
7. Initialize with existing reserve data
8. Transfer ownership to multisig

### Post-Deployment
- [ ] Verify contracts on Celoscan
- [ ] Grant applications submitted
- [ ] Community announcement
- [ ] Liquidity provision
- [ ] Monitor for 48 hours

## Key Metrics to Track

### Protocol Health
- Total GBT supply
- Total pGBT supply
- Treasury balance (USDT/xAUT)
- Backing ratio (should always be ≥ 100%)
- Number of verified reserves

### Impact Metrics
- Projects funded
- ePT tokens issued
- CO2 offset (tons)
- Hectares reforested
- Clean energy generated (MWh)

### Community Metrics
- Active addresses
- Governance participation rate
- Average project funding time
- Community proposals submitted

---

**Status**: Ready for contract development
**Next**: Santiago to provide Stellar contract source code for exact migration
