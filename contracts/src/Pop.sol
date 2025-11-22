// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title Pop
 * @notice Cloneable contract that stores challenges and progress for a single token
 * @dev Each Pop instance is tied to one ERC1155 token ID
 */
contract Pop is Initializable {
    event ChallengeGenerated(
        bytes32 indexed challengeHash,
        uint256 baseBlock,
        uint256 expiresBlock
    );

    event ProgressRecorded(
        uint256 indexed progressId,
        bytes32 challengeHash,
        string ipfsCid,
        uint256 timestamp
    );

    struct Challenge {
        bytes32 challengeHash;
        uint256 baseBlock;
        uint256 expiresBlock;
    }

    struct Progress {
        bytes32 challengeHash;
        string ipfsCid;
        uint256 timestamp;
    }

    /// @notice The factory contract that deployed this clone
    address public factory;

    /// @notice The token owner (initial minter)
    address public tokenOwner;

    /// @notice The current challenge
    Challenge public currentChallenge;

    /// @notice Progress history mapping (progressId => Progress)
    mapping(uint256 => Progress) public progressHistory;

    /// @notice Counter for progress IDs
    uint256 public progressCount;

    /// @notice Duration for which a challenge is valid (in blocks)
    uint256 public constant CHALLENGE_DURATION = 100;

    /**
     * @notice Initialize the Pop clone
     * @param _tokenOwner The address that owns this token
     */
    function initialize(address _tokenOwner) external initializer {
        factory = msg.sender;
        tokenOwner = _tokenOwner;
    }

    /**
     * @notice Only the token owner can call this function
     */
    modifier onlyTokenOwner() {
        require(msg.sender == tokenOwner, "Pop: caller is not token owner");
        _;
    }

    /**
     * @notice Only the token owner or factory can call this function
     */
    modifier onlyTokenOwnerOrFactory() {
        require(msg.sender == tokenOwner || msg.sender == factory, "Pop: caller is not authorized");
        _;
    }

    /**
     * @notice Generate a new challenge for this token
     * @return challengeHash The unique challenge hash
     * @return baseBlock The block number when challenge was generated
     * @return expiresBlock The block number when challenge expires
     */
    function generateChallenge()
        external
        onlyTokenOwnerOrFactory
        returns (
            bytes32 challengeHash,
            uint256 baseBlock,
            uint256 expiresBlock
        )
    {
        baseBlock = block.number;
        expiresBlock = baseBlock + CHALLENGE_DURATION;
        
        challengeHash = keccak256(
            abi.encodePacked(
                blockhash(block.number - 1),
                tokenOwner,
                address(this),
                block.number,
                block.timestamp
            )
        );

        currentChallenge = Challenge({
            challengeHash: challengeHash,
            baseBlock: baseBlock,
            expiresBlock: expiresBlock
        });

        emit ChallengeGenerated(challengeHash, baseBlock, expiresBlock);
        
        return (challengeHash, baseBlock, expiresBlock);
    }

    /**
     * @notice Record verified progress (called by token owner after verification)
     * @param challengeHash The challenge that was verified
     * @param ipfsCid The IPFS CID of the screenshot from verified footage
     */
    function recordProgress(bytes32 challengeHash, string calldata ipfsCid) external onlyTokenOwner {
        require(bytes(ipfsCid).length > 0, "Pop: IPFS CID required");
        
        uint256 progressId = progressCount++;
        
        progressHistory[progressId] = Progress({
            challengeHash: challengeHash,
            ipfsCid: ipfsCid,
            timestamp: block.timestamp
        });

        emit ProgressRecorded(progressId, challengeHash, ipfsCid, block.timestamp);
    }

    /**
     * @notice Check if current challenge is still valid
     * @return isValid True if current block is within valid range
     */
    function isChallengeValid() external view returns (bool isValid) {
        return block.number >= currentChallenge.baseBlock && 
               block.number <= currentChallenge.expiresBlock;
    }

    /**
     * @notice Get the current challenge
     */
    function getChallenge() external view returns (Challenge memory) {
        return currentChallenge;
    }

    /**
     * @notice Get specific progress entry
     * @param progressId The progress ID to retrieve
     */
    function getProgress(uint256 progressId) external view returns (Progress memory) {
        require(progressId < progressCount, "Pop: invalid progress ID");
        return progressHistory[progressId];
    }

    /**
     * @notice Get all progress entries
     * @return entries Array of all progress entries
     */
    function getAllProgress() external view returns (Progress[] memory entries) {
        entries = new Progress[](progressCount);
        for (uint256 i = 0; i < progressCount; i++) {
            entries[i] = progressHistory[i];
        }
    }
}
