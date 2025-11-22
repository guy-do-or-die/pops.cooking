export const PopsABI = [
    {
        "type": "function",
        "name": "CHALLENGE_DURATION",
        "inputs": [],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "generateChallenge",
        "inputs": [],
        "outputs": [
            { "name": "challengeHash", "type": "bytes32" },
            { "name": "baseBlock", "type": "uint256" },
            { "name": "expiresBlock", "type": "uint256" }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "isChallengeValid",
        "inputs": [
            { "name": "baseBlock", "type": "uint256" },
            { "name": "expiresBlock", "type": "uint256" }
        ],
        "outputs": [{ "name": "isValid", "type": "bool" }],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "ChallengeGenerated",
        "inputs": [
            { "name": "user", "type": "address", "indexed": true },
            { "name": "challengeHash", "type": "bytes32", "indexed": true },
            { "name": "baseBlock", "type": "uint256", "indexed": false },
            { "name": "expiresBlock", "type": "uint256", "indexed": false }
        ]
    }
] as const;
