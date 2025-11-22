// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Pops} from "../src/Pops.sol";

contract PopsTest is Test {
    Pops public pops;
    address public user = address(0x1);

    function setUp() public {
        pops = new Pops();
    }

    function test_GenerateChallenge() public {
        vm.prank(user);
        (bytes32 challengeHash, uint256 baseBlock, uint256 expiresBlock) = pops.generateChallenge();

        // Challenge hash should not be zero
        assertTrue(challengeHash != bytes32(0), "Challenge hash should not be zero");
        
        // Base block should be current block
        assertEq(baseBlock, block.number, "Base block should be current block");
        
        // Expires block should be base + duration
        assertEq(expiresBlock, baseBlock + pops.CHALLENGE_DURATION(), "Expires block incorrect");
    }

    function test_IsChallengeValid() public {
        vm.prank(user);
        (, uint256 baseBlock, uint256 expiresBlock) = pops.generateChallenge();

        // Should be valid immediately after generation
        assertTrue(pops.isChallengeValid(baseBlock, expiresBlock), "Challenge should be valid");

        // Should be invalid after expiry
        vm.roll(expiresBlock + 1);
        assertFalse(pops.isChallengeValid(baseBlock, expiresBlock), "Challenge should be invalid after expiry");
    }

    function test_MultipleChallengesAreDifferent() public {
        vm.prank(user);
        (bytes32 hash1,,) = pops.generateChallenge();

        vm.roll(block.number + 1);
        vm.prank(user);
        (bytes32 hash2,,) = pops.generateChallenge();

        assertTrue(hash1 != hash2, "Different blocks should produce different hashes");
    }
}
