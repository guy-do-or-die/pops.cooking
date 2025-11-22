// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Pops
 * @notice Simple proof-of-progress contract that generates challenges
 * @dev Challenges are derived from block hash to ensure unpredictability
 */
contract Pops {
    event ChallengeGenerated(
        address indexed user,
        bytes32 indexed challengeHash,
        uint256 baseBlock,
        uint256 expiresBlock
    );

    struct Challenge {
        bytes32 challengeHash;
        uint256 baseBlock;
        uint256 expiresBlock;
    }

    /// @notice Stores the latest challenge for each user
    mapping(address => Challenge) public userChallenges;

    /// @notice Duration for which a challenge is valid (in blocks)
    uint256 public constant CHALLENGE_DURATION = 100;

    /**
     * @notice Generate a new challenge for the caller
     * @return challengeHash The unique challenge hash
     * @return baseBlock The block number when challenge was generated
     * @return expiresBlock The block number when challenge expires
     */
    function generateChallenge()
        external
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
                msg.sender,
                block.number,
                block.timestamp
            )
        );

        // Store the challenge
        userChallenges[msg.sender] = Challenge({
            challengeHash: challengeHash,
            baseBlock: baseBlock,
            expiresBlock: expiresBlock
        });

        emit ChallengeGenerated(msg.sender, challengeHash, baseBlock, expiresBlock);
        
        return (challengeHash, baseBlock, expiresBlock);
    }

    /**
     * @notice Check if a challenge is still valid
     * @param baseBlock The block when challenge was created
     * @param expiresBlock The block when challenge expires
     * @return isValid True if current block is within valid range
     */
    function isChallengeValid(uint256 baseBlock, uint256 expiresBlock)
        external
        view
        returns (bool isValid)
    {
        return block.number >= baseBlock && block.number <= expiresBlock;
    }
}
