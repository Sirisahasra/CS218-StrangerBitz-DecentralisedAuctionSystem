# BlockBid — Decentralized Auction System

**Project Number:** Project 5

BlockBid is a blockchain-based decentralized auction platform built on Ethereum. It allows users to create auctions, place bids through MetaMask wallet transactions, securely withdraw refundable bids, and finalize auctions using smart contracts without centralized intermediaries.

---

# Team Name

**Strangerbitz**

# Team Members

| S.No | Name | Roll Number |
|------|------|------|
| 1 | Gujjula Siri Sahasra | 240001032 |
| 2 | Paruchuri Bhavya Sri | 240001049 |
| 3 | Gopisetti Pradhyumna | 240041018 |
| 4 | Chandana Lakshmi Subhadra | 240041009 |
| 5 | Menni Hima Harika | 240001046 |

---

# Project Objective

To develop a secure, transparent, and decentralized auction platform where users can create auctions and place bids directly through Ethereum smart contracts without intermediaries.

---

# Key Features

- Create decentralized auctions
- Secure bidding through MetaMask wallets
- Automatic highest bidder tracking
- Withdrawal pattern for refundable bids
- Permissionless auction finalization after deadline
- IPFS-based decentralized image and metadata storage
- Reentrancy attack protection using OpenZeppelin
- Gas-optimized smart contract implementation

---

# Tech Stack

- Solidity ^0.8.20
- Hardhat
- OpenZeppelin Contracts
- Node.js
- React.js
- Ethers.js
- MetaMask
- Pinata + IPFS
- Ethereum Sepolia Testnet

---

# Repository Structure

```text
BlockBid/
├── contracts/
│   ├── Auction.sol
│   ├── AuctionBeforeOptimisation.sol
│   └── ReentrancyAttacker.sol
├── frontend/
│   └── auction-project-main/
│       ├── client/
│       ├── public/
│       ├── server/
│       ├── shared/
│       ├── reports/
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.ts
├── reports/
│   ├── coverage-report.pdf
│   └── gas-report.pdf
├── test/
│   └── Auction.test.js
├── README.md
├── hardhat.config.js
└── package.json
```

---

# Smart Contract Overview

## Main Contract

`Auction.sol`

## Core Functions

### `createAuction()`
Creates a new auction with:
- IPFS CID
- starting price
- auction duration

### `placeBid()`
Allows users to place bids higher than the current highest bid.

### `withdrawBid()`
Allows outbid users to securely withdraw refundable ETH using the withdrawal pattern.

### `endAuction()`
Ends auction after deadline and transfers highest bid amount to seller.

### `getAuction()`
Returns complete auction details.

### `getPendingReturn()`
Returns refundable balance of a bidder.

---

# On-chain vs Off-chain Design

## Stored On-chain

The following data is stored directly on the Ethereum blockchain because it is required for contract execution and auction logic:

- Auction count
- Seller wallet address
- Highest bidder address
- Highest bid amount (wei)
- Starting price
- Auction deadline timestamp
- Auction ended status
- Pending returns mapping (refund balances)
- IPFS CID reference

## Stored Off-chain (IPFS)

The following data is stored off-chain using IPFS to reduce gas costs and improve scalability:

- Product image
- Product description
- Auction metadata JSON
- Item condition details

## Reason for Off-chain Storage

Blockchain storage is expensive, permanent, and publicly visible. Large files such as images and descriptive metadata significantly increase gas costs if stored on-chain.

To optimize efficiency, the project stores only the IPFS CID on-chain while keeping large auction metadata files on IPFS through Pinata.

## Privacy & GDPR Considerations

The project does not store:
- Seller personal information
- Bidder names
- Phone numbers
- Emails
- Payment details
- Shipping addresses

Bidder wallet addresses and bid amounts remain publicly visible on-chain as part of Ethereum transaction transparency.

---

# Security Measures

