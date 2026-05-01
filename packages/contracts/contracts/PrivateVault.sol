// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[3] memory input
    ) external view returns (bool);
}

contract PrivateVault {
    IVerifier public verifier;
    IERC20 public USDC;
    uint256 public constant DEPOSIT_AMOUNT = 100 * 10**6; // 100 tokens (6 decimals :: USDC)
    
    // Store all commitments (deposits)
    mapping(uint256 => bool) public commitments;
    
    // Store used nullifiers (prevent double-spending)
    mapping(uint256 => bool) public nullifierUsed;
    
    // Events
    event Deposit(uint256 indexed commitment, address indexed depositor, uint256 timestamp);
    event Withdrawal(address indexed recipient, uint256 nullifierHash, uint256 timestamp);
    
    /**
     * @dev Constructor
     * @param _verifier Address of the zk-SNARK verifier contract
     * @param _token Address of the ERC20 USDC to use
     */
    constructor(address _verifier, address _token) {
        require(_verifier != address(0), "Invalid verifier address");
        require(_token != address(0), "Invalid USDC address");
        
        verifier = IVerifier(_verifier);
        USDC = IERC20(_token);
    }
    
    /**
     * @dev Deposit tokens with a commitment
     * @param _commitment Hash of (secret, nullifier)
     * 
     * HOW TO USE:
     * 1. Generate random secret and nullifier off-chain
     * 2. Calculate commitment = hash(secret, nullifier)
     * 3. Approve this contract to spend DEPOSIT_AMOUNT tokens
     * 4. Call this function with the commitment
     * 5. Save your secret and nullifier! You need them to withdraw
     */
    function deposit(uint256 _commitment) external {
        require(!commitments[_commitment], "Commitment already exists");
        
        // Transfer tokens from user to this contract
        require(
            USDC.transferFrom(msg.sender, address(this), DEPOSIT_AMOUNT),
            "Token transfer failed"
        );
        
        // Store the commitment
        commitments[_commitment] = true;
        
        emit Deposit(_commitment, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Withdraw tokens using a zero-knowledge proof
     * @param _pA The zk-SNARK proof components [a]
     * @param _pB The zk-SNARK proof components [b]
     * @param _pC The zk-SNARK proof components [c]
     * @param _nullifierHash Hash of nullifier (prevents double-spend)
     * @param _recipient Address to receive the tokens
     * @param _commitment The commitment from the deposit
     * 
     * HOW TO USE:
     * 1. Generate proof off-chain using your secret and nullifier
     * 2. Call this function with the proof
     * 3. If proof is valid, tokens go to recipient address
     */
    function withdraw(
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint256 _nullifierHash,
        address _recipient,
        uint256 _commitment
    ) external {
        require(_recipient != address(0), "Invalid recipient");
        require(!nullifierUsed[_nullifierHash], "Note already spent");
        require(commitments[_commitment], "Commitment not found");
        
        // Verify the zero-knowledge proof
        // Public inputs: [recipient, commitment]
        uint[3] memory publicInputs = [
            _nullifierHash,
            uint256(uint160(_recipient)),
            _commitment
        ];
        
        require(
            verifier.verifyProof(_pA, _pB, _pC, publicInputs),
            "Invalid proof"
        );
        
        // Mark nullifier as used (prevent double-spending)
        nullifierUsed[_nullifierHash] = true;
        
        require(
            USDC.transfer(_recipient, DEPOSIT_AMOUNT),
            "Token transfer failed"
        );
        
        emit Withdrawal(_recipient, _nullifierHash, block.timestamp);
    }
    
    /**
     * @dev Check if a commitment has been used
     * @param _commitment The commitment to check
     * @return bool True if commitment exists
     */
    function isCommitmentUsed(uint256 _commitment) external view returns (bool) {
        return commitments[_commitment];
    }
    
    /**
     * @dev Check if a nullifier has been used
     * @param _nullifierHash The nullifier hash to check
     * @return bool True if nullifier has been used
     */
    function isNullifierUsed(uint256 _nullifierHash) external view returns (bool) {
        return nullifierUsed[_nullifierHash];
    }
    
    /**
     * @dev Get the vault's USDC balance
     * @return uint256 The amount of tokens held by the vault
     */
    function getBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
    
    /**
     * @dev Get the USDC address
     * @return address The ERC20 USDC address
     */
    function getToken() external view returns (address) {
        return address(USDC);
    }
}