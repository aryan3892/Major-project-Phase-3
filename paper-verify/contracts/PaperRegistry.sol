// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PaperRegistry
/// @notice Stores SHA-256 fingerprints + IPFS CIDs of research papers (not the papers themselves).
contract PaperRegistry {
    struct Paper {
        address author;
        string title;
        string cid;           // IPFS content id of the PDF
        uint64 timestamp;
        uint16 version;
        bool retracted;
        bytes32 previousHash; // 0x0 for the first version
    }

    mapping(bytes32 => Paper) private papers;

    event Registered(bytes32 indexed hash, address indexed author, string title, uint16 version);
    event Retracted(bytes32 indexed hash, address indexed author);

    function register(bytes32 hash, string calldata title, string calldata cid, bytes32 previousHash) external {
        require(hash != bytes32(0), "Empty hash");
        require(papers[hash].timestamp == 0, "Already registered");

        uint16 version = 1;
        if (previousHash != bytes32(0)) {
            Paper storage prev = papers[previousHash];
            require(prev.timestamp != 0, "Previous version not found");
            require(prev.author == msg.sender, "Only author can add a version");
            version = prev.version + 1;
        }

        papers[hash] = Paper(msg.sender, title, cid, uint64(block.timestamp), version, false, previousHash);
        emit Registered(hash, msg.sender, title, version);
    }

    function retract(bytes32 hash) external {
        Paper storage p = papers[hash];
        require(p.timestamp != 0, "Not found");
        require(p.author == msg.sender, "Only author can retract");
        require(!p.retracted, "Already retracted");
        p.retracted = true;
        emit Retracted(hash, msg.sender);
    }

    function verify(bytes32 hash) external view returns (bool exists, Paper memory paper) {
        Paper storage p = papers[hash];
        return (p.timestamp != 0, p);
    }
}
