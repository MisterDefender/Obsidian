// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[5] memory input
    ) external view returns (bool);
}

/**
 * @title ObsidianVault
 * @notice A zero-knowledge shielded vault for a fixed-denomination ERC-20.
 *
 * Deposit: post a commitment = Poseidon(nullifier, secret); it becomes the next
 * Merkle leaf. Withdraw: prove, in zero knowledge, that your commitment is a leaf
 * under a known recent root — revealing only the root and the nullifier hash, never
 * which deposit. A relayer may submit the withdrawal and take `fee` from the amount.
 *
 * Research / educational. Testnet only.
 */
contract ObsidianVault is MerkleTreeWithHistory, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidVerifier();
    error InvalidToken();
    error InvalidDenomination();
    error InvalidRecipient();
    error CommitmentAlreadyUsed(uint256 commitment);
    error CommitmentOutOfField(uint256 commitment);
    error NoteAlreadySpent(uint256 nullifierHash);
    error UnknownRoot(uint256 root);
    error FeeExceedsDenomination(uint256 fee, uint256 denomination);
    error InvalidProof();

    IVerifier public immutable verifier;
    IERC20 public immutable token;
    uint256 public immutable denomination;

    // commitment => exists (guards against duplicate leaves)
    mapping(uint256 => bool) public commitments;
    // nullifierHash => spent (prevents double-spend)
    mapping(uint256 => bool) public nullifierHashes;

    event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address indexed recipient, uint256 nullifierHash, address indexed relayer, uint256 fee);

    /**
     * @param _verifier     Groth16 verifier for the withdraw circuit
     * @param _hasher       Poseidon(2) hasher (must match the circuit's Poseidon)
     * @param _token        the ERC-20 held by the vault
     * @param _denomination fixed deposit/withdraw amount
     * @param _levels       Merkle tree depth (must match the circuit, e.g. 20)
     */
    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        IERC20 _token,
        uint256 _denomination,
        uint32 _levels
    ) MerkleTreeWithHistory(_levels, _hasher) {
        if (address(_verifier) == address(0)) revert InvalidVerifier();
        if (address(_token) == address(0)) revert InvalidToken();
        if (_denomination == 0) revert InvalidDenomination();
        verifier = _verifier;
        token = _token;
        denomination = _denomination;
    }

    /**
     * @notice Deposit `denomination` tokens under `_commitment`.
     * @dev Caller must approve the vault for `denomination` first.
     */
    function deposit(uint256 _commitment) external nonReentrant {
        if (commitments[_commitment]) revert CommitmentAlreadyUsed(_commitment);
        if (_commitment >= FIELD_SIZE) revert CommitmentOutOfField(_commitment);

        uint32 index = _insert(_commitment);
        commitments[_commitment] = true;

        token.safeTransferFrom(msg.sender, address(this), denomination);

        emit Deposit(_commitment, index, block.timestamp);
    }

    /**
     * @notice Withdraw to `_recipient`, paying `_fee` to `_relayer`.
     * @dev Public inputs must be ordered exactly as the circuit declares them:
     *      [root, nullifierHash, recipient, relayer, fee].
     */
    function withdraw(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint256 _root,
        uint256 _nullifierHash,
        address _recipient,
        address _relayer,
        uint256 _fee
    ) external nonReentrant {
        if (nullifierHashes[_nullifierHash]) revert NoteAlreadySpent(_nullifierHash);
        if (!isKnownRoot(_root)) revert UnknownRoot(_root);
        if (_fee > denomination) revert FeeExceedsDenomination(_fee, denomination);
        if (_recipient == address(0)) revert InvalidRecipient();

        bool valid = verifier.verifyProof(
            _pA,
            _pB,
            _pC,
            [
                _root,
                _nullifierHash,
                uint256(uint160(_recipient)),
                uint256(uint160(_relayer)),
                _fee
            ]
        );
        if (!valid) revert InvalidProof();

        // effects before interactions
        nullifierHashes[_nullifierHash] = true;

        token.safeTransfer(_recipient, denomination - _fee);
        if (_fee > 0) {
            token.safeTransfer(_relayer, _fee);
        }

        emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
    }

    function isSpent(uint256 _nullifierHash) external view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
