export const PopABI = [
    {
        "inputs": [],
        "name": "generateChallenge",
        "outputs": [
            {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "baseBlock", "type": "uint256"},
            {"internalType": "uint256", "name": "expiresBlock", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "currentChallenge",
        "outputs": [
            {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "baseBlock", "type": "uint256"},
            {"internalType": "uint256", "name": "expiresBlock", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "tokenOwner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "progressCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
            {"internalType": "string", "name": "ipfsCid", "type": "string"}
        ],
        "name": "recordProgress",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "progressId", "type": "uint256"}],
        "name": "getProgress",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
                    {"internalType": "string", "name": "ipfsCid", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
                ],
                "internalType": "struct Pop.Progress",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllProgress",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
                    {"internalType": "string", "name": "ipfsCid", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
                ],
                "internalType": "struct Pop.Progress[]",
                "name": "entries",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
            {"indexed": false, "internalType": "uint256", "name": "baseBlock", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "expiresBlock", "type": "uint256"}
        ],
        "name": "ChallengeGenerated",
        "type": "event"
    }
] as const;
