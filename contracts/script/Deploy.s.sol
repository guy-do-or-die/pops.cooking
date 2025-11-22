// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Pops} from "../src/Pops.sol";

contract DeployPops is Script {
    function run() external returns (Pops) {
        vm.startBroadcast();
        
        // Deploy Pops with base URI
        string memory baseURI = "https://pops.cooking/api/metadata/";
        Pops pops = new Pops(baseURI);
        
        vm.stopBroadcast();
        
        // Log addresses
        console.log("Pops deployed at:", address(pops));
        console.log("Pop implementation at:", pops.popImplementation());
        
        return pops;
    }
}
