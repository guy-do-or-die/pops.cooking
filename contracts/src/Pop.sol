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
        uint256 timestamp
    );

    struct Challenge {
        bytes32 challengeHash;
        uint256 baseBlock;
        uint256 expiresBlock;
    }

    struct Progress {
        bytes32 challengeHash;
        uint256 timestamp;
        bool verified;
    }

    /// @notice The factory contract that deployed this clone
    address public factory;

    /// @notice The token owner (initial minter)
    address public tokenOwner;

    /// @notice The current challenge
    Challenge public currentChallenge;

    /// @notice Progress history
    Progress[] public progressHistory;

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
     * @notice Generate a new challenge for this token
     * @return challengeHash The unique challenge hash
     * @return baseBlock The block number when challenge was generated
     * @return expiresBlock The block number when challenge expires
     */
    function generateChallenge()
        external
        onlyTokenOwner
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
     * @notice Record verified progress (called by verifier/factory)
     * @param challengeHash The challenge that was verified
     */
    function recordProgress(bytes32 challengeHash) external {
        require(msg.sender == factory, "Pop: only factory can record progress");
        
        progressHistory.push(Progress({
            challengeHash: challengeHash,
            timestamp: block.timestamp,
            verified: true
        }));

        emit ProgressRecorded(progressHistory.length - 1, challengeHash, block.timestamp);
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
     * @notice Get progress history length
     */
    function getProgressCount() external view returns (uint256) {
        return progressHistory.length;
    }

    /**
     * @notice Get specific progress entry
     */
    function getProgress(uint256 index) external view returns (Progress memory) {
        require(index < progressHistory.length, "Pop: invalid index");
        return progressHistory[index];
    }
}
