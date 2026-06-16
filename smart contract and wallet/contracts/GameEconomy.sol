// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GameEconomy {
    uint256 public constant INITIAL_OWNER_BALANCE = 100000000;
    uint256 public constant INITIAL_PLAYER_BALANCE = 10;
    address public owner;
    uint256 public treasury;
    uint256 public constant SEED_UNIT_PRICE = 1;

    mapping(address => uint256) public playerBalances;
    mapping(address => bool) public initializedPlayers;
    mapping(bytes32 => bool) public processedReports;

    event RewardUser(
        address indexed user,
        uint256 score,
        string reportId,
        uint256 reward,
        uint256 newBalance
    );

    event BuySeeds(
        address indexed buyer,
        uint256 amount,
        uint256 totalPrice,
        uint256 newBalance,
        uint256 newTreasury
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function _initializePlayer(address user) internal {
        if (user == owner || initializedPlayers[user]) {
            return;
        }

        initializedPlayers[user] = true;
        playerBalances[user] = INITIAL_PLAYER_BALANCE;
    }

    function _balanceOf(address user) internal view returns (uint256) {
        if (user == owner) {
            return playerBalances[user];
        }

        if (!initializedPlayers[user]) {
            return INITIAL_PLAYER_BALANCE;
        }

        return playerBalances[user];
    }

    constructor() {
        owner = msg.sender;
        initializedPlayers[msg.sender] = true;
        playerBalances[msg.sender] = INITIAL_OWNER_BALANCE;
    }

    function rewardUser(address user, uint256 score, string calldata reportId) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(bytes(reportId).length > 0, "Empty reportId");

        _initializePlayer(user);

        bytes32 reportKey = keccak256(bytes(reportId));
        require(!processedReports[reportKey], "Report already rewarded");

        processedReports[reportKey] = true;
        playerBalances[user] = _balanceOf(user) + score;

        emit RewardUser(user, score, reportId, score, playerBalances[user]);
    }

    function buySeeds(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        _initializePlayer(msg.sender);

        uint256 totalPrice = amount * SEED_UNIT_PRICE;
        uint256 currentBalance = _balanceOf(msg.sender);
        require(currentBalance >= totalPrice, "Insufficient balance");

        playerBalances[msg.sender] = currentBalance - totalPrice;
        treasury += totalPrice;

        emit BuySeeds(
            msg.sender,
            amount,
            totalPrice,
            playerBalances[msg.sender],
            treasury
        );
    }

    function getBalance(address user) external view returns (uint256 playerBalance, uint256 treasuryBalance) {
        return (_balanceOf(user), treasury);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