- OpenZeppelin `ReentrancyGuard`
- `nonReentrant` modifier on sensitive functions
- Withdrawal pattern using `pendingReturns`
- Checks-Effects-Interactions pattern
- Seller cannot self-bid
- Double withdrawal prevention
- Double auction ending prevention
- Input validation using `require()` statements
- Invalid auction ID protection
- Prevention of bids after auction expiry
- Permissionless auction ending after deadline
- No personal user data stored on-chain

---

# Gas Optimisation

We optimized storage variables to reduce gas costs through storage slot packing.

## Before Optimisation

Used default `uint256` for all numeric variables.

## After Optimisation

```solidity
uint96 highestBid;
uint96 startingPrice;
uint64 deadline;
```

## Gas Report

| Function | Metric | Before | After | Difference |
|---|---|---|---|---|
| createAuction() | Avg | 142102 | 116609 | -25493 |
| endAuction() | Avg | 63305 | 42733 | -20572 |
| placeBid() | Avg | 76472 | 58107 | -18365 |
| withdrawBid() | Avg | 31705 | 31705 | 0 |
| placeAttackBid() | Avg | 93744 | 68415 | -25329 |

## Contract Deployment Cost

| Contract | Before | After | Difference |
|---|---|---|---|
| Auction | 1814010 | 2015747 | +201737 |
| ReentrancyAttacker | 466617 | 466617 | 0 |

## Why Gas Improved

Smaller data types enabled efficient storage slot packing, reducing storage operations and lowering runtime transaction gas costs.

Although deployment gas increased slightly due to added security checks and functionality, frequently used runtime functions became significantly cheaper.

---

# Testing

Comprehensive Hardhat automated test suite implemented for:
- functionality
- validation checks
- edge cases
- security testing
- reentrancy protection

## Total Test Cases

**22 Test Cases**

## Test Cases Covered

### Auction Creation
- Should create auction
- Should return auction ID
- Should reject empty IPFS CID
- Should reject zero starting price
- Should reject zero duration

### Bidding Logic
- Should accept valid bid
- Should reject seller bidding on own auction
- Should reject bids lower than current highest
- Should reject equal bids
- Should reject bids for invalid auction
- Should reject first bid below starting price
- Should move previous highest bid to pendingReturns

### Withdrawals
- Should allow withdrawal of pending returns
- Should reject withdrawal when no funds available
- Should not allow double withdrawal

### Auction Ending
- Should end auction after deadline
- Should revert endAuction before deadline
- Should not allow ending auction twice
- Seller receives highest bid after auction ends
- Should reject bids after auction ends

### Multiple Auctions
- Should support multiple auctions simultaneously

### Security
- Should prevent reentrancy attack

## Coverage

Line Coverage Achieved: **>= 70%**

---

# Setup Instructions

## Prerequisites

Install:
- Node.js
- npm
- Git
- MetaMask Browser Extension

## Install Dependencies

```bash
npm install
```

## Compile Smart Contracts

```bash
npx hardhat compile
```

## Run Tests

```bash
npx hardhat test
```

## Generate Coverage Report

```bash
npx hardhat coverage
```



## Deploy to Sepolia Testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Run Frontend

```bash
cd frontend/auction-project-main
npm install
npm run dev
```

---

# Live Demo Flow

1. Connect MetaMask wallet
2. Upload image to IPFS using Pinata
3. Create auction
4. Place bid using another wallet
5. Withdraw refundable bid
6. End auction after deadline
7. Display winner and balances

---

# Known Limitations

- Bid amounts and bidder wallet addresses are publicly visible on-chain.
- Auction expiration depends on `block.timestamp`, which validators can manipulate slightly.
- IPFS gateway availability may affect image loading speed.
- Auctions follow open English auction rules, so competitors can see bids publicly.

---

# Future Enhancements

- NFT-based auctions
- Mobile application
- Multi-chain support
- Real-time notifications
- Reputation system
- Auto-bidding system
- Sealed-bid auction mechanism

---

# License

This project was developed for academic and educational purposes.
