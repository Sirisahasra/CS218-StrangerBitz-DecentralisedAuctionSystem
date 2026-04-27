// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AuctionBeforeOptimisation  is ReentrancyGuard {

    struct AuctionItem {
        address payable seller;
        address highestBidder;

        uint256 highestBid;
        uint256 startingPrice;
        uint256 deadline;

        bool ended;

        
        string ipfsCID;
    }

    uint256 public auctionCount;

    mapping(uint256 => AuctionItem) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    event AuctionCreated(uint256 indexed auctionId, address indexed seller);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 amount);

    // ✅ CREATE AUCTION
    function createAuction(
        
        string calldata _ipfsCID,
        uint256 _startingPrice,
        uint256 _duration
    ) external {

        
        require(bytes(_ipfsCID).length > 0, "IPFS CID should not be empty");
        require(_startingPrice > 0, "Starting price should be greater than 0");
        require(_duration > 0, "Duration should be greater than 0");

        uint256 id = ++auctionCount;

        auctions[id] = AuctionItem({
            seller: payable(msg.sender),
            highestBidder: address(0),
            highestBid: 0,
            startingPrice: _startingPrice,
            deadline: block.timestamp + _duration,
            ended: false,
           
            ipfsCID: _ipfsCID
        });

        emit AuctionCreated(id, msg.sender);
    }

    // ✅ PLACE BID (FIXED FIRST BID LOGIC)
    function placeBid(uint256 _auctionId) external payable nonReentrant {

        require(_auctionId > 0 && _auctionId <= auctionCount, "Auction does not exist");

        AuctionItem storage a = auctions[_auctionId];

        require(!a.ended, "Auction already ended");
        require(block.timestamp < a.deadline, "Auction already ended");
        require(msg.sender != a.seller, "Seller cannot bid");

        // ✅ FIXED LOGIC
        if (a.highestBid == 0) {
            require(msg.value >= a.startingPrice, "First bid must be >= starting price");
        } else {
            require(msg.value > a.highestBid, "Bid must be greater than current highest bid");
        }

        address prevBidder = a.highestBidder;
        uint256 prevBid = a.highestBid;

        a.highestBidder = msg.sender;
        a.highestBid = msg.value;

        if (prevBidder != address(0)) {
            pendingReturns[_auctionId][prevBidder] += prevBid;
        }

        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }

    // ✅ WITHDRAW
    function withdrawBid(uint256 _auctionId) external nonReentrant {

        uint256 amount = pendingReturns[_auctionId][msg.sender];
        require(amount > 0, "No refundable amount");

        pendingReturns[_auctionId][msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // ✅ END AUCTION
    function endAuction(uint256 _auctionId) external nonReentrant {

        require(_auctionId > 0 && _auctionId <= auctionCount, "Auction does not exist");

        AuctionItem storage a = auctions[_auctionId];

        require(!a.ended, "Auction already ended");
        require(block.timestamp >= a.deadline, "Auction deadline not reached");

        a.ended = true;

        if (a.highestBid > 0) {
            pendingReturns[_auctionId][a.seller] += a.highestBid;
        }

        emit AuctionEnded(_auctionId, a.highestBidder, a.highestBid);
    }

    // ✅ GET AUCTION
    function getAuction(uint256 _auctionId) external view returns (AuctionItem memory) {
        require(_auctionId > 0 && _auctionId <= auctionCount, "Auction does not exist");
        return auctions[_auctionId];
    }

    // ✅ GET PENDING RETURNS
    function getPendingReturn(uint256 _auctionId, address user) external view returns (uint256) {
        return pendingReturns[_auctionId][user];
    }
}
