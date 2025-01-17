# Bluto

A minimal Superfluid streaming app on Base.

## What is Streaming?

Streaming allows you to send tokens continuously in real-time, like a salary or subscription. Instead of periodic transfers, the recipient receives tokens every second.

## Setup Requirements

### Environment Variables

Create a `.env.local` file with:

```bash
# Required RPC endpoints in order of priority
NEXT_PUBLIC_ALCHEMY_RPC="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_THIRDWEB_RPC="https://base.rpc.thirdweb.com/YOUR_KEY"
NEXT_PUBLIC_PUBLIC_RPC="https://base.blockpi.network/v1/rpc/public"
```

### Token Requirements

1. **ETHx Token**:
   - Contract: `0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93`
   - Need sufficient balance for streaming and buffer
   - Wrap ETH to ETHx through Superfluid Dashboard

### Permissions Setup

The app will automatically handle:

1. Token approval for Superfluid host contract
2. Flow operator authorization
3. Stream creation verification

### Network Requirements

- Network: Base Mainnet
- ChainID: 8453
- Required RPC endpoints with sufficient rate limits

## Stream Creation Process

1. **Wallet Connection**:

   - Connect wallet to Base Mainnet
   - Ensure sufficient ETH for gas

2. **Token Setup**:

   - Wrap ETH to ETHx if needed
   - Minimum recommended: 0.1 ETHx

3. **Stream Creation**:

   - Enter valid recipient address
   - Set flow rate (monthly amount)
   - App handles approvals automatically
   - Verification occurs after creation

4. **Verification**:
   - Stream appears in Superfluid Dashboard
   - Real-time balance updates
   - Transaction confirmation on Base

## Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with required variables

3. Run development server:

```bash
npm run dev
```

## Technical Notes

- Uses Superfluid SDK v2
- Implements retry logic for RPC failures
- Handles rate limiting automatically
- Verifies stream creation through SDK
- Supports ENS, Lens, and Farcaster resolution

## Contract Addresses

```javascript
ETHx: "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93"
USDCx: "0x1D8Ee3C1F10Fd5683167fDB9f6711ef74083E0c0"
Superfluid Host: "0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74"
CFA Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125"
```

## Error Handling

- Retries on RPC rate limits
- Fallback RPC endpoints
- Automatic approval handling
- Stream verification checks

## Notes

- Requires MetaMask or similar Web3 wallet
- Requires ETHx for streaming (can be wrapped on Superfluid)
- Built on Base Mainnet for low fees
- Minimum stream duration: 1 month
- Buffer amount automatically calculated
