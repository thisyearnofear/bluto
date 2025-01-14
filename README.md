# Superfluid Streaming App

A simple dApp for creating token streams on Base Sepolia using Superfluid.

## Overview

This app demonstrates how to create token streams using Superfluid's CFA (Constant Flow Agreement) Forwarder on Base Sepolia. Users can stream ETHx (Super Token version of ETH) to any address at a minimum flow rate.

## Technical Details

### Key Contracts

- ETHx Token: `0x143ea239159155b408e71cdbe836e8cfd6766732`
- CFA Forwarder: `0xcfA132E353cB4E398080B9700609bb008eceB125`

### Flow Rate

- Minimum flow rate: `385802469135` wei/second
- This equals approximately 0.01 tokens per month

### Buffer Requirements

- Each stream requires a buffer amount
- Current buffer requirement: ~0.00139 ETHx
- User must have more ETHx than the buffer amount

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file with:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ETHX_ADDRESS=0x143ea239159155b408e71cdbe836e8cfd6766732
```

3. Run the development server:

```bash
npm run dev
```

## Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.0.4",
    "@tanstack/react-query": "^5.0.0",
    "connectkit": "^1.8.2",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "ethers": "^5.7.2"
  }
}
```

### Network Configuration

Base Sepolia testnet details:

- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Block Explorer: https://sepolia.basescan.org

## Features

### Wallet Connection

- Uses ConnectKit for wallet management
- Automatically handles network switching to Base Sepolia
- Supports multiple wallet providers

### Stream Creation

1. Checks if user has sufficient ETHx balance
2. Verifies buffer amount requirements
3. Creates stream using `setFlowrate` function
4. Minimum flow rate enforced to prevent failed transactions

### Error Handling

- Network validation
- Balance checks
- Transaction status monitoring
- Detailed error messages

## Smart Contract Integration

### CFA Forwarder ABI

Key functions used:

```typescript
const CFAv1ForwarderABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowrate", type: "int96" },
    ],
    name: "setFlowrate",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "flowrate", type: "int96" },
    ],
    name: "getBufferAmountByFlowrate",
    outputs: [{ name: "bufferAmount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];
```

## Testing

To test the app:

1. Get Base Sepolia ETH from the faucet
2. Wrap ETH to ETHx using Superfluid Dashboard
3. Ensure you have more than the required buffer amount
4. Enter recipient address and create stream

## Common Issues

1. Insufficient ETHx Balance

   - Solution: Wrap more ETH to ETHx

2. Network Connection

   - Solution: Ensure wallet is connected to Base Sepolia

3. Flow Rate Errors
   - Solution: Use the minimum flow rate of 385802469135 wei/second

## Resources

- [Superfluid Docs](https://docs.superfluid.finance/)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet)
- [Superfluid Dashboard](https://app.superfluid.finance/)
