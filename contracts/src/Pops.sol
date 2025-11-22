// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Pop.sol";

/**
 * @title Pops
 * @notice ERC1155 token factory that deploys Pop clones for each token
 * @dev Each token ID corresponds to one Pop clone for challenge/progress tracking
 */
contract Pops is ERC1155, Ownable {
    using Clones for address;

    event TokenMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address popClone
    );

    /// @notice Pop implementation contract for cloning
    address public immutable popImplementation;

    /// @notice Mapping from token ID to Pop clone address
    mapping(uint256 => address) public tokenToPop;

    /// @notice Mapping from Pop clone to token ID
    mapping(address => uint256) public popToToken;

    /// @notice Counter for token IDs
    uint256 private _nextTokenId;

    /**
     * @notice Constructor
     * @param uri Base URI for token metadata
     */
    constructor(string memory uri) ERC1155(uri) Ownable(msg.sender) {
        // Deploy Pop implementation
        popImplementation = address(new Pop());
    }

    /**
     * @notice Mint a new token and deploy its Pop clone
     * @param to Address to mint the token to
     * @return tokenId The newly minted token ID
     * @return popClone The address of the deployed Pop clone
     */
    function mint(address to) external returns (uint256 tokenId, address popClone) {
        tokenId = _nextTokenId++;
        
        // Mint the token
        _mint(to, tokenId, 1, "");

        // Clone the Pop implementation
        popClone = popImplementation.clone();
        
        // Initialize the clone with the token owner
        Pop(popClone).initialize(to);

        // Store mappings
        tokenToPop[tokenId] = popClone;
        popToToken[popClone] = tokenId;

        emit TokenMinted(tokenId, to, popClone);

        return (tokenId, popClone);
    }

    /**
     * @notice Get the Pop clone address for a token ID
     * @param tokenId The token ID
     * @return The Pop clone address
     */
    function getPopForToken(uint256 tokenId) external view returns (address) {
        address popClone = tokenToPop[tokenId];
        require(popClone != address(0), "PopsFactory: token does not exist");
        return popClone;
    }

    /**
     * @notice Get the token ID for a Pop clone address
     * @param popClone The Pop clone address
     * @return The token ID
     */
    function getTokenForPop(address popClone) external view returns (uint256) {
        uint256 tokenId = popToToken[popClone];
        require(tokenToPop[tokenId] == popClone, "PopsFactory: Pop does not exist");
        return tokenId;
    }

    /**
     * @notice Get the owner of a token
     * @param tokenId The token ID
     * @return The owner address
     */
    function getTokenOwner(uint256 tokenId) external view returns (address) {
        address popClone = tokenToPop[tokenId];
        require(popClone != address(0), "PopsFactory: token does not exist");
        return Pop(popClone).tokenOwner();
    }

    /**
     * @notice Update the base URI
     * @param newuri The new base URI
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }
}
