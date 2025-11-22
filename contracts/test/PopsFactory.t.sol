// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Pops.sol";
import "../src/Pop.sol";

contract PopsFactoryTest is Test {
    Pops public factory;
    address public user = address(0x1);

    function setUp() public {
        factory = new Pops("https://pops.cooking/api/metadata/");
    }

    function testMintToken() public {
        vm.prank(user);
        (uint256 tokenId, address popClone) = factory.mint(user);

        assertEq(tokenId, 0);
        assertEq(factory.balanceOf(user, tokenId), 1);
        assertEq(factory.tokenToPop(tokenId), popClone);
        assertEq(factory.popToToken(popClone), tokenId);
        
        Pop pop = Pop(popClone);
        assertEq(pop.tokenOwner(), user);
        assertEq(pop.factory(), address(factory));
    }

    function testGenerateChallenge() public {
        // Mint token
        vm.prank(user);
        (uint256 tokenId, address popClone) = factory.mint(user);

        Pop pop = Pop(popClone);

        // Generate challenge as token owner
        vm.prank(user);
        (bytes32 challengeHash, uint256 baseBlock, uint256 expiresBlock) = pop.generateChallenge();

        assertGt(uint256(challengeHash), 0);
        assertEq(baseBlock, block.number);
        assertEq(expiresBlock, block.number + 100);

        // Verify challenge is stored
        Pop.Challenge memory challenge = pop.getChallenge();
        assertEq(challenge.challengeHash, challengeHash);
        assertEq(challenge.baseBlock, baseBlock);
        assertEq(challenge.expiresBlock, expiresBlock);
    }

    function testOnlyOwnerCanGenerateChallenge() public {
        // Mint token
        vm.prank(user);
        (uint256 tokenId, address popClone) = factory.mint(user);

        Pop pop = Pop(popClone);

        // Try to generate challenge as non-owner
        address attacker = address(0x2);
        vm.prank(attacker);
        vm.expectRevert("Pop: caller is not token owner");
        pop.generateChallenge();
    }

    function testRecordProgress() public {
        // Mint token
        vm.prank(user);
        (uint256 tokenId, address popClone) = factory.mint(user);

        Pop pop = Pop(popClone);

        // Generate challenge
        vm.prank(user);
        (bytes32 challengeHash,,) = pop.generateChallenge();

        // Record progress as token owner with IPFS CID
        vm.prank(user);
        pop.recordProgress(challengeHash, "QmTest123");

        // Verify progress was recorded
        assertEq(pop.progressCount(), 1);
        
        Pop.Progress memory progress = pop.getProgress(0);
        assertEq(progress.challengeHash, challengeHash);
        assertEq(progress.ipfsCid, "QmTest123");
        assertEq(progress.timestamp, block.timestamp);
    }

    function testMultipleTokens() public {
        address user2 = address(0x2);

        // Mint first token
        vm.prank(user);
        (uint256 tokenId1, address popClone1) = factory.mint(user);

        // Mint second token
        vm.prank(user2);
        (uint256 tokenId2, address popClone2) = factory.mint(user2);

        assertEq(tokenId1, 0);
        assertEq(tokenId2, 1);
        assertTrue(popClone1 != popClone2);

        Pop pop1 = Pop(popClone1);
        Pop pop2 = Pop(popClone2);

        assertEq(pop1.tokenOwner(), user);
        assertEq(pop2.tokenOwner(), user2);
    }
}
