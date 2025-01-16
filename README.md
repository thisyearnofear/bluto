# Bluto

A minimal Superfluid streaming app on Base.

## What is Streaming?

Streaming allows you to send tokens continuously in real-time, like a salary or subscription. Instead of periodic transfers, the recipient receives tokens every second.

## Use Cases

- **Contributor Payments**: Pay team members or freelancers in real-time
- **Subscription Services**: Automate your subscription payments
- **Regular Transfers**: Send money to family or friends continuously
- **DAO Operations**: Manage continuous payments to contributors
- **Revenue Sharing**: Split revenues in real-time with partners

## Features

- Stream ETHx tokens to any address
- Support for ENS, Lens, and Farcaster names
- Built on Base Mainnet
- Uses Superfluid Protocol
- Simple, minimal interface

## How It Works

1. Connect your wallet
2. Enter recipient's address (or ENS/Lens/Farcaster name)
3. Choose monthly stream amount
4. Start streaming!

Your tokens will flow continuously to the recipient, second by second.

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

## Notes

- Requires MetaMask or similar Web3 wallet
- Requires ETHx for streaming (can be wrapped on Superfluid)
- Built on Base Mainnet for low fees
