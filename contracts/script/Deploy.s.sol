// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Pops} from "../src/Pops.sol";

contract DeployPops is Script {
    function run() external returns (Pops) {
        vm.startBroadcast();
        Pops pops = new Pops();
        vm.stopBroadcast();
        return pops;
    }
}
